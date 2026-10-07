import { TestBed } from '@angular/core/testing';
import { DateU } from '../utils';
import { DayService } from './day.service';
import { StoreService } from './store.service';
import { TargetSyncService } from './target-sync.service';
import { menuTotals } from '../nutrition';

describe('TargetSyncService', () => {
  let store: StoreService;
  let day: DayService;
  const flush = (): void => TestBed.tick();
  const body = { height: 180, startWeight: 75, age: 30, sex: 'male' as const };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(StoreService);
    day = TestBed.inject(DayService);
    TestBed.inject(TargetSyncService);
  });

  it('is the standard for a new user, and keeps the typed numbers of settings saved before it existed', () => {
    expect(store.settings().targetMode).toBe('auto');
    expect(StoreService.normalize({ settings: { kcalTarget: 3000 } }).settings).toMatchObject({ targetMode: 'custom', kcalTarget: 3000 });
  });

  it('sets the targets from the body data and the goal once the data is complete', () => {
    store.mutate((s) => Object.assign(s.settings, body));
    flush();
    expect(store.settings()).toMatchObject({ kcalTarget: 2680, proteinTarget: 135 });
    store.mutate((s) => (s.settings.goal = 'lose'));
    flush();
    expect(store.settings()).toMatchObject({ kcalTarget: 2180, proteinTarget: 150 });
  });

  it('follows the newest logged weight', () => {
    store.mutate((s) => Object.assign(s.settings, body));
    flush();
    store.mutate((s) => s.weights.push({ date: DateU.today(), kg: 85, waist: null }));
    flush();
    expect(store.settings().kcalTarget).toBe(2840); // (850 + 1125 − 150 + 5) × 1.55 = 2836.5
  });

  it('leaves typed targets alone in custom mode, and does nothing for a person the app must not advise', () => {
    store.mutate((s) => Object.assign(s.settings, body, { targetMode: 'custom', kcalTarget: 3100, proteinTarget: 170 }));
    flush();
    expect(store.settings()).toMatchObject({ kcalTarget: 3100, proteinTarget: 170 });
    store.mutate((s) => Object.assign(s.settings, { targetMode: 'auto', age: 15 }));
    flush();
    expect(store.settings().kcalTarget).toBe(3100);
  });

  it('rebuilds a stored menu that no longer fits the new targets', () => {
    const k = DateU.today();
    day.ensureDay(k); // built for the standard 2700 kcal
    expect(menuTotals(store.peek(k)?.menu).k).toBeGreaterThan(2500);
    store.mutate((s) => Object.assign(s.settings, body, { goal: 'lose' }));
    flush();
    const t = menuTotals(store.peek(k)?.menu);
    expect(Math.abs(t.k - 2180)).toBeLessThanOrEqual(200);
  });
});
