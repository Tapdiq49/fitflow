import { TestBed } from '@angular/core/testing';
import { AuthUser } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { FakeAuthService } from '../auth/fake-auth.service';
import { FOOD_IDS } from '../data/foods';
import { FakeFoodRepository } from '../repositories/fake-food.repository';
import { FoodRepository, FoodRow } from '../repositories/food.repository';
import { activeLang } from '../utils';
import { systemFoods } from '../food-book';
import { itemMacros, itemName } from '../nutrition';
import { FoodCatalogService } from './food-catalog.service';
import { StoreService } from './store.service';

const USER: AuthUser = { id: 'u1', email: 'a@example.com', username: 'john', emailPreferences: false, avatar: null, hasPassword: true };
const row = (id: string, code: string | null, az: string, extra: Partial<FoodRow> = {}): FoodRow => ({ id, code, names: { az, en: `${az} EN` }, unit: 'q', k: 100, p: 10, c: 10, f: 1, role: null, step: null, min: null, max: null, position: null, ...extra });
const GEN = { role: 'protein', step: 1, min: 1, max: 4 } as const;

describe('FoodCatalogService', () => {
  let catalog: FoodCatalogService;
  let repo: FakeFoodRepository;
  let auth: FakeAuthService;
  const milkshake = { names: { az: 'Süd kokteyli', en: 'Milkshake' }, unit: 'q' as const, k: 200, p: 8, c: 30, f: 5 };

  beforeEach(() => {
    localStorage.clear();
    repo = new FakeFoodRepository();
    auth = new FakeAuthService();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: FoodRepository, useValue: repo },
      ],
    });
    catalog = TestBed.inject(FoodCatalogService);
  });

  afterEach(() => {
    activeLang.set('az');
    systemFoods.set([]);
  });

  const signIn = async (): Promise<void> => {
    auth.stored = USER;
    await TestBed.inject(AuthStore).init();
    await catalog.refresh();
  };

  describe('as a guest', () => {
    it('lists every built-in food as a locked system entry', () => {
      const entries = catalog.entries();
      expect(entries.map((e) => e.id)).toEqual(FOOD_IDS);
      expect(entries.every((e) => e.isSystem)).toBe(true);
    });

    it('cannot add a food (adding needs an account) and cannot delete a system food', async () => {
      await expect(catalog.add(milkshake)).rejects.toThrow();
      expect(await catalog.remove('chicken')).toBe(false);
      expect(await catalog.remove('nope')).toBe(false);
      expect(catalog.entries().some((e) => e.id === 'chicken')).toBe(true);
    });

    it('keeps a built-in food as a reference item so the menu generator data stays the single source', () => {
      expect(catalog.toMealItem('chicken', 150)).toEqual({ food: 'chicken', amt: 150, base: 150, unit: 'q', per: { k: 165, p: 31, c: 0, f: 3.6 } });
    });

    it('no longer reads user foods from the saved state, and old backups still load', () => {
      const old = { days: {}, customFoods: { 'c:1': { id: 'c:1', names: { az: 'Köhnə' } } } };
      expect(Object.keys(StoreService.normalize(old))).not.toContain('customFoods');
    });
  });

  describe('with the backend', () => {
    it('shows the system foods the backend returns, built-in ones in their usual order', async () => {
      repo.rows = [row('2', 'zzz-new', 'Yeni qida', GEN), row('1', 'egg', 'Yumurta', GEN)];
      await catalog.refresh();
      expect(catalog.entries().filter((e) => e.isSystem).map((e) => e.id)).toEqual(['egg', 'zzz-new']);
      activeLang.set('en');
      expect(catalog.find('egg')?.name).toBe('Yumurta EN');
      expect(catalog.loadFailed()).toBe(false);
    });

    it('names meal items from the backend list in the active language, and from the built-in texts without it', async () => {
      const egg = { food: 'egg', amt: 2 };
      activeLang.set('en');
      expect(itemName(egg)).toBe('Egg'); // built-in text, nothing loaded yet
      repo.rows = [row('1', 'egg', 'Yumurta', { ...GEN, names: { az: 'Yumurta', en: 'Backend egg' } })];
      await catalog.refresh();
      expect(itemName(egg)).toBe('Backend egg');
      activeLang.set('ru');
      expect(itemName(egg)).toBe('Yumurta'); // no Russian text: Azerbaijani source
      expect(itemName({ amt: 1, name: 'Mənim qidam' })).toBe('Mənim qidam');
      repo.failing = true;
      await catalog.refresh();
      activeLang.set('en');
      expect(itemName(egg)).toBe('Backend egg'); // the last list read stays in use
    });

    it('keeps the code and a macro snapshot for a backend system food the generator can use', async () => {
      repo.rows = [row('1', 'zzz-new', 'Yeni qida', { ...GEN, k: 200 })];
      await catalog.refresh();
      expect(catalog.toMealItem('zzz-new', 100)).toEqual({ food: 'zzz-new', amt: 100, base: 100, unit: 'q', per: { k: 200, p: 10, c: 10, f: 1 } });
    });

    it('turns a backend system food without generator fields into a self-contained item', async () => {
      repo.rows = [row('1', 'zzz-new', 'Yeni qida', { k: 200 })];
      await catalog.refresh();
      const item = catalog.toMealItem('zzz-new', 100);
      expect(item.food).toBeUndefined();
      expect(itemMacros(item).k).toBe(200);
    });

    it('keeps a copy of the system foods in the saved state, and uses it when the backend is unreachable at start', async () => {
      repo.rows = [row('1', 'egg', 'Yumurta', { ...GEN, names: { az: 'Yumurta', en: 'Saved egg' } }), row('2', 'xyz', 'Yalnız backend', GEN)];
      await catalog.refresh();
      expect(TestBed.inject(StoreService).state().foodCache.map((x) => x.code)).toEqual(['egg', 'xyz']);

      // A fresh start (same saved state), backend down.
      TestBed.resetTestingModule();
      systemFoods.set([]);
      const down = new FakeFoodRepository();
      down.failing = true;
      TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: new FakeAuthService() }, { provide: FoodRepository, useValue: down }] });
      const restarted = TestBed.inject(FoodCatalogService);
      expect(systemFoods().map((x) => x.code)).toEqual(['egg', 'xyz']);
      await restarted.refresh();
      expect(restarted.loadFailed()).toBe(true);
      expect(restarted.entries().map((e) => e.id)).toEqual(['egg', 'xyz']);
      activeLang.set('en');
      expect(itemName({ food: 'egg', amt: 1 })).toBe('Saved egg');
    });

    it('falls back to the built-in list and says so when the backend cannot be reached', async () => {
      repo.failing = true;
      await catalog.refresh();
      expect(catalog.entries().filter((e) => e.isSystem).map((e) => e.id)).toEqual(FOOD_IDS);
      expect(catalog.loadFailed()).toBe(true);
    });

    it('keeps a signed-in user\'s foods in the backend, and shows only their own', async () => {
      repo.rows = [row('1', 'egg', 'Yumurta'), row('9', null, 'Mənim qidam')];
      await signIn();
      expect(catalog.entries().filter((e) => !e.isSystem).map((e) => e.name)).toEqual(['Mənim qidam']);

      expect(await catalog.add(milkshake)).toBe(true);
      expect(repo.rows.filter((r) => r.code === null).map((r) => r.names.az)).toEqual(['Mənim qidam', 'Süd kokteyli']);

      const added = catalog.entries().find((e) => e.name === 'Süd kokteyli')!;
      expect(await catalog.remove(added.id)).toBe(true);
      expect(repo.rows.some((r) => r.names.az === 'Süd kokteyli')).toBe(false);
      expect(await catalog.remove('egg')).toBe(false);
    });

    it('hides the user\'s foods again after signing out', async () => {
      repo.rows = [row('9', null, 'Mənim qidam')];
      await signIn();
      expect(catalog.entries().some((e) => e.name === 'Mənim qidam')).toBe(true);
      await TestBed.inject(AuthStore).signOut();
      expect(catalog.entries().some((e) => e.name === 'Mənim qidam')).toBe(false);
    });

    it('needs an Azerbaijani name and clamps macros', async () => {
      await signIn();
      expect(await catalog.add({ ...milkshake, names: { en: 'Only English' } })).toBe(false);
      expect(await catalog.add({ ...milkshake, names: { az: '   ' } })).toBe(false);
      expect(await catalog.add({ ...milkshake, k: 99999, p: -5, c: NaN })).toBe(true);
      expect(catalog.entries().at(-1)).toMatchObject({ k: 1000, p: 0, c: 0 });
    });

    it('shows the name in the active language and falls back to Azerbaijani', async () => {
      await signIn();
      await catalog.add(milkshake);
      await catalog.add({ ...milkshake, names: { az: 'Yalnız AZ' } });
      activeLang.set('en');
      expect(catalog.entries().filter((e) => !e.isSystem).map((e) => e.name)).toEqual(['Milkshake', 'Yalnız AZ']);
      activeLang.set('ru');
      expect(catalog.entries().filter((e) => !e.isSystem)[0].name).toBe('Süd kokteyli');
    });

    it('turns a user food into a self-contained meal item that survives deleting the food', async () => {
      await signIn();
      await catalog.add(milkshake);
      const own = catalog.entries().find((e) => !e.isSystem)!;
      const item = catalog.toMealItem(own.id, 150); // 150 g of 200 kcal / 100 g
      expect(itemMacros(item)).toEqual({ k: 300, p: 12, c: 45, f: 7.5 });
      expect(itemName(item)).toBe('Süd kokteyli');
      await catalog.remove(own.id);
      expect(itemMacros(item).k).toBe(300);
    });

    it('changes one of the user\'s own foods, but never a system food', async () => {
      repo.rows = [row('1', 'egg', 'Yumurta', GEN)];
      await signIn();
      await catalog.add(milkshake);
      const own = catalog.entries().find((e) => !e.isSystem)!;

      expect(await catalog.update(own.id, { ...milkshake, names: { az: 'Yeni ad', en: 'New name' }, k: 250 })).toBe(true);
      expect(catalog.find(own.id)).toMatchObject({ name: 'Yeni ad', k: 250 });
      expect(repo.rows.find((r) => r.id === own.id)?.names).toEqual({ az: 'Yeni ad', en: 'New name' });
      expect(catalog.own(own.id)?.names.en).toBe('New name');

      expect(await catalog.update('egg', milkshake)).toBe(false); // system food
      expect(await catalog.update('nope', milkshake)).toBe(false);
      expect(await catalog.update(own.id, { ...milkshake, names: { az: '  ' } })).toBe(false); // name is required
      expect(catalog.find(own.id)?.name).toBe('Yeni ad');
    });

    it('keeps an edit away from saved menus: an item made earlier keeps its numbers', async () => {
      await signIn();
      await catalog.add(milkshake);
      const own = catalog.entries().find((e) => !e.isSystem)!;
      const item = catalog.toMealItem(own.id, 100);
      await catalog.update(own.id, { ...milkshake, k: 999 });
      expect(itemMacros(item).k).toBe(200);
    });

    it('moves a food to the place of another and re-reads the list; a refused move changes nothing', async () => {
      await signIn();
      for (const az of ['Bir', 'İki', 'Üç']) await catalog.add({ ...milkshake, names: { az } });
      const names = (): string[] => catalog.entries().filter((e) => !e.isSystem).map((e) => e.name);
      expect(names()).toEqual(['Bir', 'İki', 'Üç']);
      const [a, , c] = catalog.entries().filter((e) => !e.isSystem);

      await catalog.move(c.id, a.id);
      expect(names()).toEqual(['Üç', 'Bir', 'İki']);

      repo.failAdd = true;
      await expect(catalog.move(a.id, c.id)).rejects.toThrow();
      expect(names()).toEqual(['Üç', 'Bir', 'İki']);
    });

    it('lets a system food be moved too (its row id is not its code)', async () => {
      repo.rows = [row('1', 'milk', 'Süd', GEN), row('2', 'egg', 'Yumurta', GEN)];
      await signIn();
      await catalog.move('2', '1');
      expect(repo.rows.find((r) => r.id === '2')?.position).toBe(1);
      expect(repo.rows.find((r) => r.id === '1')?.position).toBe(2);
    });

    it('lets the caller know when the backend refuses a new food', async () => {
      await signIn();
      repo.failAdd = true;
      await expect(catalog.add(milkshake)).rejects.toThrow();
      expect(catalog.entries().some((e) => !e.isSystem)).toBe(false);
    });
  });
});
