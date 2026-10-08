import { signal } from '@angular/core';
import { FOODS } from './data/foods';
import { td } from './i18n/translate';
import { FoodRole, MealItem, SystemFood, Unit } from '../common/interfaces';
import { activeLang } from './utils';

/** What the menu generator and the macro math need to know about a system food. */
export interface BookFood {
  unit: Unit;
  /** Per 100 g when the unit is 'q', per single unit otherwise. */
  k: number;
  p: number;
  c: number;
  f: number;
  role: FoodRole;
  step: number;
  min: number;
  max: number;
}

/**
 * The system foods the app works with, from the backend (published by FoodCatalogService: the saved copy at start, the
 * live list once it has been read). A signal, like `activeLang`, so names follow loads and language switches.
 * Until anything has been published (first visit without a connection) `data/foods.ts` is the last-resort copy.
 */
export const systemFoods = signal<readonly SystemFood[]>([]);

export function foodOf(code: string): BookFood | undefined {
  const live = systemFoods().find((x) => x.code === code);
  if (live) return live;
  return Object.hasOwn(FOODS, code) ? FOODS[code] : undefined;
}

/** Name of a system food in the active language (Azerbaijani, the source language, when that language has none). */
export function foodNameOf(code: string): string {
  const names = systemFoods().find((x) => x.code === code)?.names;
  return names?.[activeLang()] || names?.az || td(Object.hasOwn(FOODS, code) ? FOODS[code].name : code);
}

/**
 * Meal item for `amt` of a system food. The unit and the macros are copied into the item, so a saved menu keeps its
 * numbers when the food list changes later (past days stay frozen).
 */
export function foodItem(code: string, amt: number): MealItem {
  const f = foodOf(code);
  const item: MealItem = { food: code, amt, base: amt };
  if (f) {
    item.unit = f.unit;
    item.per = { k: f.k, p: f.p, c: f.c, f: f.f };
  }
  return item;
}
