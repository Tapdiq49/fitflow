import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { FakeAuthService } from '../auth/fake-auth.service';
import { ConfirmService } from './confirm.service';
import { SessionService } from './session.service';
import { StoreService } from './store.service';

describe('SessionService', () => {
  let store: StoreService;
  let confirm: ConfirmService;
  let session: SessionService;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useClass: FakeAuthService }] });
    (TestBed.inject(AuthService) as FakeAuthService).stored = { id: 'u1', email: 'a@example.com', username: 'john', emailPreferences: false, avatar: null, height: null, startWeight: null, hasPassword: true };
    await TestBed.inject(AuthStore).init();
    store = TestBed.inject(StoreService);
    confirm = TestBed.inject(ConfirmService);
    session = TestBed.inject(SessionService);
    store.mutate((s) => {
      s.settings.height = 180;
      s.weights.push({ date: '2026-10-07', kg: 80, waist: null });
    });
  });

  it('keeps everything when the user declines', async () => {
    const result = session.signOut();
    confirm.answer(false);
    expect(await result).toBe(false);
    expect(TestBed.inject(AuthStore).user()).not.toBeNull();
    expect(store.state().weights).toHaveLength(1);
  });

  it('signs out and wipes the data of this browser when the user confirms', async () => {
    const result = session.signOut();
    confirm.answer(true);
    expect(await result).toBe(true);
    expect(TestBed.inject(AuthStore).user()).toBeNull();
    expect(store.state().weights).toHaveLength(0);
    expect(store.settings().height).toBeNull();
  });
});
