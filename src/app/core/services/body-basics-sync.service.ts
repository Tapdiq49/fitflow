import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import { AuthStore } from '../auth/auth.store';
import { BodyBasics } from '../../common/interfaces';
import { assertOnline, saveErrorText } from '../auth/auth-errors';
import { t } from '../i18n/translate';
import { ToastService } from './toast.service';
import { StoreService } from './store.service';

/**
 * Keeps height, starting weight, age and sex in the account of a signed-in user (`profiles`), the first app data that is not only local.
 * - Signing in: the account wins; when it has none yet, the values of this browser are dropped and the app asks.
 * - Saving (dialog, form, settings) goes to the account FIRST (`persist`); the caller writes the values locally only when the backend
 *   accepted them. A failed save (offline, server error) writes nothing locally, so this browser never holds values the account does not.
 * Guests keep them in localStorage only.
 */
@Injectable({ providedIn: 'root' })
export class BodyBasicsSyncService {
  private readonly auth = inject(AuthStore);
  private readonly store = inject(StoreService);
  private readonly toast = inject(ToastService);

  constructor() {
    const userId = computed(() => this.auth.user()?.id ?? null);
    effect(() => {
      if (userId()) untracked(() => this.reconcile());
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

  /**
   * Sends the values to the account. True when they may be written locally too: the backend accepted them, they are what the account
   * already holds, or the user is a guest. False (the user has been told why) when nothing may be written.
   */
  async persist(b: BodyBasics): Promise<boolean> {
    if (this.auth.status() === 'loading') {
      this.toast.show(t('save.notReady'));
      return false;
    }
    const user = this.auth.user();
    if (!user) return true;
    if (user.height === b.height && user.startWeight === b.startWeight && user.age === b.age && user.sex === b.sex) return true;
    try {
      assertOnline();
      await this.auth.setBodyBasics(b.height, b.startWeight, b.age, b.sex);
      return true;
    } catch (e) {
      this.toast.show(saveErrorText(e));
      return false;
    }
  }
}
