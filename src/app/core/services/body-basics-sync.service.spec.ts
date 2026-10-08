import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { FakeAuthService } from '../auth/fake-auth.service';
import { AuthError, AuthUser } from '../../common/interfaces/auth/auth.models';
import { BodyBasicsSyncService } from './body-basics-sync.service';
import { StoreService } from './store.service';
import { ToastService } from './toast.service';

const USER: AuthUser = { id: 'u1', email: 'a@example.com', username: 'john', emailPreferences: false, avatar: null, height: null, startWeight: null, age: null, sex: null, settings: null, hasPassword: true };

describe('BodyBasicsSyncService', () => {
  let fake: FakeAuthService;
  let store: StoreService;
  const flush = async (): Promise<void> => {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  };
  const local = (): void => store.mutate((s) => Object.assign(s.settings, { height: 170, startWeight: 70, age: 40, sex: 'female' }));

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useClass: FakeAuthService }] });
    fake = TestBed.inject(AuthService) as FakeAuthService;
    store = TestBed.inject(StoreService);
    TestBed.inject(BodyBasicsSyncService);
  });

  it('takes the account values when the user signs in with an account that has them', async () => {
    local();
    fake.stored = { ...USER, height: 182, startWeight: 91.5, age: 33, sex: 'male' };
    await TestBed.inject(AuthStore).init();
    await flush();
    expect(store.settings()).toMatchObject({ height: 182, startWeight: 91.5, age: 33, sex: 'male' });
  });

  it('does not copy the values of a guest into an account that has none; the app asks again', async () => {
    local();
    fake.stored = { ...USER };
    await TestBed.inject(AuthStore).init();
    await flush();
    expect(fake.stored).toMatchObject({ height: null, startWeight: null, age: null, sex: null });
    expect(store.bodyBasicsKnown()).toBe(false);
  });

  it('keeps what an older account holds (height, weight) and asks only for the rest', async () => {
    fake.stored = { ...USER, height: 180, startWeight: 85 };
    await TestBed.inject(AuthStore).init();
    await flush();
    expect(store.settings()).toMatchObject({ height: 180, startWeight: 85, age: null, sex: null });
    expect(store.bodyBasicsKnown()).toBe(false);
  });

  it('lets a guest save without any request', async () => {
    await TestBed.inject(AuthStore).init();
    expect(await TestBed.inject(BodyBasicsSyncService).persist({ height: 170, startWeight: 70, age: 40, sex: 'female' })).toBe(true);
    expect(fake.stored).toBeNull();
  });

  it('sends the values to the account first and says yes, so the caller may write them locally', async () => {
    fake.stored = { ...USER, height: 170, startWeight: 70, age: 40, sex: 'female' };
    await TestBed.inject(AuthStore).init();
    await flush();
    expect(await TestBed.inject(BodyBasicsSyncService).persist({ height: 170, startWeight: 68, age: 40, sex: 'female' })).toBe(true);
    expect(fake.stored).toMatchObject({ height: 170, startWeight: 68, age: 40, sex: 'female' });
  });

  it('says no and tells the user when the account cannot be reached; nothing changes', async () => {
    fake.stored = { ...USER, height: 170, startWeight: 70, age: 40, sex: 'female' };
    await TestBed.inject(AuthStore).init();
    await flush();
    fake.setBodyBasics = async () => {
      throw new AuthError('network_error');
    };
    expect(await TestBed.inject(BodyBasicsSyncService).persist({ height: 170, startWeight: 68, age: 40, sex: 'female' })).toBe(false);
    expect(TestBed.inject(ToastService).message()).toBeTruthy();
    expect(fake.stored).toMatchObject({ startWeight: 70 });
  });
});
