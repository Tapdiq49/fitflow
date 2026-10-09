import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { AuthUser } from '../../common/interfaces/auth/auth.models';
import { newDay } from '../../common/interfaces';
import { FakeAuthService } from '../auth/fake-auth.service';
import { FakeUserDataRepository } from '../repositories/fake-user-data.repository';
import { UserDataRepository } from '../repositories/user-data.repository';
import { BodyService } from './body.service';
import { DataSyncService } from './data-sync.service';
import { DayService } from './day.service';
import { StoreService } from './store.service';
import { DateU } from '../utils';
import { ToastService } from './toast.service';

const USER: AuthUser = { id: 'u1', email: 'a@example.com', username: 'john', emailPreferences: false, avatar: null, height: null, startWeight: null, age: null, sex: null, settings: null, roleId: 'user', permissions: null, hasPassword: true };
const K = '2026-10-05';

describe('DataSyncService', () => {
  let fake: FakeAuthService;
  let repo: FakeUserDataRepository;
  let store: StoreService;
  let data: DataSyncService;
  const flush = async (): Promise<void> => {
    for (let i = 0; i < 6; i++) {
      TestBed.tick();
      await Promise.resolve();
    }
  };
  const setOnline = (online: boolean): void => {
    Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useClass: FakeAuthService }, { provide: UserDataRepository, useClass: FakeUserDataRepository }] });
    fake = TestBed.inject(AuthService) as FakeAuthService;
    repo = TestBed.inject(UserDataRepository) as FakeUserDataRepository;
    store = TestBed.inject(StoreService);
    data = TestBed.inject(DataSyncService);
  });

  afterEach(() => setOnline(true));

  const signIn = async (): Promise<void> => {
    fake.stored = { ...USER };
    await TestBed.inject(AuthStore).init();
    await flush();
  };

  it('writes a guest\'s change to this browser at once, without any request', async () => {
    await TestBed.inject(AuthStore).init(); // no session: a guest
    const saved = data.commitDay(K, (d) => {
      d.water = 250;
    });
    expect(store.peek(K)?.water).toBe(250); // already written, before the promise settles
    expect(await saved).toBe(true);
    expect(repo.calls).toEqual([]);
  });

  it('sends a signed-in user\'s change to the account first and writes it locally after', async () => {
    await signIn();
    const saved = data.commitDay(K, (d) => {
      d.water = 250;
    });
    expect(store.peek(K)).toBeNull(); // not written while the request is out
    expect(await saved).toBe(true);
    expect(repo.stored.days[K].water).toBe(250);
    expect(store.peek(K)?.water).toBe(250);
  });

  it('writes nothing locally and tells the user when the account cannot be reached', async () => {
    await signIn();
    repo.failing = true;
    expect(await data.commitDay(K, (d) => (d.water = 250))).toBe(false);
    expect(store.peek(K)).toBeNull();
    expect(TestBed.inject(ToastService).message()).toBeTruthy();
  });

  it('does not even try while the browser is offline', async () => {
    await signIn();
    setOnline(false);
    expect(await data.commitDay(K, (d) => (d.water = 250))).toBe(false);
    expect(repo.calls).toEqual([]);
    expect(store.peek(K)).toBeNull();
    expect(TestBed.inject(ToastService).message()).toBeTruthy();
  });

  it('runs quick changes one after another, so none overwrites another', async () => {
    await signIn();
    const day = TestBed.inject(DayService);
    await Promise.all([day.addWater(K, 250), day.addWater(K, 250), day.addWater(K, 500)]);
    expect(store.peek(K)?.water).toBe(1000);
    expect(repo.stored.days[K].water).toBe(1000);
    expect(repo.stored.days[K].waterLog).toEqual([250, 250, 500]);
  });

  it('sends nothing when a change leaves the data as it was', async () => {
    await signIn();
    expect(await data.commit(() => false)).toBe(true);
    expect(await data.commit(() => undefined)).toBe(true);
    expect(repo.calls).toEqual([]);
  });

  it('reports a key as busy from the click until the backend answered', async () => {
    await signIn();
    const saved = data.commitDay(K, (d) => (d.water = 1), 'water:test');
    expect(data.busy('water:test')).toBe(true);
    expect(data.busy('water:other')).toBe(false);
    await saved;
    expect(data.busy('water:test')).toBe(false);
  });

  it('stops being busy also when the save failed', async () => {
    await signIn();
    repo.failing = true;
    await data.commitDay(K, (d) => (d.water = 1), 'water:test');
    expect(data.busy('water:test')).toBe(false);
  });

  it('counts the wait in the queue: a second change with the same key keeps it busy', async () => {
    await signIn();
    const first = data.commitDay(K, (d) => (d.water = 1), 'water:test');
    const second = data.commitDay(K, (d) => (d.water = 2), 'water:test');
    await first;
    expect(data.busy('water:test')).toBe(true);
    await second;
    expect(data.busy('water:test')).toBe(false);
  });

  it('never makes a guest wait', async () => {
    await TestBed.inject(AuthStore).init();
    const saved = data.commitDay(K, (d) => (d.water = 1), 'water:test');
    expect(data.busy('water:test')).toBe(false);
    await saved;
  });

  it('saves a weight to the account and deletes it again', async () => {
    await signIn();
    const body = TestBed.inject(BodyService);
    const day = DateU.add(DateU.today(), -1);
    expect(await body.save(day, 80.4, 90)).toBe(true);
    expect(repo.stored.weights).toEqual([{ date: day, kg: 80.4, waist: 90 }]);
    expect(await body.remove(day)).toBe(true);
    expect(repo.stored.weights).toEqual([]);
    expect(store.state().weights).toEqual([]);
  });

  it('replaces the data of this browser with the account\'s at sign-in', async () => {
    store.mutate((s) => (s.days[K] = { ...newDay(), water: 100 }));
    repo.stored.days['2026-10-06'] = { ...newDay(), water: 700 };
    await signIn();
    expect(store.peek(K)).toBeNull();
    expect(store.peek('2026-10-06')?.water).toBe(700);
    expect(repo.calls).toEqual([]); // the account had data: nothing from this browser is uploaded
  });

  it('uploads what a guest recorded once, when the account holds no data yet', async () => {
    store.mutate((s) => {
      s.days[K] = { ...newDay(), water: 100 };
      s.weights.push({ date: K, kg: 80, waist: null });
    });
    await signIn();
    expect(repo.stored.days[K].water).toBe(100);
    expect(repo.stored.weights).toEqual([{ date: K, kg: 80, waist: null }]);
    expect(store.peek(K)?.water).toBe(100); // and it stays here
  });

  it('keeps the local data when the account could not be read at sign-in', async () => {
    store.mutate((s) => (s.days[K] = { ...newDay(), water: 100 }));
    repo.failing = true;
    await signIn();
    expect(store.peek(K)?.water).toBe(100);
  });

  it('deletes everything in the account first, then in this browser', async () => {
    await signIn();
    await data.commitDay(K, (d) => (d.water = 250));
    expect(await data.clearAll()).toBe(true);
    expect(repo.stored.days).toEqual({});
    expect(store.state().days).toEqual({});
  });

  it('deletes nothing here when the account refuses', async () => {
    await signIn();
    await data.commitDay(K, (d) => (d.water = 250));
    repo.failing = true;
    expect(await data.clearAll()).toBe(false);
    expect(store.peek(K)?.water).toBe(250);
  });

  it('restores a backup into the account and keeps the plans and body data the account holds', async () => {
    await signIn();
    store.mutate((s) => {
      s.settings.height = 180;
      s.weekPlans['2026-10-05'] = { 1: [] };
    });
    const backup = { days: { [K]: { ...newDay(), water: 900 } }, weights: [{ date: K, kg: 79, waist: null }], settings: { height: 150 }, weekPlans: {}, workoutPlans: {} };
    expect(await data.replaceAll(backup)).toBe(true);
    expect(repo.stored.days[K].water).toBe(900);
    expect(repo.stored.weights).toHaveLength(1);
    expect(store.settings().height).toBe(180);
    expect(store.state().weekPlans['2026-10-05']).toBeDefined();
  });

  it('refuses a file that is not a backup', async () => {
    await expect(data.replaceAll({ nothing: true })).rejects.toThrow();
  });
});
