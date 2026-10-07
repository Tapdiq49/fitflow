import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { AuthUser } from '../auth/auth.models';
import { FakeAuthService } from '../auth/fake-auth.service';
import { FakePlanRepository } from '../repositories/fake-plan.repository';
import { PlanRepository } from '../repositories/plan.repository';
import { TrainerMeal, WeekPlan } from '../models';
import { PlanSyncService } from './plan-sync.service';
import { StoreService } from './store.service';
import { TrainerPlanService } from './trainer-plan.service';

const USER: AuthUser = { id: 'u1', email: 'a@example.com', username: 'john', emailPreferences: false, avatar: null, height: null, startWeight: null, age: null, sex: null, hasPassword: true };
const meal = (name: string): TrainerMeal => ({ slot: 'breakfast', time: '08:00', name, items: [] });
const plan = (name: string): WeekPlan => ({ 1: [meal(name)] });
const WEEK = '2026-10-05';

describe('PlanSyncService', () => {
  let fake: FakeAuthService;
  let repo: FakePlanRepository;
  let store: StoreService;
  let plans: TrainerPlanService;
  const flush = async (): Promise<void> => {
    for (let i = 0; i < 4; i++) {
      TestBed.tick();
      await Promise.resolve();
    }
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useClass: FakeAuthService }, { provide: PlanRepository, useClass: FakePlanRepository }] });
    fake = TestBed.inject(AuthService) as FakeAuthService;
    repo = TestBed.inject(PlanRepository) as FakePlanRepository;
    store = TestBed.inject(StoreService);
    plans = TestBed.inject(TrainerPlanService);
    TestBed.inject(PlanSyncService);
  });

  const signIn = async (): Promise<void> => {
    fake.stored = { ...USER };
    await TestBed.inject(AuthStore).init();
    await flush();
  };

  it('keeps a guest\'s plans in this browser only', async () => {
    plans.save(WEEK, plan('Yumurta'));
    await flush();
    expect(repo.calls).toEqual([]);
    expect(plans.hasOwn(WEEK)).toBe(true);
  });

  it('replaces the plans of this browser with the account\'s at sign-in, and does not upload the guest\'s', async () => {
    plans.save(WEEK, plan('Qonaq planı'));
    repo.stored.meal['2026-10-12'] = plan('Hesab planı');
    await signIn();
    expect(plans.hasOwn(WEEK)).toBe(false);
    expect(plans.planFor('2026-10-12')[1][0].name).toBe('Hesab planı');
    expect(repo.calls).toEqual([]);
  });

  it('sends a saved plan, a changed one, a workout plan and a cleared one to the account', async () => {
    await signIn();
    plans.save(WEEK, plan('Birinci'));
    await flush();
    expect(repo.stored.meal[WEEK][1][0].name).toBe('Birinci');

    plans.save(WEEK, plan('İkinci'));
    plans.saveWorkout(WEEK, { 1: [{ id: 't:squat', name: 'Squat', sets: 3, min: 8, max: 12 }] });
    await flush();
    expect(repo.stored.meal[WEEK][1][0].name).toBe('İkinci');
    expect(repo.stored.workout[WEEK][1][0].name).toBe('Squat');

    plans.clear(WEEK);
    await flush();
    expect(repo.stored.meal[WEEK]).toBeUndefined();
    expect(repo.calls.filter((c) => c === `save meal ${WEEK}`)).toHaveLength(2); // the unchanged workout save did not resend the meal plan
  });

  it('sends nothing when the account could not be read, so plans that were never read are not overwritten', async () => {
    repo.failing = true;
    plans.save(WEEK, plan('Yerli'));
    await signIn();
    repo.failing = false;
    plans.save(WEEK, plan('Yerli 2'));
    await flush();
    expect(repo.calls).toEqual([]);
    expect(store.state().weekPlans[WEEK]).toBeDefined();
  });
});
