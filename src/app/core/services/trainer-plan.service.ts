import { Injectable, inject } from '@angular/core';
import { TrainerExercise, WeekPlan, WorkoutWeekPlan } from '../models';
import { StoreService } from './store.service';

export const DEFAULT_GYM_DAYS: readonly number[] = [1, 3, 5];

/**
 * The user's weekly trainer meal plans. A week without its own plan reuses the latest earlier one; with none at all the plan is empty
 * (the built-in `TRAINER_PLAN` is only a suggestion the week plan page offers, never in effect by itself).
 */
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
    return key ? plans[key] : {};
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

  /** Trainer workout in effect for the week; empty when none was ever written. */
  workoutFor(week: string): WorkoutWeekPlan {
    const plans = this.store.state().workoutPlans;
    const key = Object.keys(plans)
      .filter((k) => k <= week)
      .sort()
      .pop();
    return key ? plans[key] : {};
  }

  /** Gym weekdays (1 = Monday) of the trainer workout in effect for the week: the days the plan was written for, Mon/Wed/Fri until one exists. */
  gymDays(week: string): number[] {
    const days = Object.keys(this.workoutFor(week)).map(Number);
    return days.length ? days.sort((a, b) => a - b) : [...DEFAULT_GYM_DAYS];
  }

  hasOwnWorkout(week: string): boolean {
    return week in this.store.state().workoutPlans;
  }

  saveWorkout(week: string, plan: WorkoutWeekPlan): void {
    this.store.mutate((s) => (s.workoutPlans[week] = structuredClone(plan)));
  }

  clearWorkout(week: string): void {
    this.store.mutate((s) => delete s.workoutPlans[week]);
  }

  /** Newest definition of a trainer exercise, for history views that have no date to resolve a week. */
  findExercise(id: string): TrainerExercise | undefined {
    const plans = this.store.state().workoutPlans;
    for (const week of Object.keys(plans).sort().reverse()) {
      for (const list of Object.values(plans[week])) {
        const ex = list.find((e) => e.id === id);
        if (ex) return ex;
      }
    }
    return undefined;
  }
}
