import { foodNameOf, foodOf } from './food-book';
import { Macros, Meal, MealItem, Unit } from '../common/interfaces';
import { rnd, toMin } from './utils';
import { td } from './i18n/translate';

const ZERO: Macros = { k: 0, p: 0, c: 0, f: 0 };

/** The units a food can be counted in, in the order they are offered. */
export const UNITS: readonly Unit[] = ['q', 'ml', 'ədəd', 'x/q', 'ç.q', 'ölçü'];

/** The numbers of a food counted in grams or millilitres are per 100 of them; in any other unit, per one. */
export const per100 = (unit: Unit | undefined): boolean => unit === 'q' || unit === 'ml';

export function itemMacros(it: MealItem): Macros {
  // A food of the list, or a food typed in with its numbers per unit (`unit` and `per`, no code).
  if (it.food || (it.unit && it.per)) {
    // The snapshot in the item wins; items saved before snapshots existed use the current food list.
    const listed = it.food ? foodOf(it.food) : undefined;
    const f = it.per ?? listed;
    const unit = it.unit ?? listed?.unit;
    if (!f || !unit) return ZERO;
    const m = per100(unit) ? it.amt / 100 : it.amt;
    return { k: f.k * m, p: f.p * m, c: f.c * m, f: f.f * m };
  }
  return { k: Number(it.k) || 0, p: Number(it.p) || 0, c: Number(it.c) || 0, f: Number(it.f) || 0 };
}

/**
 * The foods of a trainer-plan meal that were really entered. A meal that was only given a name was saved with one placeholder item
 * (the name, all numbers 0) so it has something to show; the editor does not list that one, and puts it back when nothing else is left.
 */
export const realItems = (meal: { name: string; items: MealItem[] }): MealItem[] =>
  meal.items.filter((it) => !(!it.food && !it.k && !it.p && !it.c && !it.f && (it.name ?? '') === meal.name));

/**
 * A name for a meal made of its foods: each with its amount, in alphabetical order, joined with " + " ("Badam 20 q + Yumurta 15 ədəd");
 * "" without foods. A food typed in by hand has no amount of its own ("1 porsiya"), so only its name is used.
 */
export const mealNameFromItems = (items: MealItem[]): string =>
  items
    .map((it) => ({ name: itemName(it), label: it.food || it.unit || (it.amtLabel && it.amtLabel !== '1 porsiya') ? `${itemName(it)} ${itemAmount(it)}` : itemName(it) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'az'))
    .map((x) => x.label)
    .join(' + ');

/**
 * Adds a food to the foods of a meal. A food of the reference list that is already there only gets more of it (its amount grows,
 * one line stays), and so does a typed-in food with the same name, unit and numbers; anything else is a new line.
 */
export function addItem(items: MealItem[], item: MealItem): MealItem[] {
  const same = (x: MealItem): boolean =>
    item.food ? x.food === item.food : !!item.unit && !x.food && x.unit === item.unit && x.name === item.name && JSON.stringify(x.per) === JSON.stringify(item.per);
  const i = items.findIndex(same);
  if (i < 0) return [...items, item];
  return items.map((x, j) => (j === i ? { ...x, amt: rnd(x.amt + item.amt, 2) } : x));
}

export const sumMacros = (list: Macros[]): Macros =>
  list.reduce((a, m) => ({ k: a.k + m.k, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }), ZERO);

export const mealMacros = (m: Meal): Macros => sumMacros(m.items.map(itemMacros));

export const menuTotals = (menu: Meal[] | null | undefined, onlyDone = false): Macros =>
  sumMacros((menu ?? []).filter((m) => !onlyDone || m.done).map(mealMacros));

/** Name of a meal item in the active language: a system food from the food list, a custom item as it was saved. */
export const itemName = (it: MealItem): string => (it.food ? foodNameOf(it.food) : td(it.name ?? ''));

export const itemAmount = (it: MealItem): string => {
  if (!it.food && !it.unit) return td(it.amtLabel ?? '1 porsiya');
  return `${rnd(it.amt, 1)} ${td(it.unit ?? foodOf(it.food ?? '')?.unit ?? '')}`;
};

/** Sleep duration in minutes (handles crossing midnight). */
export function sleepMinutes(sl: { bed: string; wake: string } | null | undefined): number | null {
  if (!sl || !sl.bed || !sl.wake) return null;
  let d = toMin(sl.wake) - toMin(sl.bed);
  if (d <= 0) d += 1440;
  return d;
}
