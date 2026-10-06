import { FOODS } from './data/foods';
import { Macros, Meal, MealItem } from './models';
import { rnd, toMin } from './utils';
import { td } from './i18n/translate';

const ZERO: Macros = { k: 0, p: 0, c: 0, f: 0 };

export function itemMacros(it: MealItem): Macros {
  if (it.food) {
    const f = FOODS[it.food];
    if (!f) return ZERO;
    const m = f.unit === 'q' ? it.amt / 100 : it.amt;
    return { k: f.k * m, p: f.p * m, c: f.c * m, f: f.f * m };
  }
  return { k: Number(it.k) || 0, p: Number(it.p) || 0, c: Number(it.c) || 0, f: Number(it.f) || 0 };
}

export const sumMacros = (list: Macros[]): Macros =>
  list.reduce((a, m) => ({ k: a.k + m.k, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }), ZERO);

export const mealMacros = (m: Meal): Macros => sumMacros(m.items.map(itemMacros));

export const menuTotals = (menu: Meal[] | null | undefined, onlyDone = false): Macros =>
  sumMacros((menu ?? []).filter((m) => !onlyDone || m.done).map(mealMacros));

export const itemName = (it: MealItem): string => td(it.food ? (FOODS[it.food]?.name ?? it.food) : (it.name ?? ''));

export const itemAmount = (it: MealItem): string => {
  if (!it.food) return td(it.amtLabel ?? '1 porsiya');
  return `${rnd(it.amt, 1)} ${td(FOODS[it.food]?.unit ?? '')}`;
};

/** Sleep duration in minutes (handles crossing midnight). */
export function sleepMinutes(sl: { bed: string; wake: string } | null | undefined): number | null {
  if (!sl || !sl.bed || !sl.wake) return null;
  let d = toMin(sl.wake) - toMin(sl.bed);
  if (d <= 0) d += 1440;
  return d;
}
