import { Injectable, computed, inject } from '@angular/core';
import { FOODS, FOOD_IDS } from '../data/foods';
import { td } from '../i18n/translate';
import { CustomFood, Lang, MealItem, Unit } from '../models';
import { activeLang, clamp, rnd, uid } from '../utils';
import { StoreService } from './store.service';

/** One row of the food reference list, in the active language. */
export interface FoodEntry {
  id: string;
  /** System foods ship with the app (later: come from the backend) and cannot be deleted. */
  isSystem: boolean;
  name: string;
  unit: Unit;
  /** Per 100 g when the unit is 'q', per single unit otherwise. */
  k: number;
  p: number;
  c: number;
  f: number;
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

/**
 * Food reference list: the built-in foods (system) plus the ones the user added. Only the system foods feed the menu
 * generator; user foods are picked in "add meal" and stored in the meal as a plain item, so a deleted food never breaks a saved menu.
 * Swapping the system part for backend data later only changes `entries`.
 */
@Injectable({ providedIn: 'root' })
export class FoodCatalogService {
  private readonly store = inject(StoreService);

  /** System foods first, then the user's own, named in the active language. */
  readonly entries = computed<FoodEntry[]>(() => {
    const system = FOOD_IDS.map((id): FoodEntry => {
      const { name, unit, k, p, c, f } = FOODS[id];
      return { id, isSystem: true, name: td(name), unit, k, p, c, f };
    });
    const own = Object.values(this.store.state().customFoods).map((x): FoodEntry => ({ id: x.id, isSystem: false, name: nameIn(x.names), unit: x.unit, k: x.k, p: x.p, c: x.c, f: x.f }));
    return [...system, ...own];
  });

  find(id: string): FoodEntry | undefined {
    return this.entries().find((e) => e.id === id);
  }

  /** Adds a user food; returns false when no name was given. Macros are clamped to sane per-100 g values. */
  add(input: NewFood): boolean {
    const names: Partial<Record<Lang, string>> = {};
    for (const lang of ['az', 'en', 'ru'] as const) {
      const text = input.names[lang]?.trim();
      if (text) names[lang] = text;
    }
    if (!names.az) return false;
    const macro = (n: number, max: number): number => rnd(clamp(Number.isFinite(n) ? n : 0, 0, max), 1);
    const food: CustomFood = { id: `c:${uid()}`, isSystem: false, names, unit: input.unit, k: macro(input.k, MAX_KCAL), p: macro(input.p, MAX_MACRO), c: macro(input.c, MAX_MACRO), f: macro(input.f, MAX_MACRO) };
    this.store.mutate((s) => (s.customFoods[food.id] = food));
    return true;
  }

  /** Deletes a user food; system foods (and unknown ids) are refused. */
  remove(id: string): boolean {
    if (!(id in this.store.state().customFoods)) return false;
    this.store.mutate((s) => delete s.customFoods[id]);
    return true;
  }

  /** Meal item for `amt` of a food: a reference to the system food, or a self-contained snapshot for a user food. */
  toMealItem(id: string, amt: number): MealItem {
    const e = this.find(id);
    if (!e || e.isSystem) return { food: id, amt, base: amt };
    const m = e.unit === 'q' ? amt / 100 : amt;
    return { name: e.name, amt: 1, k: rnd(e.k * m, 1), p: rnd(e.p * m, 1), c: rnd(e.c * m, 1), f: rnd(e.f * m, 1), amtLabel: `${rnd(amt, 1)} ${td(e.unit)}` };
  }
}
