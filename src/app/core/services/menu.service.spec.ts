import { TestBed } from '@angular/core/testing';
import { menuTotals } from '../nutrition';
import { DateU } from '../utils';
import { StoreService } from './store.service';
import { DayService } from './day.service';
import { TrainerPlanService } from './trainer-plan.service';

describe('MenuService (via DayService.ensureDay), auto mode', () => {
  let store: StoreService;
  let day: DayService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(StoreService);
    day = TestBed.inject(DayService);
    store.mutate((s) => (s.settings.menuMode = 'auto'));
  });

  it('keeps every generated day inside 2600–2800 kcal and 170–190 q protein', () => {
    const start = '2026-10-05';
    for (let i = 0; i < 120; i++) {
      const k = DateU.add(start, i);
      day.ensureDay(k);
      const t = menuTotals(store.peek(k)?.menu);
      expect(t.k).toBeGreaterThanOrEqual(2600);
      expect(t.k).toBeLessThanOrEqual(2800);
      expect(t.p).toBeGreaterThanOrEqual(170);
      expect(t.p).toBeLessThanOrEqual(190);
    }
  });

  it('does not repeat a meal template on consecutive days', () => {
    const start = '2026-10-05';
    for (let i = 0; i < 60; i++) day.ensureDay(DateU.add(start, i));
    for (let i = 1; i < 60; i++) {
      const prev = new Set(store.peek(DateU.add(start, i - 1))?.menu?.map((m) => m.templateId));
      const cur = store.peek(DateU.add(start, i))?.menu ?? [];
      expect(cur.some((m) => prev.has(m.templateId))).toBe(false);
    }
  });

});

describe('MenuService, trainer mode', () => {
  let store: StoreService;
  let day: DayService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(StoreService);
    day = TestBed.inject(DayService);
  });

  it('is the default and gives every weekday the trainer meals with dinner at 19:30', () => {
    expect(store.settings().menuMode).toBe('trainer');
    for (let i = 0; i < 7; i++) {
      const k = DateU.add('2026-10-05', i);
      day.ensureDay(k);
      const menu = store.peek(k)?.menu ?? [];
      expect(menu.map((m) => m.slot)).toEqual(['breakfast', 'snack', 'lunch', 'snack2', 'dinner']);
      expect(menu.find((m) => m.slot === 'dinner')?.time).toBe('19:30');
    }
  });

  it('keeps eaten meals and refills the rest when regenerating', () => {
    const k = '2026-10-05';
    day.ensureDay(k);
    const first = store.peek(k)?.menu?.[0];
    day.toggleMeal(k, first?.id ?? '');
    day.regenerateMenu(k);
    const menu = store.peek(k)?.menu ?? [];
    expect(menu).toHaveLength(5);
    expect(menu[0].id).toBe(first?.id);
    expect(menu[0].done).toBe(true);
  });

  it('replaces an untouched menu generated earlier in auto mode', () => {
    const k = DateU.add(DateU.today(), 7);
    store.mutate((s) => (s.settings.menuMode = 'auto'));
    day.ensureDay(k);
    store.mutate((s) => (s.settings.menuMode = 'trainer'));
    day.ensureDay(k);
    const menu = store.peek(k)?.menu ?? [];
    expect(menu.map((m) => m.time)).toEqual(['08:00', '11:00', '14:00', '16:00', '19:30']);
    expect(menu.every((m) => !m.templateId)).toBe(true);
  });

  it('has no swap alternative for trainer meals', () => {
    const k = '2026-10-05';
    day.ensureDay(k);
    const before = store.peek(k)?.menu?.map((m) => m.name);
    day.swapMeal(k, store.peek(k)?.menu?.[2].id ?? '');
    expect(store.peek(k)?.menu?.map((m) => m.name)).toEqual(before);
  });

  it('uses the written plan for its week and carries it to later weeks until a newer one is written', () => {
    const plans = TestBed.inject(TrainerPlanService);
    const meal = (name: string) => ({ slot: 'lunch' as const, time: '14:00', name, items: [] });
    const mon = DateU.monday(DateU.add(DateU.today(), 21));
    const w1 = mon;
    const w2 = DateU.add(mon, 7);
    const w3 = DateU.add(mon, 14);
    day.setWeekPlan(w1, { 1: [meal('A-həftə yeməyi')] });
    day.setWeekPlan(w3, { 1: [meal('C-həftə yeməyi')] });
    const lunchOn = (k: string) => {
      day.ensureDay(k);
      return store.peek(k)?.menu?.map((m) => m.name);
    };
    expect(lunchOn(DateU.add(w1, -7))).toContain('Qreçka + toyuq filesi + xiyar + petruşka'); // before any written plan: built-in
    expect(lunchOn(w1)).toEqual(['A-həftə yeməyi']);
    expect(lunchOn(w2)).toEqual(['A-həftə yeməyi']); // no plan written: previous week's
    expect(lunchOn(w3)).toEqual(['C-həftə yeməyi']);
    day.setWeekPlan(w3, null);
    expect(plans.hasOwn(w3)).toBe(false);
    expect(store.peek(w3)?.menu?.map((m) => m.name)).toEqual(['A-həftə yeməyi']);
  });

  it('leaves past days untouched when the plan changes', () => {
    const past = '2026-01-05'; // a Monday long gone
    day.ensureDay(past);
    const before = store.peek(past)?.menu?.map((m) => m.name);
    day.setWeekPlan(past, { 1: [{ slot: 'lunch', time: '14:00', name: 'Yeni plan', items: [] }] });
    expect(store.peek(past)?.menu?.map((m) => m.name)).toEqual(before);
  });

  it('keeps past days on the settings they were lived under', () => {
    const past = '2026-01-05';
    const future = DateU.monday(DateU.add(DateU.today(), 14));
    day.ensureDay(past);
    day.ensureDay(future);
    const at = (k: string) => day.timeline(k).find((i) => i.id === 'workout')?.time;
    expect(at(past)).toBe('18:00');
    store.updateSettings({ ...store.settings(), workoutTime: '21:00', showCreatine: false });
    expect(at(past)).toBe('18:00');
    expect(day.timeline(past).some((i) => i.id === 'creatine')).toBe(true);
    expect(at(future)).toBe('21:00');
    expect(day.timeline(future).some((i) => i.id === 'creatine')).toBe(false);
  });
});
