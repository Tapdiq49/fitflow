import { TestBed } from '@angular/core/testing';
import { FOOD_IDS } from '../data/foods';
import { activeLang } from '../utils';
import { itemMacros, itemName } from '../nutrition';
import { FoodCatalogService } from './food-catalog.service';
import { StoreService } from './store.service';

describe('FoodCatalogService', () => {
  let catalog: FoodCatalogService;
  let store: StoreService;
  const milkshake = { names: { az: 'Süd kokteyli', en: 'Milkshake' }, unit: 'q' as const, k: 200, p: 8, c: 30, f: 5 };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    catalog = TestBed.inject(FoodCatalogService);
    store = TestBed.inject(StoreService);
  });

  afterEach(() => activeLang.set('az'));

  it('lists every built-in food as a locked system entry, before the user\'s own', () => {
    catalog.add(milkshake);
    const entries = catalog.entries();
    expect(entries.filter((e) => e.isSystem).map((e) => e.id)).toEqual(FOOD_IDS);
    expect(entries.at(-1)).toMatchObject({ isSystem: false, name: 'Süd kokteyli', k: 200 });
  });

  it('refuses to delete a system food but deletes the user\'s own', () => {
    catalog.add(milkshake);
    const own = catalog.entries().find((e) => !e.isSystem)!;
    expect(catalog.remove('chicken')).toBe(false);
    expect(catalog.remove('nope')).toBe(false);
    expect(catalog.entries().some((e) => e.id === 'chicken')).toBe(true);
    expect(catalog.remove(own.id)).toBe(true);
    expect(catalog.entries().some((e) => e.id === own.id)).toBe(false);
  });

  it('needs an Azerbaijani name and clamps macros', () => {
    expect(catalog.add({ ...milkshake, names: { en: 'Only English' } })).toBe(false);
    expect(catalog.add({ ...milkshake, names: { az: '   ' } })).toBe(false);
    expect(catalog.add({ ...milkshake, k: 99999, p: -5, c: NaN })).toBe(true);
    expect(catalog.entries().at(-1)).toMatchObject({ k: 1000, p: 0, c: 0 });
  });

  it('shows the name in the active language and falls back to Azerbaijani', () => {
    catalog.add(milkshake);
    catalog.add({ ...milkshake, names: { az: 'Yalnız AZ' } });
    activeLang.set('en');
    const [first, second] = catalog.entries().filter((e) => !e.isSystem);
    expect([first.name, second.name]).toEqual(['Milkshake', 'Yalnız AZ']);
    activeLang.set('ru');
    expect(catalog.entries().filter((e) => !e.isSystem)[0].name).toBe('Süd kokteyli');
  });

  it('keeps user foods in the saved state and loads older backups without them', () => {
    catalog.add(milkshake);
    expect(Object.keys(store.state().customFoods)).toHaveLength(1);
    const reloaded = StoreService.normalize(JSON.parse(store.exportJson()));
    expect(Object.values(reloaded.customFoods)[0]).toMatchObject({ isSystem: false, names: milkshake.names });
    expect(StoreService.normalize({ days: {} }).customFoods).toEqual({});
  });

  it('turns a user food into a self-contained meal item that survives deleting the food', () => {
    catalog.add(milkshake);
    const own = catalog.entries().find((e) => !e.isSystem)!;
    const item = catalog.toMealItem(own.id, 150); // 150 g of 200 kcal / 100 g
    expect(itemMacros(item)).toEqual({ k: 300, p: 12, c: 45, f: 7.5 });
    expect(itemName(item)).toBe('Süd kokteyli');
    catalog.remove(own.id);
    expect(itemMacros(item).k).toBe(300);
  });

  it('keeps a system food as a reference item so the menu generator data stays the single source', () => {
    expect(catalog.toMealItem('chicken', 150)).toEqual({ food: 'chicken', amt: 150, base: 150 });
  });
});
