import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { FakeAuthService } from '../auth/fake-auth.service';
import { AuthUser } from '../auth/auth.models';
import { BodyBasicsSyncService } from './body-basics-sync.service';
import { StoreService } from './store.service';

const USER: AuthUser = { id: 'u1', email: 'a@example.com', username: 'john', emailPreferences: false, avatar: null, height: null, startWeight: null, hasPassword: true };

describe('BodyBasicsSyncService', () => {
  let fake: FakeAuthService;
  let store: StoreService;
  const flush = async (): Promise<void> => {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useClass: FakeAuthService }] });
    fake = TestBed.inject(AuthService) as FakeAuthService;
    store = TestBed.inject(StoreService);
    TestBed.inject(BodyBasicsSyncService);
  });

  it('takes the account values when the user signs in with an account that has them', async () => {
    store.mutate((s) => ((s.settings.height = 170), (s.settings.startWeight = 70)));
    fake.stored = { ...USER, height: 182, startWeight: 91.5 };
    await TestBed.inject(AuthStore).init();
    await flush();
    expect(store.settings()).toMatchObject({ height: 182, startWeight: 91.5 });
  });

  it('does not copy the values of a guest into an account that has none; the app asks again', async () => {
    store.mutate((s) => ((s.settings.height = 186), (s.settings.startWeight = 99)));
    fake.stored = { ...USER };
    await TestBed.inject(AuthStore).init();
    await flush();
    expect(fake.stored).toMatchObject({ height: null, startWeight: null });
    expect(store.bodyBasicsKnown()).toBe(false);
  });

  it('uploads a later change, and leaves a guest alone', async () => {
    store.mutate((s) => ((s.settings.height = 175), (s.settings.startWeight = 80)));
    await flush();
    expect(fake.stored).toBeNull(); // guest: nothing to upload

    fake.stored = { ...USER, height: 175, startWeight: 80 };
    await TestBed.inject(AuthStore).init();
    await flush();
    store.mutate((s) => (s.settings.startWeight = 78));
    await flush();
    expect(fake.stored).toMatchObject({ height: 175, startWeight: 78 });
  });
});
