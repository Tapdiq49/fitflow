import { TestBed } from '@angular/core/testing';
import { foodItem, foodNameOf, foodOf, systemFoods } from './food-book';
import { itemAmount, itemMacros, itemName } from './nutrition';
import { DayService } from './services/day.service';
import { StoreService } from './services/store.service';
import { MealItem, SystemFood } from './models';
import { DateU, activeLang } from './utils';

const EGG: SystemFood = { code: 'egg', names: { az: 'Yumurta', en: 'Backend egg' }, unit: 'ədəd', k: 100, p: 7, c: 1, f: 6, role: 'protein', step: 1, min: 1, max: 4 };

describe('food book', () => {
  afterEach(() => {
    systemFoods.set([]);
    activeLang.set('az');
  });

  it('uses the bundled foods until the backend list has been published', () => {
    expect(foodOf('chicken')).toMatchObject({ unit: 'q', k: 165, role: 'protein', step: 20 });
    expect(foodOf('nope')).toBeUndefined();
    expect(itemName({ food: 'chicken', amt: 100 })).toBe('Toyuq döşü (bişmiş)');
  });

  it('prefers the published list, in the active language', () => {
    systemFoods.set([EGG]);
    expect(foodOf('egg')).toMatchObject({ k: 100 });
    activeLang.set('en');
    expect(foodNameOf('egg')).toBe('Backend egg');
    activeLang.set('ru');
    expect(foodNameOf('egg')).toBe('Yumurta'); // no Russian text: Azerbaijani source
  });

  it('copies unit and macros into a new item, and that copy wins over later changes of the list', () => {
    systemFoods.set([EGG]);
    const item = foodItem('egg', 2);
    expect(item).toEqual({ food: 'egg', amt: 2, base: 2, unit: 'ədəd', per: { k: 100, p: 7, c: 1, f: 6 } });
    expect(itemMacros(item)).toEqual({ k: 200, p: 14, c: 2, f: 12 });

    systemFoods.set([{ ...EGG, k: 999, unit: 'q' }]); // the food list changes later
    expect(itemMacros(item).k).toBe(200); // the saved item keeps its numbers
    expect(itemAmount(item)).toBe('2 ədəd');
  });

  it('still reads items saved before snapshots existed from the current list', () => {
    systemFoods.set([EGG]);
    expect(itemMacros({ food: 'egg', amt: 3 }).k).toBe(300);
    expect(itemMacros({ food: 'unknown', amt: 3 })).toEqual({ k: 0, p: 0, c: 0, f: 0 });
  });

  it('puts a snapshot on every food of a generated menu', () => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    const store = TestBed.inject(StoreService);
    const day = TestBed.inject(DayService);
    store.mutate((s) => (s.settings.menuMode = 'auto'));
    const items: MealItem[] = [];
    for (let i = 0; i < 7; i++) {
      const k = DateU.add('2026-10-05', i);
      day.ensureDay(k);
      items.push(...(store.peek(k)?.menu ?? []).flatMap((m) => m.items).filter((it) => it.food));
    }
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((it) => it.unit && it.per)).toBe(true);
  });
});
