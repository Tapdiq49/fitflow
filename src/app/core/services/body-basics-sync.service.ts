import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import { AuthStore } from '../auth/auth.store';
import { Sex } from '../models';
import { StoreService } from './store.service';

/**
 * Keeps height, starting weight, age and sex in the account of a signed-in user (`profiles`), the first app data that is not only local.
 * - Signing in: the account wins; when it has none yet, the values of this browser are dropped and the app asks.
 * - Later edits (dialog, settings) go up as soon as they change.
 * Guests keep them in localStorage only. A failed upload is silent: the local value stays and the next change tries again.
 */
@Injectable({ providedIn: 'root' })
export class BodyBasicsSyncService {
  private readonly auth = inject(AuthStore);
  private readonly store = inject(StoreService);

  constructor() {
    const userId = computed(() => this.auth.user()?.id ?? null);
    effect(() => {
      if (userId()) untracked(() => this.reconcile());
    });
    effect(() => {
      const { height, startWeight, age, sex } = this.store.settings();
      untracked(() => void this.push(height, startWeight, age, sex));
    });
  }

  /** Signing in: this browser takes what the account holds, including "nothing yet" (a guest's values are not copied into an account). */
  private reconcile(): void {
    const user = this.auth.user();
    if (!user) return;
    const local = this.store.settings();
    if (local.height === user.height && local.startWeight === user.startWeight && local.age === user.age && local.sex === user.sex) return;
    this.store.mutate((s) => {
      s.settings.height = user.height;
      s.settings.startWeight = user.startWeight;
      s.settings.age = user.age;
      s.settings.sex = user.sex;
    });
  }

  private async push(height: number | null, startWeight: number | null, age: number | null, sex: Sex | null): Promise<void> {
    const user = this.auth.user();
    if (!user || height == null || startWeight == null || age == null || sex == null) return;
    if (user.height === height && user.startWeight === startWeight && user.age === age && user.sex === sex) return;
    try {
      await this.auth.setBodyBasics(height, startWeight, age, sex);
    } catch {
      // Stays local; the next edit or sign-in tries again.
    }
  }
}
