import { Injectable, computed, inject } from '@angular/core';
import { AuthStore } from '../auth/auth.store';
import { DateU } from '../utils';
import { StoreService } from './store.service';

export const GUEST_NOTICE_REMIND_DAYS = 7;

/** The "your data lives only in this browser" notice for guests. Closing it hides it for a week. */
@Injectable({ providedIn: 'root' })
export class GuestNoticeService {
  private readonly auth = inject(AuthStore);
  private readonly store = inject(StoreService);

  readonly visible = computed(() => {
    if (!this.auth.isGuest()) return false;
    const closedOn = this.store.settings().guestNoticeDismissedAt;
    return !closedOn || DateU.diffDays(closedOn, DateU.today()) >= GUEST_NOTICE_REMIND_DAYS;
  });

  dismiss(): void {
    this.store.mutate((s) => (s.settings.guestNoticeDismissedAt = DateU.today()));
  }
}
