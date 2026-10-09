import { MealItem } from '../common/interfaces';
import { itemMacros, mealMacros, realItems, sumMacros } from './nutrition';

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
