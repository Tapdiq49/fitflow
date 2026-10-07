import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import { AuthStore } from '../auth/auth.store';
import { StoreService } from './store.service';

/**
 * Keeps height and starting weight in the account of a signed-in user (`profiles`), the first app data that is not only local.
 * - Signing in: the account wins when it has the values; when it has none yet, the values of this browser are dropped and the app asks.
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
      const { height, startWeight } = this.store.settings();
      untracked(() => void this.push(height, startWeight));
    });
  }

  private reconcile(): void {
    const user = this.auth.user();
    if (!user) return;
    if (user.height != null && user.startWeight != null) {
      const { height, startWeight } = user;
      const local = this.store.settings();
      if (local.height !== height || local.startWeight !== startWeight) {
        this.store.mutate((s) => {
          s.settings.height = height;
          s.settings.startWeight = startWeight;
        });
      }
      return;
    }
    // A new account has none: what this browser holds (typed as a guest, maybe by someone else) is not copied into it; the app asks again.
    const local = this.store.settings();
    if (local.height != null || local.startWeight != null) {
      this.store.mutate((s) => {
        s.settings.height = null;
        s.settings.startWeight = null;
      });
    }
  }

  private async push(height: number | null, startWeight: number | null): Promise<void> {
    const user = this.auth.user();
    if (!user || height == null || startWeight == null) return;
    if (user.height === height && user.startWeight === startWeight) return;
    try {
      await this.auth.setBodyBasics(height, startWeight);
    } catch {
      // Stays local; the next edit or sign-in tries again.
    }
  }
}
