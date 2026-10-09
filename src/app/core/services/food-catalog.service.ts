import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthError } from '../../common/interfaces/auth/auth.models';
import { AuthStore } from '../auth/auth.store';
import { FOODS, FOOD_IDS } from '../data/foods';
import { foodItem, foodOf, systemFoods } from '../food-book';
import { td } from '../i18n/translate';
import { per100 } from '../nutrition';
import { Lang, MealItem, SystemFood, Unit } from '../../common/interfaces';
import { FoodRepository, FoodRow, NewFoodRow } from '../repositories/food.repository';
import { activeLang, clamp, rnd } from '../utils';
import { StoreService } from './store.service';

/** One row of the food reference list, in the active language. */
export interface FoodEntry {
  id: string;
  /** System foods come from the backend (the built-in copy is the fallback) and cannot be deleted. */
  isSystem: boolean;
  name: string;
  unit: Unit;
  /** Per 100 g when the unit is 'q', per single unit otherwise. */
  k: number;
  p: number;
  c: number;
  f: number;
  /** The user's own place in the whole list; null = not placed (always for guests and the built-in fallback). */
  position: number | null;
  /** Id of the backend row (system entries are keyed by `id` = their code); undefined for the built-in fallback. */
  rowId?: string;
}

export interface NewFood {
  names: Partial<Record<Lang, string>>;
  unit: Unit;
  k: number;
  p: number;
  c: number;
  f: number;
}

const MAX_KCAL = 1000;
const MAX_MACRO = 100;

/** Text for the active language, falling back to Azerbaijani (the source language), then to any language that has one. */
const nameIn = (names: Partial<Record<Lang, string>>): string => names[activeLang()] || names.az || Object.values(names).find(Boolean) || '';

/** Built-in order first (the order of data/foods.ts), then any other system food by name. */
const bySystemOrder = (a: FoodRow, b: FoodRow): number => {
  const ia = FOOD_IDS.indexOf(a.code as string);
  const ib = FOOD_IDS.indexOf(b.code as string);
  if (ia >= 0 || ib >= 0) return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib);
  return nameIn(a.names).localeCompare(nameIn(b.names));
};

const toEntry = (r: FoodRow, isSystem: boolean): FoodEntry => ({ id: isSystem ? (r.code as string) : r.id, isSystem, name: nameIn(r.names), unit: r.unit, k: r.k, p: r.p, c: r.c, f: r.f, position: r.position, rowId: r.id });

/** A backend row as a list entry in the active language. */
export const foodEntryOf = (r: FoodRow): FoodEntry => toEntry(r, r.code !== null);

/**
 * Food reference list: the system foods plus the ones the signed-in user added, all from the backend (`FoodRepository`).
 * Guests see the system foods and cannot add their own. If the backend cannot be reached the built-in foods
 * (`data/foods.ts`) are shown. Only the built-in foods feed the menu generator; a user food is picked in "add meal" and stored in the meal as a plain
 * item, so a deleted food never breaks a saved menu.
 */
@Injectable({ providedIn: 'root' })
export class FoodCatalogService {
  private readonly store = inject(StoreService);
  private readonly repo = inject(FoodRepository);
  private readonly auth = inject(AuthStore);

  /** What the backend returned last, tagged with the user it was read for. Null = not loaded (or unreachable). */
  private readonly remote = signal<{ userId: string | null; rows: FoodRow[] } | null>(null);
  private queue: Promise<void> = Promise.resolve();

  readonly loading = signal(false);
  /** The backend is configured but could not be read; the built-in list is shown instead. */
  readonly loadFailed = signal(false);

  /** System foods first, then the user's own, named in the active language. */
  readonly entries = computed<FoodEntry[]>(() => {
    const rows = this.remote()?.rows ?? [];
    const systemRows = rows.filter((r) => r.code !== null).sort(bySystemOrder);
    const published = systemFoods();
    const system: FoodEntry[] = systemRows.length
      ? systemRows.map((r) => toEntry(r, true))
      : published.length
        ? published.map((x): FoodEntry => ({ id: x.code, isSystem: true, name: nameIn(x.names), unit: x.unit, k: x.k, p: x.p, c: x.c, f: x.f, position: null }))
        : FOOD_IDS.map((id): FoodEntry => {
            const { name, unit, k, p, c, f } = FOODS[id];
            return { id, isSystem: true, name: td(name), unit, k, p, c, f, position: null };
          });
    const userId = this.auth.user()?.id ?? null;
    const remoteOwn = userId !== null && this.remote()?.userId === userId ? rows.filter((r) => r.code === null) : [];
    const own = [...remoteOwn].sort((a, b) => (a.position ?? 1e9) - (b.position ?? 1e9));
    return [...system, ...own.map((r) => toEntry(r, false))];
  });

  constructor() {
    // The system foods saved by the last successful read: the menu generator works with them before (and without) the backend.
    const saved = this.store.state().foodCache;
    if (saved.length) systemFoods.set(saved);
    const userId = computed(() => this.auth.user()?.id ?? null);
    // Read again when the session becomes known and whenever someone signs in or out.
    effect(() => {
      if (this.auth.status() === 'loading') return;
      userId();
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
      const userId = this.auth.user()?.id ?? null;
      this.remote.set({ userId, rows });
      this.publish(rows);
      this.loadFailed.set(false);
    } catch (e) {
      this.remote.set(null);
      this.loadFailed.set(!(e instanceof AuthError && e.code === 'not_configured'));
    } finally {
      this.loading.set(false);
    }
  }

  /** Makes the system foods the app's working list and keeps a copy in the saved state for offline use. */
  private publish(rows: FoodRow[]): void {
    const list: SystemFood[] = [];
    for (const r of rows) {
      if (r.code === null || r.role === null || r.step === null || r.min === null || r.max === null) continue;
      list.push({ code: r.code, names: r.names, unit: r.unit, k: r.k, p: r.p, c: r.c, f: r.f, role: r.role, step: r.step, min: r.min, max: r.max });
    }
    if (!list.length) return;
    systemFoods.set(list);
    if (JSON.stringify(list) !== JSON.stringify(this.store.state().foodCache)) this.store.mutate((s) => (s.foodCache = list));
  }

  /** The user's own food with its names in every language (to edit it). */
  own(id: string): FoodRow | undefined {
    return this.remote()?.rows.find((r) => r.id === id && r.code === null);
  }

  find(id: string): FoodEntry | undefined {
    return this.entries().find((e) => e.id === id);
  }

  /** Checks the input the way the backend will: an Azerbaijani name is required, macros are clamped to sane values. */
  private clean(input: NewFood): NewFoodRow | null {
    const names: Partial<Record<Lang, string>> = {};
    for (const lang of ['az', 'en', 'ru'] as const) {
      const text = input.names[lang]?.trim();
      if (text) names[lang] = text;
    }
    if (!names.az) return null;
    const macro = (n: number, max: number): number => rnd(clamp(Number.isFinite(n) ? n : 0, 0, max), 1);
    return { names, unit: input.unit, k: macro(input.k, MAX_KCAL), p: macro(input.p, MAX_MACRO), c: macro(input.c, MAX_MACRO), f: macro(input.f, MAX_MACRO) };
  }

  /** Adds a user food; returns false when no name was given. Throws when the backend refuses it or nobody is signed in. */
  async add(input: NewFood): Promise<boolean> {
    const food = this.clean(input);
    if (!food) return false;
    const userId = this.auth.user()?.id ?? null;
    if (!userId) throw new AuthError('session_expired');
    const row = await this.repo.add(food);
    this.remote.update((r) => ({ userId, rows: [...(r?.rows ?? []), row] }));
    return true;
  }

  /** Changes one of the user's own foods (system foods are refused); returns false for a missing name or an unknown id. Throws when the backend refuses it. */
  async update(id: string, input: NewFood): Promise<boolean> {
    const food = this.clean(input);
    if (!food || !this.remote()?.rows.some((r) => r.id === id && r.code === null)) return false;
    const row = await this.repo.update(id, food);
    this.remote.update((r) => (r ? { ...r, rows: r.rows.map((x) => (x.id === id ? row : x)) } : r));
    return true;
  }

  /** Puts a food in the place of another in the user's order (row ids). Throws when the backend refuses it; the caller undoes what it showed. */
  async move(id: string, targetId: string): Promise<void> {
    await this.repo.move(id, targetId);
    await this.refresh();
  }

  /** Deletes a user food; system foods (and unknown ids) are refused. Throws when the backend refuses it. */
  async remove(id: string): Promise<boolean> {
    if (!this.remote()?.rows.some((r) => r.id === id && r.code === null)) return false;
    await this.repo.remove(id);
    this.remote.update((r) => (r ? { ...r, rows: r.rows.filter((x) => x.id !== id) } : r));
    return true;
  }

  /** Meal item for `amt` of a food: a system food keeps its code (plus a snapshot of its macros), any other food becomes a self-contained item. */
  toMealItem(id: string, amt: number): MealItem {
    const e = this.find(id);
    if (!e || (e.isSystem && foodOf(e.id))) return foodItem(id, amt);
    const m = per100(e.unit) ? amt / 100 : amt;
    return { name: e.name, amt: 1, k: rnd(e.k * m, 1), p: rnd(e.p * m, 1), c: rnd(e.c * m, 1), f: rnd(e.f * m, 1), amtLabel: `${rnd(amt, 1)} ${td(e.unit)}` };
  }
}
