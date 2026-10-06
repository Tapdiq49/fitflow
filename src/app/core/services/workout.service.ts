import { Injectable, inject } from '@angular/core';
import { EXERCISES, PROGRAM } from '../data/program';
import { TRAINER_EX_PREFIX } from '../data/trainer-plan';
import { DayRecord, Exercise, HistoryEntry, Recommendation, WorkoutLog } from '../models';
import { DateU, F, parseNum, rnd } from '../utils';
import { ProgramService } from './program.service';
import { StoreService } from './store.service';
import { ToastService } from './toast.service';
import { TrainerPlanService } from './trainer-plan.service';
import { t } from '../i18n/translate';

export interface PlannedExercise {
  id: string;
  ex: Exercise;
}

/** Workout logging and double-progression recommendations. */
@Injectable({ providedIn: 'root' })
export class WorkoutService {
  private readonly store = inject(StoreService);
  private readonly program = inject(ProgramService);
  private readonly toast = inject(ToastService);
  private readonly plans = inject(TrainerPlanService);

  /** Short calendar tag for a gym day. */
  tag(k: string): string {
    return this.isTrainer() ? t('common.gym') : `FB ${this.program.variantOf(k)}`;
  }

  isTrainer(): boolean {
    return this.store.settings().workoutMode === 'trainer';
  }

  title(k: string): string {
    return this.isTrainer() ? t('workoutSvc.trainerWorkout') : `FULL BODY ${this.program.variantOf(k)}`;
  }

  /** Exercises of the day: the built-in A/B program, or what the trainer gave for that weekday (empty on non-gym days). */
  exercises(k: string): PlannedExercise[] {
    if (!this.isTrainer()) return PROGRAM[this.program.variantOf(k)].map((id) => ({ id, ex: EXERCISES[id] }));
    if (this.program.dayType(k) !== 'training') return [];
    return (this.plans.workoutFor(DateU.monday(k))[DateU.dow(k)] ?? []).map((t) => ({ id: t.id, ex: this.toExercise(t) }));
  }

  /** Definition of any exercise id: built-in, or the newest trainer entry with that id. */
  defOf(id: string): Exercise {
    const base = EXERCISES[id];
    if (base) return base;
    const t = this.plans.findExercise(id);
    return this.toExercise(t ?? { name: id.replace(TRAINER_EX_PREFIX, ''), sets: 3, min: 8, max: 12 });
  }

  blank(k: string): WorkoutLog {
    const variant = this.program.variantOf(k);
    return {
      variant,
      startedAt: null,
      savedAt: null,
      ex: Object.fromEntries(
        this.exercises(k).map(({ id, ex }) => [id, { done: false, sets: Array.from({ length: ex.sets }, () => ({ w: '', r: '', done: false })) }]),
      ),
    };
  }

  /** Read-only view of the day's log (a blank one if nothing was logged). */
  get(k: string): WorkoutLog {
    const wo = this.store.peek(k)?.workout;
    if (wo && (this.matches(wo, k) || wo.savedAt)) return wo;
    return this.blank(k);
  }

  start(k: string): void {
    this.store.mutateDay(k, (d) => {
      const wo = this.ensureIn(d, k);
      for (const id of Object.keys(wo.ex)) {
        const rec = this.recommend(id, k);
        wo.ex[id].sets.forEach((s) => {
          if (s.w === '' && rec.w != null) s.w = String(rec.w);
        });
      }
      wo.startedAt ??= Date.now();
    });
  }

  setValue(k: string, id: string, i: number, field: 'w' | 'r', value: string): void {
    this.store.mutateDay(k, (d) => (this.ensureIn(d, k).ex[id].sets[i][field] = value));
  }

  /** Toggles a set; returns true when it became done. */
  toggleSet(k: string, id: string, i: number): boolean {
    let done = false;
    this.store.mutateDay(k, (d) => {
      const wo = this.ensureIn(d, k);
      const s = wo.ex[id].sets[i];
      s.done = !s.done;
      if (s.done && s.r === '') s.r = String(this.defOf(id).min);
      wo.startedAt ??= Date.now();
      done = s.done;
    });
    return done;
  }

  addSet(k: string, id: string): void {
    this.store.mutateDay(k, (d) => {
      const sets = this.ensureIn(d, k).ex[id].sets;
      sets.push({ w: sets.at(-1)?.w ?? '', r: '', done: false });
    });
  }

  removeSet(k: string, id: string, i: number): void {
    this.store.mutateDay(k, (d) => this.ensureIn(d, k).ex[id].sets.splice(i, 1));
  }

  toggleExercise(k: string, id: string): void {
    this.store.mutateDay(k, (d) => {
      const st = this.ensureIn(d, k).ex[id];
      st.done = !st.done;
      if (st.done) st.sets.forEach((s) => (s.done = parseNum(s.r) > 0 || s.done));
    });
  }

  /** Writes logged sets into the per-exercise history. Returns the number of exercises saved. */
  save(k: string): number {
    const wo = this.get(k);
    const entries = Object.keys(wo.ex)
      .map((id) => ({
        id,
        sets: wo.ex[id].sets
          .filter((s) => parseNum(s.r) > 0)
          .map((s) => ({ w: parseNum(s.w) || 0, r: parseNum(s.r) })),
      }))
      .filter((e) => e.sets.length);
    if (!entries.length) {
      this.toast.show(t('workoutSvc.noSetWasRecorded'));
      return 0;
    }
    this.store.mutate((s) => {
      for (const id of Object.keys(wo.ex)) {
        s.history[id] = (s.history[id] ?? []).filter((e) => e.date !== k);
      }
      for (const e of entries) {
        s.history[e.id].push({ date: k, sets: e.sets });
        s.history[e.id].sort((a, b) => a.date.localeCompare(b.date));
      }
      const d = s.days[k];
      if (d) {
        this.ensureIn(d, k).savedAt = Date.now();
        d.checks['workout'] = true;
      }
    });
    this.toast.show(t('workoutSvc.workoutSavedNExercises', { n: entries.length }));
    return entries.length;
  }

  history(id: string, before: string): HistoryEntry[] {
    return (this.store.state().history[id] ?? []).filter((h) => h.date < before);
  }

  /**
   * Double progression: when every working set reaches the top of the rep range the
   * weight goes up by a small step (capped at ~5% and smaller during the first 4 weeks).
   */
  recommend(id: string, k: string): Recommendation {
    const ex = this.defOf(id);
    const hist = this.history(id, k);
    if (id.startsWith(TRAINER_EX_PREFIX)) {
      // Trainer exercises: no automatic suggestion, just show what was lifted last time.
      const last = hist.at(-1) ?? null;
      return { w: null, last, kind: last ? 'same' : 'new', text: last ? t('workoutSvc.chooseWeightAccordingTo') : t('workoutSvc.firstTimeStartWith') };
    }
    if (!hist.length) return { w: null, last: null, kind: 'new', text: t('workoutSvc.firstTimeChooseComfortable') };
    const last = hist[hist.length - 1];
    const sets = last.sets.filter((s) => s.r > 0);
    if (!sets.length) return { w: null, last, kind: 'new', text: t('workoutSvc.noSetsWereRecorded') };

    if (ex.kind === 'time') {
      const best = Math.max(...sets.map((s) => s.r));
      const allMax = sets.length >= ex.sets && sets.every((s) => s.r >= ex.max);
      return allMax
        ? { w: null, last, kind: 'up', text: t('workoutSvc.allSetsReachedN', { max: ex.max }) }
        : { w: null, last, kind: 'same', text: t('workoutSvc.targetNSecondsPer', { n: Math.min(best + 5, ex.max) }) };
    }

    const w = Math.max(...sets.map((s) => s.w || 0));
    const top = sets.filter((s) => (s.w || 0) === w);
    if (top.length >= ex.sets && top.every((s) => s.r >= ex.max)) {
      const nw = rnd(w + this.increment(ex, this.program.phase(k).n, w), 1);
      return { w: nw, last, kind: 'up', text: t('workoutSvc.allSetsHitN', { max: ex.max, w: nw, min: ex.min }) };
    }
    if (top.some((s) => s.r < ex.min)) {
      const prev = hist[hist.length - 2];
      const prevBelow = prev?.sets.some((s) => (s.w || 0) === w && s.r > 0 && s.r < ex.min);
      if (prevBelow) {
        const nw = rnd(Math.round((w * 0.9) / ex.inc) * ex.inc, 1);
        return { w: nw, last, kind: 'down', text: t('workoutSvc.2WorkoutsInRow', { w: nw }) };
      }
      return { w, last, kind: 'same', text: t('workoutSvc.repsBelowNStay', { min: ex.min }) };
    }
    return { w, last, kind: 'same', text: t('workoutSvc.sameWeightAimFor', { max: ex.max }) };
  }

  lastStr(last: HistoryEntry | null, ex: Exercise): string {
    if (!last) return '—';
    return last.sets
      .filter((s) => s.r > 0)
      .map((s) => (ex.kind === 'time' ? `${s.r}${t('common.s')}` : `${F.kg(s.w)}×${s.r}`))
      .join(', ');
  }

  private increment(ex: Exercise, phase: number, w: number): number {
    let inc = phase < 3 && ex.incEarly != null ? ex.incEarly : ex.inc;
    if (w > 0) inc = Math.min(inc, Math.max(1, Math.round(w * 0.05 * 2) / 2));
    return inc;
  }

  /** Whether an unsaved log still belongs to today's plan (same A/B variant, or the same trainer exercises). */
  private matches(wo: WorkoutLog, k: string): boolean {
    if (!this.isTrainer()) return wo.variant === this.program.variant(k);
    const ids = this.exercises(k).map((e) => e.id);
    const have = Object.keys(wo.ex);
    return ids.length === have.length && ids.every((id) => have.includes(id));
  }

  private toExercise(t: { name: string; sets: number; min: number; max: number }): Exercise {
    return { name: t.name, sets: t.sets, min: t.min, max: t.max, kind: 'upper', inc: 0, note: '' };
  }

  private ensureIn(d: DayRecord, k: string): WorkoutLog {
    if (!d.workout || (!this.matches(d.workout, k) && !d.workout.savedAt)) d.workout = this.blank(k);
    return d.workout;
  }
}
