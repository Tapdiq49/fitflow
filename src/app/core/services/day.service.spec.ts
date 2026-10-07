import { TestBed } from '@angular/core/testing';
import { Settings } from '../models';
import { DateU } from '../utils';
import { DayService } from './day.service';
import { StoreService } from './store.service';

describe('DayService.offerMenuRegeneration', () => {
  let day: DayService;
  let base: Settings;
  const today = DateU.today();

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    day = TestBed.inject(DayService);
    base = { ...TestBed.inject(StoreService).settings(), menuMode: 'auto', targetMode: 'custom' };
  });

  it('offers it in auto mode when a setting the generator reads changed', () => {
    for (const change of [{ kcalTarget: 2900 }, { proteinTarget: 190 }, { mealsPerDay: 6 }, { useWhey: !base.useWhey }, { workoutTime: '07:00' }, { wakeTime: '06:00' }]) {
      expect(day.offerMenuRegeneration(base, { ...base, ...change }, today)).toBe(true);
    }
  });

  it('does not offer it when nothing relevant changed (theme, language, sleep time, creatine)', () => {
    const after = { ...base, theme: 'dark' as const, lang: 'en' as const, sleepTime: '22:00', showCreatine: !base.showCreatine };
    expect(day.offerMenuRegeneration(base, after, today)).toBe(false);
  });

  it('does not offer it in trainer menu mode, even if a relevant setting changed', () => {
    expect(day.offerMenuRegeneration({ ...base, menuMode: 'trainer' }, { ...base, menuMode: 'trainer', kcalTarget: 2900 }, today)).toBe(false);
  });

  it('does not ask about the calorie and protein targets while they are automatic (they rebuild the menus themselves), but still about the rest', () => {
    const auto = { ...base, targetMode: 'auto' as const };
    expect(day.offerMenuRegeneration(auto, { ...auto, kcalTarget: 2900, proteinTarget: 190 }, today)).toBe(false);
    expect(day.offerMenuRegeneration(auto, { ...auto, mealsPerDay: 6 }, today)).toBe(true);
  });

  it('does not offer it to a person who gets the trainer plan because the app must not advise them', () => {
    TestBed.inject(StoreService).mutate((s) => Object.assign(s.settings, { height: 150, startWeight: 30, age: 15, sex: 'female' }));
    expect(day.offerMenuRegeneration(base, { ...base, mealsPerDay: 6 }, today)).toBe(false);
  });

  it('does not offer it for a past day', () => {
    expect(day.offerMenuRegeneration(base, { ...base, kcalTarget: 2900 }, DateU.add(today, -1))).toBe(false);
  });
});

describe('DayService.addWater', () => {
  let store: StoreService;
  let day: DayService;
  const k = '2026-10-07';

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(StoreService);
    day = TestBed.inject(DayService);
  });

  it('adds a hand-typed amount and undoes it', () => {
    expect(day.addWater(k, 350)).toBe(true);
    expect(day.addWater(k, 250)).toBe(true);
    expect(store.peek(k)!.water).toBe(600);
    day.undoWater(k);
    expect(store.peek(k)!.water).toBe(350);
  });

  it('rounds to whole ml and rejects empty, zero, negative or huge amounts', () => {
    expect(day.addWater(k, 120.6)).toBe(true);
    for (const ml of [NaN, 0, -200, 5001]) expect(day.addWater(k, ml)).toBe(false);
    expect(store.peek(k)!.water).toBe(121);
    expect(store.peek(k)!.waterLog).toEqual([121]);
  });
});
