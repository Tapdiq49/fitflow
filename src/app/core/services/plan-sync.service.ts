import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import { AuthStore } from '../auth/auth.store';
import { assertOnline, saveErrorText } from '../auth/auth-errors';
import { t } from '../i18n/translate';
import { WeekPlan, WorkoutWeekPlan } from '../../common/interfaces';
import { PlanKind, PlanRepository } from '../repositories/plan.repository';
import { DayService } from './day.service';
import { StoreService } from './store.service';
import { ToastService } from './toast.service';

/**
 * Keeps the weekly trainer plans (meals and workout) in the account of a signed-in user (`trainer_plans`).
 * - Signing in (and every app start with a session): the account's plans replace the ones in this browser (a guest's plans are not
 *   copied into an account, the same rule as height and weight); stored menus are rebuilt from them.
 * - Saving or clearing a plan goes to the account FIRST (`persist`); only when the backend accepted it does the caller write the plan to
 *   `StoreService` (localStorage). A failed save (offline, server error) writes nothing locally, so this browser never holds a plan the
 *   account does not, and two devices cannot drift apart.
 * Guests never reach the backend: their plans stay in localStorage.
 */
@Injectable({ providedIn: 'root' })
export class PlanSyncService {
  private readonly auth = inject(AuthStore);
  private readonly store = inject(StoreService);
  private readonly repo = inject(PlanRepository);
  private readonly day = inject(DayService);
  private readonly toast = inject(ToastService);

  private queue: Promise<void> = Promise.resolve();

  constructor() {
    const userId = computed(() => this.auth.user()?.id ?? null);
    effect(() => {
      const id = userId();
      untracked(() => {
        if (id) this.queue = this.queue.then(() => this.load(id));
      });
    });
  }

  /**
   * Writes one week's plan to the account (`plan`), or deletes it (`null`). True when it may be written locally too: the backend
   * accepted it, or the user is a guest. False (the user has been told why) when nothing may be written: no connection, a server error,
   * or the account is still loading.
   */
  async persist(kind: PlanKind, week: string, plan: WeekPlan | WorkoutWeekPlan | null): Promise<boolean> {
    if (this.auth.status() === 'loading') {
      this.toast.show(t('save.notReady'));
      return false;
    }
    if (!this.auth.user()) return true;
    try {
      assertOnline();
      if (plan) await this.repo.save(kind, week, plan);
      else await this.repo.remove(kind, week);
      return true;
    } catch (e) {
      this.toast.show(saveErrorText(e));
      return false;
    }
  }

  private async load(id: string): Promise<void> {
    try {
      const plans = await this.repo.load();
      if (this.auth.user()?.id !== id) return; // signed out (or switched) while reading
      this.store.mutate((s) => {
        s.weekPlans = plans.meal;
        s.workoutPlans = plans.workout;
      });
      this.day.rebuildTrainerMenus();
    } catch {
      // Not loaded: the local plans stay (they are what the account held at the last successful read).
    }
  }
}
