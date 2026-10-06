import { Injectable, inject } from '@angular/core';
import { TRAINER_PLAN } from '../data/trainer-plan';
import { WeekPlan } from '../models';
import { StoreService } from './store.service';

/** The trainer's weekly meal plans. A week without its own plan reuses the latest earlier one (or the built-in first week). */
@Injectable({ providedIn: 'root' })
export class TrainerPlanService {
  private readonly store = inject(StoreService);

  /** Plan in effect for the week starting on `week` (a Monday key). */
  planFor(week: string): WeekPlan {
    const plans = this.store.state().weekPlans;
    const key = Object.keys(plans)
      .filter((k) => k <= week)
      .sort()
      .pop();
    return key ? plans[key] : TRAINER_PLAN;
  }

  hasOwn(week: string): boolean {
    return week in this.store.state().weekPlans;
  }

  save(week: string, plan: WeekPlan): void {
    this.store.mutate((s) => (s.weekPlans[week] = structuredClone(plan)));
  }

  clear(week: string): void {
    this.store.mutate((s) => delete s.weekPlans[week]);
  }
}
