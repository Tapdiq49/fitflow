import { Injectable, inject } from '@angular/core';
import { AuthStore } from '../auth/auth.store';
import { t } from '../i18n/translate';
import { ConfirmService } from './confirm.service';
import { DayService } from './day.service';
import { StoreService } from './store.service';
import { UiService } from './ui.service';

/**
 * Signing out of the app. The days, weights and exercise history, the settings and the plans of a signed-in user live in the account,
 * so the copy in this browser is wiped on sign-out (except the theme and the language): the next person on this device must not see it.
 * It comes back from the account at the next sign-in.
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
    const { theme, skin, dir, navLayout, headerMode, fontScale, corners, highContrast, timeFormat, dateFormat, lang } = this.store.settings();
    await this.auth.signOut();
    this.store.reset();
    this.store.mutate((s) => Object.assign(s.settings, { theme, skin, dir, navLayout, headerMode, fontScale, corners, highContrast, timeFormat, dateFormat, lang }));
    this.ui.goToday();
    this.day.ensureDay(this.ui.today());
    return true;
  }
}
