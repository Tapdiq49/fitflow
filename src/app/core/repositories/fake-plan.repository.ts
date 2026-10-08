import { AuthError } from '../../common/interfaces/auth/auth.models';
import { WeekPlan, WorkoutWeekPlan } from '../../common/interfaces';
import { PlanKind, PlanRepository, StoredPlans } from './plan.repository';

/** In-memory PlanRepository for specs. `stored` is the table; set `failing` to simulate a backend that cannot be reached. */
export class FakePlanRepository extends PlanRepository {
  stored: StoredPlans = { meal: {}, workout: {} };
  failing = false;
  /** Every save / remove in the order it happened, e.g. "save meal 2026-10-05". */
  calls: string[] = [];

  private check(): void {
    if (this.failing) throw new AuthError('network_error');
  }

  async load(): Promise<StoredPlans> {
    this.check();
    return structuredClone(this.stored);
  }

  async save(kind: PlanKind, week: string, plan: WeekPlan | WorkoutWeekPlan): Promise<void> {
    this.check();
    this.calls.push(`save ${kind} ${week}`);
    (this.stored[kind] as Record<string, unknown>)[week] = structuredClone(plan);
  }

  async remove(kind: PlanKind, week: string): Promise<void> {
    this.check();
    this.calls.push(`remove ${kind} ${week}`);
    delete (this.stored[kind] as Record<string, unknown>)[week];
  }
}
