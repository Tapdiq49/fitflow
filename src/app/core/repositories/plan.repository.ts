import { WeekPlan, WorkoutWeekPlan } from '../models';

export type PlanKind = 'meal' | 'workout';

/** Every plan of the signed-in user, keyed by the Monday (YYYY-MM-DD) of the week it starts in. */
export interface StoredPlans {
  meal: Record<string, WeekPlan>;
  workout: Record<string, WorkoutWeekPlan>;
}

/**
 * Where the signed-in user's weekly trainer plans live. Supabase implements it today (`supabase-plan.repository.ts`); a NestJS API
 * replaces it by changing the provider in `app.config.ts`. Guests have no repository: their plans stay in localStorage.
 * Methods throw `AuthError` (the app's backend error type).
 */
export abstract class PlanRepository {
  /** All plans of the current user. */
  abstract load(): Promise<StoredPlans>;
  /** Creates or replaces the plan of one week. */
  abstract save(kind: PlanKind, week: string, plan: WeekPlan | WorkoutWeekPlan): Promise<void>;
  /** Deletes the plan of one week. */
  abstract remove(kind: PlanKind, week: string): Promise<void>;
}
