import { TestBed } from '@angular/core/testing';
import { ProgramService } from './program.service';
import { StoreService } from './store.service';
import { WorkoutService } from './workout.service';

describe('WorkoutService.recommend', () => {
  let store: StoreService;
  let workout: WorkoutService;

  const logBench = (sets: [number, number][], date = '2026-10-05'): void =>
    store.mutate((s) => {
      s.settings.programStart = '2026-08-03'; // phase 3 (week 10)
      s.history['bench'] = [...(s.history['bench'] ?? []), { date, sets: sets.map(([w, r]) => ({ w, r })) }];
    });

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(StoreService);
    workout = TestBed.inject(WorkoutService);
  });

  it('suggests +2.5 kg when all sets hit the top of the range (60×10/10/10 → 62.5)', () => {
    logBench([[60, 10], [60, 10], [60, 10]]);
    const rec = workout.recommend('bench', '2026-10-07');
    expect(rec.kind).toBe('up');
    expect(rec.w).toBe(62.5);
  });

  it('keeps the weight when one set falls short (60×10/10/9)', () => {
    logBench([[60, 10], [60, 10], [60, 9]]);
    const rec = workout.recommend('bench', '2026-10-07');
    expect(rec.kind).toBe('same');
    expect(rec.w).toBe(60);
  });

  it('deloads ~10% after two sessions below the minimum', () => {
    logBench([[60, 7], [60, 6], [60, 6]], '2026-10-02');
    logBench([[60, 7], [60, 6], [60, 6]], '2026-10-05');
    const rec = workout.recommend('bench', '2026-10-07');
    expect(rec.kind).toBe('down');
    expect(rec.w).toBe(55);
  });

  it('caps lower-body increments during the first weeks after surgery', () => {
    store.mutate((s) => {
      s.settings.programStart = '2026-10-05'; // week 1 → phase 1
      s.history['rdl'] = [{ date: '2026-10-05', sets: [{ w: 60, r: 10 }, { w: 60, r: 10 }] }];
    });
    expect(workout.recommend('rdl', '2026-10-07').w).toBe(62.5);
  });
});

describe('ProgramService schedule', () => {
  it('alternates A-B-A / B-A-B by week', () => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    const store = TestBed.inject(StoreService);
    const program = TestBed.inject(ProgramService);
    store.mutate((s) => (s.settings.programStart = '2026-10-05'));
    expect(['2026-10-05', '2026-10-07', '2026-10-09'].map((k) => program.variant(k))).toEqual(['A', 'B', 'A']);
    expect(['2026-10-12', '2026-10-14', '2026-10-16'].map((k) => program.variant(k))).toEqual(['B', 'A', 'B']);
    expect(program.dayType('2026-10-06')).toBe('cardio');
    expect(program.dayType('2026-10-10')).toBe('rest');
  });
});
