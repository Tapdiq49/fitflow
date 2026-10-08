import { Injectable, inject } from '@angular/core';
import { AuthStore } from '../auth/auth.store';
import { t } from '../i18n/translate';
import { ConfirmService } from './confirm.service';
import { DayService } from './day.service';
import { StoreService } from './store.service';
import { UiService } from './ui.service';

/**
 * Signing out of the app. Every app datum still lives in this browser's localStorage (nothing is saved to the account yet),
 * so it is wiped on sign-out (except the theme and the language): the next person on this device must not see it. Until the data moves to the backend this means
 * the data is gone for good, which is why the user has to confirm first.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly auth = inject(AuthStore);
  private readonly store = inject(StoreService);
  private readonly day = inject(DayService);
  private readonly ui = inject(UiService);
  private readonly confirm = inject(ConfirmService);

  /** Asks, signs out and clears this browser's data. Returns false when the user declined. Throws when the sign-out itself failed (nothing is cleared then). */
  async signOut(): Promise<boolean> {
    if (!(await this.confirm.ask(t('auth.signOutConfirm'), { confirmLabel: t('auth.signOut'), danger: true }))) return false;
    // Light / dark mode and the language belong to this device, not to the person: they stay as they were.
    const { theme, skin, lang } = this.store.settings();
    await this.auth.signOut();
    this.store.reset();
    this.store.mutate((s) => Object.assign(s.settings, { theme, skin, lang }));
    this.ui.goToday();
    this.day.ensureDay(this.ui.today());
    return true;
  }
}
