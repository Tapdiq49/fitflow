import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { AuthUser } from '../../common/interfaces/auth/auth.models';
import { FakeAuthService } from '../auth/fake-auth.service';
import { FakePlanRepository } from '../repositories/fake-plan.repository';
import { PlanRepository } from '../repositories/plan.repository';
import { TrainerMeal, WeekPlan } from '../../common/interfaces';
import { PlanSyncService } from './plan-sync.service';
import { StoreService } from './store.service';
import { ToastService } from './toast.service';
import { TrainerPlanService } from './trainer-plan.service';

const USER: AuthUser = { id: 'u1', email: 'a@example.com', username: 'john', emailPreferences: false, avatar: null, height: null, startWeight: null, age: null, sex: null, settings: null, hasPassword: true };
const meal = (name: string): TrainerMeal => ({ slot: 'breakfast', time: '08:00', name, items: [] });
const plan = (name: string): WeekPlan => ({ 1: [meal(name)] });
const WEEK = '2026-10-05';

describe('PlanSyncService', () => {
  let fake: FakeAuthService;
  let repo: FakePlanRepository;
  let plans: TrainerPlanService;
  let sync: PlanSyncService;
  const flush = async (): Promise<void> => {
    for (let i = 0; i < 4; i++) {
      TestBed.tick();
      await Promise.resolve();
    }
  };
  const setOnline = (online: boolean): void => {
    Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useClass: FakeAuthService }, { provide: PlanRepository, useClass: FakePlanRepository }] });
    fake = TestBed.inject(AuthService) as FakeAuthService;
    repo = TestBed.inject(PlanRepository) as FakePlanRepository;
    TestBed.inject(StoreService);
    plans = TestBed.inject(TrainerPlanService);
    sync = TestBed.inject(PlanSyncService);
  });

  afterEach(() => setOnline(true));

  const signIn = async (): Promise<void> => {
    fake.stored = { ...USER };
    await TestBed.inject(AuthStore).init();
    await flush();
  };

  it('lets a guest save without any request: the plans stay in this browser', async () => {
    await TestBed.inject(AuthStore).init(); // no session: a guest
    expect(await sync.persist('meal', WEEK, plan('Yumurta'))).toBe(true);
    expect(repo.calls).toEqual([]);
  });

  it('replaces the plans of this browser with the account\'s at sign-in, and does not upload the guest\'s', async () => {
    plans.save(WEEK, plan('Qonaq planı'));
    repo.stored.meal['2026-10-12'] = plan('Hesab planı');
    await signIn();
    expect(plans.hasOwn(WEEK)).toBe(false);
    expect(plans.planFor('2026-10-12')[1][0].name).toBe('Hesab planı');
    expect(repo.calls).toEqual([]);
  });

  it('sends a saved plan, a workout plan and a cleared one to the account before the caller writes them locally', async () => {
    await signIn();
    expect(await sync.persist('meal', WEEK, plan('Birinci'))).toBe(true);
    expect(repo.stored.meal[WEEK][1][0].name).toBe('Birinci');
    expect(plans.hasOwn(WEEK)).toBe(false); // the caller writes locally only after it got the yes

    expect(await sync.persist('workout', WEEK, { 1: [{ id: 't:squat', name: 'Squat', sets: 3, min: 8, max: 12 }] })).toBe(true);
    expect(repo.stored.workout[WEEK][1][0].name).toBe('Squat');

    expect(await sync.persist('meal', WEEK, null)).toBe(true);
    expect(repo.stored.meal[WEEK]).toBeUndefined();
  });

  it('says no and tells the user when the backend cannot be reached, so nothing is written locally', async () => {
    await signIn();
    repo.failing = true;
    expect(await sync.persist('meal', WEEK, plan('Yeni'))).toBe(false);
    expect(TestBed.inject(ToastService).message()).toBeTruthy();
    expect(repo.stored.meal[WEEK]).toBeUndefined();
    expect(plans.hasOwn(WEEK)).toBe(false);
  });

  it('does not even try while the browser is offline', async () => {
    await signIn();
    setOnline(false);
    expect(await sync.persist('meal', WEEK, plan('Yeni'))).toBe(false);
    expect(repo.calls).toEqual([]);
    expect(TestBed.inject(ToastService).message()).toBeTruthy();
  });

  it('keeps the local plans when the account could not be read at sign-in', async () => {
    plans.save(WEEK, plan('Yerli'));
    repo.failing = true;
    await signIn();
    expect(plans.planFor(WEEK)[1][0].name).toBe('Yerli');
  });
});
