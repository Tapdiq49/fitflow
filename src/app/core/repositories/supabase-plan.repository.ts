import { Injectable, inject } from '@angular/core';
import { AuthError } from '../../common/interfaces/auth/auth.models';
import { toAuthError } from '../auth/supabase-errors';
import { Client, SupabaseClientProvider } from '../backend/supabase-client';
import { WeekPlan, WorkoutWeekPlan } from '../../common/interfaces';
import { PlanKind, PlanRepository, StoredPlans } from './plan.repository';

/** The weekly plans in the Supabase table `trainer_plans` (see supabase/migrations). RLS lets everyone read and write only their own rows. */
@Injectable()
export class SupabasePlanRepository extends PlanRepository {
  private readonly provider = inject(SupabaseClientProvider);

  private client(): Promise<Client> {
    return this.provider.client().catch((e: unknown) => {
      throw toAuthError(e);
    });
  }

  async load(): Promise<StoredPlans> {
    const client = await this.client();
    const { data, error } = await client.from('trainer_plans').select('kind, week, plan');
    if (error) throw toAuthError(error);
    const plans: StoredPlans = { meal: {}, workout: {} };
    for (const row of data) {
      if (row.kind === 'meal') plans.meal[row.week] = row.plan as unknown as WeekPlan;
      else plans.workout[row.week] = row.plan as unknown as WorkoutWeekPlan;
    }
    return plans;
  }

  async save(kind: PlanKind, week: string, plan: WeekPlan | WorkoutWeekPlan): Promise<void> {
    const client = await this.client();
    const { data: session } = await client.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) throw new AuthError('session_expired');
    const { error } = await client
      .from('trainer_plans')
      .upsert({ user_id: userId, kind, week, plan: plan as unknown as Record<string, unknown> }, { onConflict: 'user_id,kind,week' });
    if (error) throw toAuthError(error);
  }

  async remove(kind: PlanKind, week: string): Promise<void> {
    const client = await this.client();
    const { error } = await client.from('trainer_plans').delete().eq('kind', kind).eq('week', week);
    if (error) throw toAuthError(error);
  }
}
