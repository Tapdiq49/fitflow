import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import { AuthStore } from '../auth/auth.store';
import { t } from '../i18n/translate';
import { WeekPlan, WorkoutWeekPlan } from '../../common/interfaces';
import { PlanKind, PlanRepository, StoredPlans } from '../repositories/plan.repository';
import { DayService } from './day.service';
import { StoreService } from './store.service';
import { ToastService } from './toast.service';

/**
 * Keeps the weekly trainer plans (meals and workout) in the account of a signed-in user (`trainer_plans`).
 * - Signing in: the account's plans replace the ones in this browser (a guest's plans are not copied into an account, the same
 *   rule as height and weight); stored menus are rebuilt from them.
 * - Afterwards every change of a plan in `StoreService` (saved or cleared on the week plan page) is sent to the account.
 * Guests never reach the backend: their plans stay in localStorage. A failed upload keeps the local plan, tells the user once, and
 * is tried again with the next change.
 */
@Injectable({ providedIn: 'root' })
export class PlanSyncService {
  private readonly auth = inject(AuthStore);
  private readonly store = inject(StoreService);
  private readonly repo = inject(PlanRepository);
  private readonly day = inject(DayService);
  private readonly toast = inject(ToastService);

  /** What the account holds, as JSON per kind and week; the diff against the local plans is what gets sent. Null = not loaded for this user yet. */
  private synced: Record<PlanKind, Map<string, string>> | null = null;
  private queue: Promise<void> = Promise.resolve();
  private failedShown = false;

  constructor() {
    const userId = computed(() => this.auth.user()?.id ?? null);
    effect(() => {
      const id = userId();
      untracked(() => {
        this.synced = null;
        if (id) this.queue = this.queue.then(() => this.load(id));
      });
    });
    effect(() => {
      const { weekPlans, workoutPlans } = this.store.state();
      untracked(() => {
        if (this.synced) this.queue = this.queue.then(() => this.push(weekPlans, workoutPlans));
      });
    });
  }

  private async load(id: string): Promise<void> {
    try {
      const plans = await this.repo.load();
      if (this.auth.user()?.id !== id) return; // signed out (or switched) while reading
      this.synced = this.snapshot(plans);
      this.store.mutate((s) => {
        s.weekPlans = plans.meal;
        s.workoutPlans = plans.workout;
      });
      this.day.rebuildTrainerMenus();
    } catch {
      // Not loaded: nothing is sent either (it would overwrite plans that were never read). The local plans stay.
    }
  }

  private snapshot(plans: StoredPlans): Record<PlanKind, Map<string, string>> {
    const map = (o: Record<string, unknown>): Map<string, string> => new Map(Object.entries(o).map(([week, plan]) => [week, JSON.stringify(plan)]));
    return { meal: map(plans.meal), workout: map(plans.workout) };
  }

  private async push(meal: Record<string, WeekPlan>, workout: Record<string, WorkoutWeekPlan>): Promise<void> {
    const synced = this.synced;
    if (!synced) return;
    const local: Record<PlanKind, Record<string, WeekPlan | WorkoutWeekPlan>> = { meal, workout };
    try {
      for (const kind of ['meal', 'workout'] as const) {
        for (const [week, plan] of Object.entries(local[kind])) {
          const json = JSON.stringify(plan);
          if (synced[kind].get(week) === json) continue;
          await this.repo.save(kind, week, plan);
          synced[kind].set(week, json);
        }
        for (const week of [...synced[kind].keys()]) {
          if (week in local[kind]) continue;
          await this.repo.remove(kind, week);
          synced[kind].delete(week);
        }
      }
      this.failedShown = false;
    } catch {
      if (!this.failedShown) this.toast.show(t('plan.syncFailed'));
      this.failedShown = true;
    }
  }
}
