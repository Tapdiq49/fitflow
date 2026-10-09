import { MealItem } from '../common/interfaces';
import { UNITS, addItem, itemAmount, itemMacros, per100, mealMacros, mealNameFromItems, realItems, sumMacros } from './nutrition';

const egg = (amt: number): MealItem => ({ food: 'egg', amt, unit: 'ədəd', per: { k: 78, p: 6.3, c: 0.6, f: 5.3 } });
const almond = (g: number): MealItem => ({ food: 'almond', amt: g, unit: 'q', per: { k: 579, p: 21, c: 22, f: 50 } });

describe('item and meal macros', () => {
  it('multiplies a per-piece food by the number of pieces', () => {
    const m = itemMacros(egg(2));
    expect(m.k).toBeCloseTo(156, 5);
    expect(m.p).toBeCloseTo(12.6, 5);
    expect(m.f).toBeCloseTo(10.6, 5);
  });

  it('works a food per 100 g out for the grams eaten', () => {
    const m = itemMacros(almond(6));
    expect(m.k).toBeCloseTo(34.74, 5);
    expect(m.p).toBeCloseTo(1.26, 5);
  });

  it('takes a typed-in food as it is, and an empty number as 0', () => {
    expect(itemMacros({ name: 'Çay', amt: 1, k: 20, p: 0, c: 4, f: undefined })).toEqual({ k: 20, p: 0, c: 4, f: 0 });
  });

  it('adds the foods of a meal together', () => {
    const total = mealMacros({ id: 'm', slot: 'breakfast', name: 'Səhər', time: '08:00', done: false, items: [egg(2), almond(6)] });
    expect(total.k).toBeCloseTo(156 + 34.74, 5);
    expect(sumMacros([itemMacros(egg(1)), itemMacros(egg(1))]).k).toBeCloseTo(156, 5);
  });
});

describe('units', () => {
  it('counts millilitres like grams, per 100, and tablespoons and teaspoons like pieces, per one', () => {
    const milk: MealItem = { food: 'milk', amt: 250, unit: 'ml', per: { k: 60, p: 3.2, c: 4.8, f: 3.3 } };
    expect(itemMacros(milk).k).toBeCloseTo(150, 5);
    const honey: MealItem = { food: 'honey', amt: 2, unit: 'x/q', per: { k: 64, p: 0, c: 17, f: 0 } };
    expect(itemMacros(honey).k).toBeCloseTo(128, 5);
    const sugar: MealItem = { food: 'sugar', amt: 3, unit: 'ç.q', per: { k: 16, p: 0, c: 4, f: 0 } };
    expect(itemMacros(sugar).c).toBeCloseTo(12, 5);
    expect(UNITS.filter(per100)).toEqual(['q', 'ml']);
  });

  it('works a typed-in food with a unit out like a food of the list, and shows its amount', () => {
    const oil: MealItem = { name: 'Zeytun yağı', amt: 2, unit: 'x/q', per: { k: 119, p: 0, c: 0, f: 13.5 } };
    expect(itemMacros(oil).k).toBeCloseTo(238, 5);
    expect(itemMacros(oil).f).toBeCloseTo(27, 5);
    expect(itemAmount(oil)).toContain('2');
  });
});

describe('addItem', () => {
  it('adds more of a food that is already in the meal instead of a second line', () => {
    const list = addItem(addItem([], egg(1)), egg(2));
    expect(list).toHaveLength(1);
    expect(list[0].amt).toBe(3);
    expect(itemMacros(list[0]).k).toBeCloseTo(234, 5);
  });

  it('adds up grams too, and keeps different foods on their own lines', () => {
    const list = addItem(addItem(addItem([], almond(5)), almond(10)), egg(1));
    expect(list.map((i) => [i.food, i.amt])).toEqual([['almond', 15], ['egg', 1]]);
  });

  it('adds up a typed-in food with the same name, unit and numbers', () => {
    const oil = (amt: number): MealItem => ({ name: 'Zeytun yağı', amt, unit: 'x/q', per: { k: 119, p: 0, c: 0, f: 13.5 } });
    const list = addItem(addItem([], oil(1)), oil(2));
    expect(list).toHaveLength(1);
    expect(list[0].amt).toBe(3);
    expect(addItem(list, { ...oil(1), per: { k: 100, p: 0, c: 0, f: 10 } })).toHaveLength(2);
  });

  it('keeps typed-in foods as separate lines', () => {
    const tea: MealItem = { name: 'Çay', amt: 1, k: 20, p: 0, c: 4, f: 0 };
    expect(addItem([tea], tea)).toHaveLength(2);
  });
});

describe('mealNameFromItems', () => {
  const food = (name: string): MealItem => ({ name, amt: 1, k: 1, p: 0, c: 0, f: 0 });

  it('joins the names of the foods with a plus, in alphabetical order', () => {
    expect(mealNameFromItems([food('Yumurta'), food('Badam'), food('Çay')])).toBe('Badam + Çay + Yumurta');
  });

  it('puts the amount after the name of a food from the list', () => {
    expect(mealNameFromItems([egg(15), almond(20)])).toBe('Badam 20 q + Yumurta 15 ədəd');
  });

  it('lists every line and gives an empty name for no foods', () => {
    expect(mealNameFromItems([food('Yumurta'), food('Yumurta')])).toBe('Yumurta + Yumurta');
    expect(mealNameFromItems([])).toBe('');
  });
});

describe('realItems', () => {
  const placeholder = (name: string): MealItem => ({ amt: 1, name, amtLabel: '', k: 0, p: 0, c: 0, f: 0 });

  it('leaves out the placeholder item of a meal that only has a name', () => {
    expect(realItems({ name: 'Yumurta və badam', items: [placeholder('Yumurta və badam')] })).toEqual([]);
  });

  it('keeps real foods, also a typed-in one that has numbers or another name', () => {
    const typed: MealItem = { name: 'Çay', amt: 1, k: 20, p: 0, c: 4, f: 0 };
    expect(realItems({ name: 'Səhər', items: [egg(2), typed, placeholder('Səhər')] })).toEqual([egg(2), typed]);
    expect(realItems({ name: 'Səhər', items: [placeholder('Başqa ad')] })).toHaveLength(1);
  });
});
