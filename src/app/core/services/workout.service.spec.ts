import { TestBed } from '@angular/core/testing';
import { ProgramService } from './program.service';
import { StoreService } from './store.service';
import { TrainerPlanService } from './trainer-plan.service';
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

describe('WorkoutService, trainer mode', () => {
  let store: StoreService;
  let workout: WorkoutService;
  let plans: TrainerPlanService;
  const ex = (name: string, sets = 3) => ({ id: 't:' + name.toLowerCase(), name, sets, min: 8, max: 12 });

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(StoreService);
    workout = TestBed.inject(WorkoutService);
    plans = TestBed.inject(TrainerPlanService);
    store.mutate((s) => (s.settings.workoutMode = 'trainer'));
  });

  it('has no exercises until the trainer plan is written', () => {
    expect(workout.exercises('2026-10-05')).toEqual([]);
  });

  it('uses the plan of the weekday, and carries the latest earlier week forward', () => {
    plans.saveWorkout('2026-10-05', { 1: [ex('Squat'), ex('Row', 2)], 3: [ex('Bench')] });
    expect(workout.exercises('2026-10-05').map((e) => e.ex.name)).toEqual(['Squat', 'Row']);
    expect(workout.exercises('2026-10-07').map((e) => e.ex.name)).toEqual(['Bench']);
    expect(workout.exercises('2026-10-12').map((e) => e.ex.name)).toEqual(['Squat', 'Row']); // next week, nothing written
    expect(workout.exercises('2026-10-06')).toEqual([]); // cardio day
    plans.saveWorkout('2026-10-12', { 1: [ex('Deadlift')] });
    expect(workout.exercises('2026-10-12').map((e) => e.ex.name)).toEqual(['Deadlift']);
  });

  it('builds the blank log from the planned sets and replaces it when the plan changes', () => {
    plans.saveWorkout('2026-10-05', { 1: [ex('Squat', 4)] });
    expect(workout.get('2026-10-05').ex['t:squat'].sets).toHaveLength(4);
    workout.setValue('2026-10-05', 't:squat', 0, 'r', '10');
    plans.saveWorkout('2026-10-05', { 1: [ex('Row', 2)] });
    expect(Object.keys(workout.get('2026-10-05').ex)).toEqual(['t:row']);
  });

  it('does not suggest a weight for trainer exercises but shows the last one', () => {
    plans.saveWorkout('2026-10-05', { 1: [ex('Squat')] });
    expect(workout.recommend('t:squat', '2026-10-12').kind).toBe('new');
    store.mutate((s) => (s.history['t:squat'] = [{ date: '2026-10-05', sets: [{ w: 60, r: 12 }, { w: 60, r: 12 }, { w: 60, r: 12 }] }]));
    const rec = workout.recommend('t:squat', '2026-10-12');
    expect(rec.w).toBeNull();
    expect(rec.last?.sets[0].w).toBe(60);
  });

  it('uses the gym days chosen in the trainer plan, per week', () => {
    const program = TestBed.inject(ProgramService);
    plans.saveWorkout('2026-10-05', { 2: [ex('Squat')], 4: [ex('Bench')], 6: [ex('Row')] });
    expect(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-10', '2026-10-11'].map((k) => program.dayType(k))).toEqual([
      'cardio',
      'training',
      'cardio',
      'training',
      'rest',
    ]);
    expect(program.variant('2026-10-10')).toBe('A');
    expect(workout.exercises('2026-10-10').map((e) => e.ex.name)).toEqual(['Row']);
    expect(plans.gymDays('2026-09-28')).toEqual([1, 3, 5]); // earlier week, no plan yet
  });

  it('lets a saved workout be redone after the plan of its day changed', async () => {
    const k = '2026-10-05';
    plans.saveWorkout(k, { 1: [ex('Squat')] });
    await workout.setValue(k, 't:squat', 0, 'w', '60');
    await workout.setValue(k, 't:squat', 0, 'r', '10');
    expect(await workout.save(k)).toBe(1);
    plans.saveWorkout(k, { 1: [ex('Row', 2)] });
    expect(workout.isStale(k)).toBe(true);
    // the old log has no such exercise: nothing happens, nothing throws
    expect(await workout.addSet(k, 't:row')).toBe(true);
    expect(store.peek(k)?.workout?.ex['t:row']).toBeUndefined();
    expect(await workout.resetLog(k)).toBe(true);
    expect(workout.isStale(k)).toBe(false);
    expect(store.state().history['t:squat']).toBeUndefined();
    expect(store.peek(k)?.checks['workout']).toBeUndefined();
    await workout.addSet(k, 't:row');
    expect(workout.get(k).ex['t:row'].sets).toHaveLength(3);
  });

  it('sees a saved trainer workout as outdated when the built-in program takes over (and the other way round)', async () => {
    const k = '2026-10-05';
    plans.saveWorkout(k, { 1: [ex('Squat')] });
    await workout.setValue(k, 't:squat', 0, 'w', '60');
    await workout.setValue(k, 't:squat', 0, 'r', '10');
    expect(await workout.save(k)).toBe(1);
    expect(workout.isStale(k)).toBe(false);
    store.mutate((s) => (s.settings.workoutMode = 'program'));
    expect(workout.isStale(k)).toBe(true);
    expect(await workout.resetLog(k)).toBe(true);
    expect(workout.isStale(k)).toBe(false);
    expect(Object.keys(workout.get(k).ex).some((id) => id.startsWith('t:'))).toBe(false);
  });

  it('can throw away typed values that were never saved, and a checklist tick without a log', async () => {
    const k = '2026-10-05';
    plans.saveWorkout(k, { 1: [ex('Squat')] });
    expect(workout.hasProgress(k)).toBe(false);
    await workout.setValue(k, 't:squat', 0, 'w', '2');
    expect(workout.hasProgress(k)).toBe(true);
    expect(await workout.resetLog(k)).toBe(true);
    expect(workout.hasProgress(k)).toBe(false);
    expect(workout.get(k).ex['t:squat'].sets[0].w).toBe('');
    store.mutateDay(k, (d) => (d.checks['workout'] = true));
    expect(workout.hasProgress(k)).toBe(true);
    expect(await workout.resetLog(k)).toBe(true);
    expect(store.peek(k)?.checks['workout']).toBeUndefined();
  });

  it('keeps typed weight and reps in memory and sends them with the tick of the set', async () => {
    const k = '2026-10-05';
    plans.saveWorkout(k, { 1: [ex('Squat')] });
    workout.setDraft(k, 't:squat', 0, 'w', '60');
    workout.setDraft(k, 't:squat', 0, 'r', '10');
    expect(workout.fieldValue(k, 't:squat', 0, 'w', '')).toBe('60');
    expect(workout.hasDrafts(k)).toBe(true);
    expect(store.peek(k)?.workout).toBeUndefined(); // typing stored nothing
    expect(await workout.toggleSet(k, 't:squat', 0)).toBe(true);
    expect(store.peek(k)!.workout!.ex['t:squat'].sets[0]).toMatchObject({ w: '60', r: '10', done: true });
    expect(workout.hasDrafts(k)).toBe(false);
  });

  it('keeps the typed values when the tick is refused for a missing weight', async () => {
    const k = '2026-10-05';
    plans.saveWorkout(k, { 1: [ex('Squat')] });
    workout.setDraft(k, 't:squat', 0, 'r', '10');
    expect(await workout.toggleSet(k, 't:squat', 0)).toBe(false);
    expect(workout.hasDrafts(k)).toBe(true);
    expect(workout.fieldValue(k, 't:squat', 0, 'r', '')).toBe('10');
  });

  it('saves the typed values with the workout, ticked or not, and forgets a reset day\'s drafts', async () => {
    const k = '2026-10-05';
    plans.saveWorkout(k, { 1: [ex('Squat')] });
    workout.setDraft(k, 't:squat', 0, 'w', '60');
    workout.setDraft(k, 't:squat', 0, 'r', '10');
    expect(await workout.save(k)).toBe(1);
    expect(store.state().history['t:squat'][0].sets).toEqual([{ w: 60, r: 10 }]);
    expect(workout.hasDrafts(k)).toBe(false);
    workout.setDraft(k, 't:squat', 1, 'w', '5');
    await workout.resetLog(k);
    expect(workout.hasDrafts(k)).toBe(false);
  });

  it('does not accept a set, an exercise or a workout without a weight (0 is a weight)', async () => {
    const k = '2026-10-05';
    plans.saveWorkout(k, { 1: [ex('Squat')] });
    expect(await workout.toggleSet(k, 't:squat', 0)).toBe(false);
    expect(workout.get(k).ex['t:squat'].sets[0].done).toBe(false);
    expect(workout.get(k).ex['t:squat'].sets[0].r).toBe(''); // the reps were not filled in either
    await workout.setValue(k, 't:squat', 0, 'r', '10');
    expect(await workout.toggleExercise(k, 't:squat')).toBe(false);
    expect(await workout.save(k)).toBe(0);
    await workout.setValue(k, 't:squat', 0, 'w', '0');
    expect(await workout.save(k)).toBe(1);
    expect(store.state().history['t:squat'][0].sets).toEqual([{ w: 0, r: 10 }]);
  });

  it('saves a trainer workout into history', async () => {
    plans.saveWorkout('2026-10-05', { 1: [ex('Squat')] });
    workout.setValue('2026-10-05', 't:squat', 0, 'w', '60');
    workout.setValue('2026-10-05', 't:squat', 0, 'r', '10');
    expect(await workout.save('2026-10-05')).toBe(1);
    expect(store.state().history['t:squat'][0].sets).toEqual([{ w: 60, r: 10 }]);
  });
});

describe('WorkoutService trainer times', () => {
  let store: StoreService;
  let workout: WorkoutService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(StoreService);
    workout = TestBed.inject(WorkoutService);
  });

  it('computes the duration from typed times, also across midnight', () => {
    const wo = workout.blank('2026-10-07');
    expect(workout.duration(wo)).toBeNull();
    expect(workout.duration({ ...wo, startTime: '18:30', endTime: '19:45' })).toBe(75);
    expect(workout.duration({ ...wo, startTime: '23:30', endTime: '00:20' })).toBe(50);
  });

  it('does not start the live timer in trainer mode, but keeps typed times', () => {
    store.mutate((s) => (s.settings.workoutMode = 'trainer'));
    workout.start('2026-10-07');
    workout.setTime('2026-10-07', 'startTime', '18:00');
    const wo = store.peek('2026-10-07')!.workout!;
    expect(wo.startedAt).toBeNull();
    expect(wo.startTime).toBe('18:00');
  });
});
