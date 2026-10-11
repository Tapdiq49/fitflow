import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthError } from '../../common/interfaces/auth/auth.models';
import { AuthStore } from '../auth/auth.store';
import { TEMPLATES } from '../data/meals';
import { foodItem, foodOf } from '../food-book';
import { contentNames } from '../i18n/translate';
import { systemMealTemplates } from '../meal-book';
import { itemMacros, sumMacros } from '../nutrition';
import { Lang, Macros, SystemMealTemplate, TemplateKey } from '../../common/interfaces';
import { MealRepository, MealRow } from '../repositories/meal.repository';
import { activeLang, clamp, rnd } from '../utils';
import { StoreService } from './store.service';

/** The pools of meal templates, in the order the menu uses them through the day. */
export const MEAL_SLOTS: readonly TemplateKey[] = ['breakfast', 'snack', 'lunch', 'pre', 'post', 'dinner'];

export const MAX_MEAL_ITEMS = 12;
const MAX_AMOUNT = 2000;

/** One row of the meal reference list, in the active language. */
export interface MealEntry {
  /** The stable code (what saved menus refer to). */
  id: string;
  slot: TemplateKey;
  position: number;
  /** Name in the active language (Azerbaijani, the source language, when that language has none). */
  name: string;
  names: Partial<Record<Lang, string>>;
  main: string | null;
  light: boolean;
  items: [string, number][];
  /** Calories and macros of all the foods at these amounts. */
  macros: Macros;
  /** Id of the backend row; undefined for the built-in fallback. */
  rowId?: string;
}

export interface NewMeal {
  names: Partial<Record<Lang, string>>;
  slot: TemplateKey;
  main: string | null;
  light: boolean;
  items: ReadonlyArray<readonly [string, number]>;
}

const nameIn = (names: Partial<Record<Lang, string>>): string => names[activeLang()] || names.az || Object.values(names).find(Boolean) || '';

const macrosOf = (items: ReadonlyArray<readonly [string, number]>): Macros => sumMacros(items.map(([food, amt]) => itemMacros(foodItem(food, amt))));

const toEntry = (t: SystemMealTemplate, rowId?: string): MealEntry => ({
  id: t.code,
  slot: t.slot,
  position: t.position,
  name: nameIn(t.names),
  names: t.names,
  main: t.main,
  light: t.light,
  items: t.items,
  macros: macrosOf(t.items),
  rowId,
});

/** A backend row as a list entry in the active language (a row of a page has its name in that language and Azerbaijani only). */
export const mealEntryOf = (r: MealRow): MealEntry => toEntry({ code: r.code, slot: r.slot, position: r.position, names: r.names, main: r.main, light: r.light, items: r.items }, r.id);

/** The built-in templates (`data/meals.ts`), shown while nothing has been read from the backend. Their names carry the translations of the content keys. */
const builtIn = (): SystemMealTemplate[] =>
  MEAL_SLOTS.flatMap((slot) =>
    (TEMPLATES[slot] ?? []).map((t, i): SystemMealTemplate => ({ code: t.id, slot, position: i + 1, names: { az: t.name }, main: t.main ?? null, light: !!t.light, items: t.items.map(([f, a]) => [f, a] as [string, number]) })),
  );

/**
 * The meal reference list: the meal templates the menu generator and the weekly plan draw from, from the backend (`MealRepository`).
 * Everyone reads them; changing them needs the permission `meals.edit` (checked by the backend, the page only hides the controls).
 * If the backend cannot be reached the copy saved by the last read is used, and on a first visit the built-in templates (`data/meals.ts`).
 * The templates are shared by all users: a change reaches every menu generated afterwards; saved menus keep their own copy of the meal.
 */
@Injectable({ providedIn: 'root' })
export class MealCatalogService {
  private readonly store = inject(StoreService);
  private readonly repo = inject(MealRepository);
  private readonly auth = inject(AuthStore);

  /** What the backend returned last. Null = not loaded (or unreachable). */
  private readonly remote = signal<MealRow[] | null>(null);
  private queue: Promise<void> = Promise.resolve();

  readonly loading = signal(false);
  /** The backend is configured but could not be read; the saved or built-in list is shown instead. */
  readonly loadFailed = signal(false);

  /** Every template, by pool and place, named in the active language. */
  readonly entries = computed<MealEntry[]>(() => {
    // An empty answer means the backend has no templates yet: the saved or built-in ones stay in use (as in `publish`).
    const rows = this.remote()?.length ? this.remote() : null;
    const list: MealEntry[] = rows ? rows.map(mealEntryOf) : systemMealTemplates().length ? systemMealTemplates().map((t) => toEntry(t)) : builtIn().map((t) => toEntry(t));
    return list.sort((a, b) => MEAL_SLOTS.indexOf(a.slot) - MEAL_SLOTS.indexOf(b.slot) || a.position - b.position);
  });

  constructor() {
    // The templates saved by the last successful read: the menu generator works with them before (and without) the backend.
    const saved = this.store.state().mealCache;
    if (saved.length) this.apply(saved);
    // Read again when the session becomes known and whenever someone signs in or out (the permission to write follows the account).
    effect(() => {
      if (this.auth.status() === 'loading') return;
      this.auth.user();
      untracked(() => void this.refresh());
    });
  }

  /** Reads the list from the backend, one read at a time. */
  refresh(): Promise<void> {
    return (this.queue = this.queue.then(() => this.load()));
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await this.repo.list();
      this.remote.set(rows);
      this.publish(rows);
      this.loadFailed.set(false);
    } catch (e) {
      this.remote.set(null);
      this.loadFailed.set(!(e instanceof AuthError && e.code === 'not_configured'));
    } finally {
      this.loading.set(false);
    }
  }

  /** Makes the templates the app's working list and keeps a copy in the saved state for offline use. */
  private publish(rows: MealRow[]): void {
    const list: SystemMealTemplate[] = rows.map((r) => ({ code: r.code, slot: r.slot, position: r.position, names: r.names, main: r.main, light: r.light, items: r.items }));
    // An empty table means the backend has nothing yet: keep what the app has (the saved copy or the built-in templates).
    if (!list.length) return;
    this.apply(list);
    if (JSON.stringify(list) !== JSON.stringify(this.store.state().mealCache)) this.store.mutate((s) => (s.mealCache = list));
  }

  /** Hands the templates to the menu generator and the name lookup. */
  private apply(list: readonly SystemMealTemplate[]): void {
    systemMealTemplates.set(list);
    contentNames.set(new Map(list.filter((t) => t.names.az).map((t) => [t.names.az as string, t.names])));
  }

  /** Calories and macros of foods at the given amounts (for the form's running total). */
  macrosOf(items: ReadonlyArray<readonly [string, number]>): Macros {
    return macrosOf(items);
  }

  find(code: string): MealEntry | undefined {
    return this.entries().find((e) => e.id === code);
  }

  /** The backend row with its names in every language (to edit it). */
  row(code: string): MealRow | undefined {
    return this.remote()?.find((r) => r.code === code);
  }

  /** Checks the input the way the backend will: an Azerbaijani name, between 1 and 12 foods that exist, sane amounts. Null = refused. */
  private clean(input: NewMeal): Omit<MealRow, 'id' | 'code' | 'position'> | null {
    const names: Partial<Record<Lang, string>> = {};
    for (const lang of ['az', 'en', 'ru'] as const) {
      const text = input.names[lang]?.trim();
      if (text) names[lang] = text;
    }
    if (!names.az || !MEAL_SLOTS.includes(input.slot)) return null;
    const items: [string, number][] = [];
    for (const [food, amt] of input.items) {
      if (!foodOf(food) || !Number.isFinite(amt) || amt <= 0) return null;
      items.push([food, rnd(clamp(amt, 0.5, MAX_AMOUNT), 1)]);
    }
    if (!items.length || items.length > MAX_MEAL_ITEMS) return null;
    const main = input.main && foodOf(input.main) ? input.main : null;
    return { slot: input.slot, names, main, light: input.light, items };
  }

  /** Adds a template at the end of its pool; returns false for input the backend would refuse. Throws when the backend refuses it (no permission, offline). */
  async add(input: NewMeal): Promise<boolean> {
    const meal = this.clean(input);
    if (!meal) return false;
    const rows = this.remote() ?? [];
    const position = Math.max(0, ...rows.filter((r) => r.slot === meal.slot).map((r) => r.position)) + 1;
    const code = `u${Math.random().toString(36).slice(2, 10)}`;
    const row = await this.repo.add({ ...meal, code, position });
    this.remote.set([...rows, row]);
    this.publish(this.remote() ?? []);
    return true;
  }

  /** Changes a template (its pool may change too: it then goes to the end of the new pool); false for a missing name, foods that do not exist or an unknown code. */
  async update(code: string, input: NewMeal): Promise<boolean> {
    const meal = this.clean(input);
    const rows = this.remote() ?? [];
    const old = rows.find((r) => r.code === code);
    if (!meal || !old) return false;
    if (meal.slot !== old.slot && rows.filter((r) => r.slot === old.slot).length <= 1) return false;
    const position = meal.slot === old.slot ? old.position : Math.max(0, ...rows.filter((r) => r.slot === meal.slot).map((r) => r.position)) + 1;
    const row = await this.repo.update(old.id, { ...meal, position });
    this.remote.set(rows.map((r) => (r.id === old.id ? row : r)));
    this.publish(this.remote() ?? []);
    return true;
  }

  /** Deletes a template; false for an unknown code or the last one of its pool (the menu needs at least one per meal). Saved menus keep their copy of the meal. */
  async remove(code: string): Promise<boolean> {
    const rows = this.remote() ?? [];
    const old = rows.find((r) => r.code === code);
    if (!old || rows.filter((r) => r.slot === old.slot).length <= 1) return false;
    await this.repo.remove(old.id);
    this.remote.set(rows.filter((r) => r.id !== old.id));
    // The last template cannot be published away (an empty list keeps the old one), so read the list again.
    await this.refresh();
    return true;
  }
}
