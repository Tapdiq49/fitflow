import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { FakeAuthService } from '../auth/fake-auth.service';
import { DateU } from '../utils';
import { GuestNoticeService } from './guest-notice.service';
import { StoreService } from './store.service';

describe('GuestNoticeService', () => {
  let fake: FakeAuthService;

  beforeEach(() => {
    localStorage.clear();
    fake = new FakeAuthService();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: fake }] });
  });

  it('stays hidden while the session is unknown and for signed-in users', async () => {
    const notice = TestBed.inject(GuestNoticeService);
    expect(notice.visible()).toBe(false);
    fake.stored = { id: 'u1', email: 'a@example.com', username: 'john', emailPreferences: false, avatar: null, height: null, startWeight: null, age: null, sex: null, settings: null, roleId: 'user', permissions: null, hasPassword: true };
    await TestBed.inject(AuthStore).init();
    expect(notice.visible()).toBe(false);
  });

  it('shows to a guest, hides after closing and comes back after a week', async () => {
    await TestBed.inject(AuthStore).init();
    const notice = TestBed.inject(GuestNoticeService);
    const store = TestBed.inject(StoreService);
    expect(notice.visible()).toBe(true);

    notice.dismiss();
    expect(notice.visible()).toBe(false);
    expect(store.settings().guestNoticeDismissedAt).toBe(DateU.today());

    store.mutate((s) => (s.settings.guestNoticeDismissedAt = DateU.add(DateU.today(), -6)));
    expect(notice.visible()).toBe(false);
    store.mutate((s) => (s.settings.guestNoticeDismissedAt = DateU.add(DateU.today(), -7)));
    expect(notice.visible()).toBe(true);
  });

  it('gives old backups the default (never closed)', () => {
    expect(StoreService.normalize({ days: {}, settings: { height: 180 } }).settings.guestNoticeDismissedAt).toBe('');
  });
});
