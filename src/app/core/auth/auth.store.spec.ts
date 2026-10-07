import { TestBed } from '@angular/core/testing';
import { AuthUser } from './auth.models';
import { AuthService } from './auth.service';
import { AuthStore } from './auth.store';
import { FakeAuthService } from './fake-auth.service';

const user = (username: string | null): AuthUser => ({ id: 'u1', email: 'a@example.com', username, emailPreferences: false, avatar: null, height: null, startWeight: null, age: null, sex: null, hasPassword: true });

describe('AuthStore', () => {
  let fake: FakeAuthService;

  const setup = (): AuthStore => {
    fake = new FakeAuthService();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: fake }] });
    return TestBed.inject(AuthStore);
  };

  it('is loading until the stored session is checked, then guest without one', async () => {
    const store = setup();
    expect(store.status()).toBe('loading');
    expect(store.isGuest()).toBe(false);
    await store.init();
    expect(store.status()).toBe('unauthenticated');
    expect(store.isGuest()).toBe(true);
  });

  it('restores a stored session after a refresh', async () => {
    const store = setup();
    fake.stored = user('john');
    await store.init();
    expect(store.isAuthenticated()).toBe(true);
    expect(store.user()?.username).toBe('john');
    expect(store.needsUsername()).toBe(false);
  });

  it('asks for a username when a provider sign-in has none, until one is set', async () => {
    const store = setup();
    fake.stored = user(null);
    await store.init();
    expect(store.needsUsername()).toBe(true);
    await store.setUsername('john');
    expect(store.needsUsername()).toBe(false);
  });

  it('signs in and out', async () => {
    const store = setup();
    await store.init();
    await store.signIn({ identifier: 'john', password: 'x' });
    expect(store.isAuthenticated()).toBe(true);
    await store.signOut();
    expect(store.isGuest()).toBe(true);
    expect(store.user()).toBeNull();
  });

  it('follows session changes pushed by the backend', async () => {
    const store = setup();
    await store.init();
    fake.emit('signed_in', user('john'));
    expect(store.isAuthenticated()).toBe(true);
    fake.emit('signed_out', null);
    expect(store.isGuest()).toBe(true);
  });

  it('updates the picture and keeps the rest of the account', async () => {
    const store = setup();
    fake.stored = user('john');
    await store.init();
    await store.setAvatar('data:image/jpeg;base64,AAAA');
    expect(store.user()?.avatar).toBe('data:image/jpeg;base64,AAAA');
    expect(store.user()?.username).toBe('john');
    await store.setAvatar(null);
    expect(store.user()?.avatar).toBeNull();
  });

  it('starts only once', async () => {
    const store = setup();
    expect(store.init()).toBe(store.init());
  });
});
