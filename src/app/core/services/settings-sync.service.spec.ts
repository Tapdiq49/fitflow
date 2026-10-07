import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { AuthUser } from '../auth/auth.models';
import { FakeAuthService } from '../auth/fake-auth.service';
import { SettingsSyncService, settingsSnapshot } from './settings-sync.service';
import { StoreService } from './store.service';

const USER: AuthUser = { id: 'u1', email: 'a@example.com', username: 'john', emailPreferences: false, avatar: null, height: null, startWeight: null, age: null, sex: null, settings: null, hasPassword: true };

describe('settingsSnapshot', () => {
  it('holds every synced setting, not only the changed ones, and none of the body data or guest notice', () => {
    const s = StoreService.normalize({ settings: { programStart: '2026-10-05', theme: 'dark', height: 180, age: 30, sex: 'male', startWeight: 80 } }).settings;
    const snap = settingsSnapshot(s);
    expect(snap).toMatchObject({ programStart: '2026-10-05', theme: 'dark', menuMode: 'auto', workoutMode: 'program', mealsPerDay: 5, kcalTarget: 2700, proteinTarget: 180, targetMode: 'custom', lang: 'az', workoutTime: '18:00', wakeTime: '07:00', sleepTime: '23:30', goal: 'maintain', useWhey: true, showCreatine: true });
    for (const k of ['height', 'startWeight', 'age', 'sex', 'guestNoticeDismissedAt']) expect(snap).not.toHaveProperty(k);
  });
});

describe('SettingsSyncService', () => {
  let fake: FakeAuthService;
  let store: StoreService;
  const flush = async (): Promise<void> => {
    for (let i = 0; i < 4; i++) {
      TestBed.tick();
      await Promise.resolve();
    }
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useClass: FakeAuthService }] });
    fake = TestBed.inject(AuthService) as FakeAuthService;
    store = TestBed.inject(StoreService);
    TestBed.inject(SettingsSyncService);
  });

  const signIn = async (settings: Record<string, unknown> | null): Promise<void> => {
    fake.stored = { ...USER, settings };
    await TestBed.inject(AuthStore).init();
    await flush();
  };

  it('keeps a guest\'s settings in this browser only', async () => {
    store.mutate((s) => (s.settings.theme = 'dark'));
    await flush();
    expect(fake.stored).toBeNull();
  });

  it('gives a second device the settings the account holds, and the defaults for everything else', async () => {
    store.mutate((s) => Object.assign(s.settings, { theme: 'light', menuMode: 'trainer', mealsPerDay: 6 }));
    await signIn({ menuMode: 'trainer', workoutMode: 'trainer', targetMode: 'custom', kcalTarget: 3000 });
    expect(store.settings()).toMatchObject({ menuMode: 'trainer', workoutMode: 'trainer', targetMode: 'custom', kcalTarget: 3000, theme: 'system', mealsPerDay: 5 });
  });

  it('starts an account with nothing saved from the defaults, not from what this browser held, and writes all of them to the account', async () => {
    store.mutate((s) => Object.assign(s.settings, { menuMode: 'trainer', theme: 'dark' }));
    await signIn(null);
    expect(store.settings()).toMatchObject({ menuMode: 'auto', theme: 'system' });
    expect(fake.stored?.settings).toMatchObject({ menuMode: 'auto', theme: 'system', mealsPerDay: 5, workoutMode: 'program' });
  });

  it('completes an older account document that held only some settings', async () => {
    await signIn({ theme: 'dark' });
    expect(store.settings()).toMatchObject({ theme: 'dark', menuMode: 'auto' });
    expect(fake.stored?.settings).toMatchObject({ theme: 'dark', menuMode: 'auto', mealsPerDay: 5, lang: 'az' });
  });

  it('sends every setting with each change, including the ones still at their default', async () => {
    await signIn({});
    store.mutate((s) => (s.settings.menuMode = 'trainer'));
    await flush();
    expect(fake.stored?.settings).toMatchObject({ menuMode: 'trainer', theme: 'system', mealsPerDay: 5, targetMode: 'auto' });

    store.mutate((s) => (s.settings.menuMode = 'auto'));
    await flush();
    expect(fake.stored?.settings).toMatchObject({ menuMode: 'auto' });
  });
});
