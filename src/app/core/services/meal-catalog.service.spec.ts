import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { FakeAuthService } from '../auth/fake-auth.service';
import { TEMPLATES } from '../data/meals';
import { contentNames, td } from '../i18n/translate';
import { systemMealTemplates, templatesOf } from '../meal-book';
import { FakeMealRepository } from '../repositories/fake-meal.repository';
import { MealRepository, MealRow } from '../repositories/meal.repository';
import { MealCatalogService, NewMeal } from './meal-catalog.service';
import { StoreService } from './store.service';

const row = (code: string, slot: MealRow['slot'], position: number, az: string, items: [string, number][] = [['egg', 2]]): MealRow => ({
  id: `id-${code}`,
  code,
  slot,
  position,
  names: { az, en: `${az} EN` },
  main: null,
  light: false,
  items,
});

const meal = (over: Partial<NewMeal> = {}): NewMeal => ({ names: { az: 'Yeni yemək', en: 'New meal' }, slot: 'lunch', main: null, light: false, items: [['rice', 200], ['chicken', 150]], ...over });

describe('MealCatalogService', () => {
  let repo: FakeMealRepository;
  let catalog: MealCatalogService;

  beforeEach(() => {
    localStorage.clear();
    systemMealTemplates.set([]);
    contentNames.set(new Map());
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useClass: FakeAuthService }, { provide: MealRepository, useClass: FakeMealRepository }] });
    repo = TestBed.inject(MealRepository) as FakeMealRepository;
    repo.rows = [row('b1', 'breakfast', 1, 'Səhər A'), row('b2', 'breakfast', 2, 'Səhər B'), row('l1', 'lunch', 1, 'Nahar A')];
    catalog = TestBed.inject(MealCatalogService);
  });

  afterEach(() => {
    systemMealTemplates.set([]);
    contentNames.set(new Map());
  });

  it('shows the built-in templates until the backend has been read', () => {
    expect(catalog.entries()).toHaveLength(Object.values(TEMPLATES).flat().length);
    expect(templatesOf('breakfast').map((t) => t.id)).toEqual(TEMPLATES.breakfast.map((t) => t.id));
  });

  it('publishes what the backend returns to the menu generator and keeps a copy in the saved state', async () => {
    await catalog.refresh();
    expect(catalog.entries().map((e) => e.id)).toEqual(['b1', 'b2', 'l1']);
    expect(templatesOf('breakfast').map((t) => t.name)).toEqual(['Səhər A', 'Səhər B']);
    expect(TestBed.inject(StoreService).state().mealCache.map((t) => t.code)).toEqual(['b1', 'b2', 'l1']);
  });

  it('names a meal in the active language through the shared name lookup', async () => {
    await catalog.refresh();
    expect(td('Səhər A')).toBe('Səhər A'); // Azerbaijani is the active language
    expect(contentNames().get('Səhər A')?.en).toBe('Səhər A EN');
  });

  it('adds a template at the end of its pool, with the foods checked', async () => {
    await catalog.refresh();
    expect(await catalog.add(meal({ slot: 'breakfast' }))).toBe(true);
    const added = catalog.entries().filter((e) => e.slot === 'breakfast').at(-1)!;
    expect(added.position).toBe(3);
    expect(added.macros.k).toBeGreaterThan(0);
    expect(templatesOf('breakfast')).toHaveLength(3);
    expect(await catalog.add(meal({ names: { az: '  ' } }))).toBe(false); // no Azerbaijani name
    expect(await catalog.add(meal({ items: [['nothing-like-this', 100]] }))).toBe(false); // food that does not exist
    expect(await catalog.add(meal({ items: [] }))).toBe(false);
  });

  it('changes a template and moves it to another pool', async () => {
    await catalog.refresh();
    expect(await catalog.update('b2', meal({ slot: 'dinner', names: { az: 'Axşam' } }))).toBe(true);
    expect(catalog.find('b2')?.slot).toBe('dinner');
    expect(templatesOf('dinner').map((t) => t.name)).toEqual(['Axşam']);
    expect(await catalog.update('missing', meal())).toBe(false);
  });

  it('never deletes the last template of a pool', async () => {
    await catalog.refresh();
    expect(await catalog.remove('l1')).toBe(false);
    expect(await catalog.remove('b2')).toBe(true);
    expect(catalog.entries().map((e) => e.id)).toEqual(['b1', 'l1']);
    expect(await catalog.remove('b1')).toBe(false);
    expect(await catalog.update('b1', meal({ slot: 'lunch' }))).toBe(false); // would empty the breakfast pool
  });

  it('lets the backend refuse a write: nothing changes here', async () => {
    await catalog.refresh();
    repo.denied = true;
    await expect(catalog.add(meal())).rejects.toMatchObject({ code: 'forbidden' });
    await expect(catalog.remove('b2')).rejects.toMatchObject({ code: 'forbidden' });
    expect(catalog.entries().map((e) => e.id)).toEqual(['b1', 'b2', 'l1']);
  });

  it('keeps working from the saved copy when the backend cannot be reached', async () => {
    await catalog.refresh();
    repo.failing = true;
    await catalog.refresh();
    expect(catalog.loadFailed()).toBe(true);
    expect(templatesOf('lunch').map((t) => t.id)).toEqual(['l1']);
  });

  it('falls back to the built-in templates for a pool the backend left empty', async () => {
    await catalog.refresh();
    expect(templatesOf('dinner').map((t) => t.id)).toEqual(TEMPLATES.dinner.map((t) => t.id));
  });
});
