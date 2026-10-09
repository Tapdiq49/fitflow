import { Injectable, inject, signal } from '@angular/core';
import { EXERCISES, PROGRAM } from '../data/program';
import { TRAINER_EX_PREFIX } from '../data/trainer-plan';
import { DayRecord, Exercise, HistoryEntry, Recommendation, WorkoutLog } from '../../common/interfaces';
import { DateU, F, parseNum, rnd, toMin } from '../utils';
import { BUSY } from '../busy-keys';
import { DataSyncService } from './data-sync.service';
import { ProgramService } from './program.service';
import { StoreService } from './store.service';
import { ToastService } from './toast.service';
import { TrainerPlanService } from './trainer-plan.service';
import { t } from '../i18n/translate';

/** A weight or reps value typed into a field and not sent to the account yet. */
interface Draft {
  k: string;
  id: string;
  i: number;
  field: 'w' | 'r';
  value: string;
}

const draftKey = (k: string, id: string, i: number, field: 'w' | 'r'): string => JSON.stringify([k, id, i, field]);

export interface PlannedExercise {
  id: string;
  ex: Exercise;
}

/** Workout logging and double-progression recommendations. */
@Injectable({ providedIn: 'root' })
export class WorkoutService {
  private readonly store = inject(StoreService);
  private readonly data = inject(DataSyncService);
  private readonly program = inject(ProgramService);
  private readonly toast = inject(ToastService);
  private readonly plans = inject(TrainerPlanService);

  /**
   * Weights and reps typed into the fields. Typing sends nothing: they travel with the next change of that day (a set ticked, an exercise
   * completed, the workout saved, a set added), in the same request. Kept in memory only, so they are gone when the app is closed.
   */
  private readonly drafts = signal<Readonly<Record<string, Draft>>>({});

  /** Short calendar tag for a gym day. */
  tag(k: string): string {
    return this.isTrainer() ? t('common.gym') : `FB ${this.program.variantOf(k)}`;
  }

  isTrainer(): boolean {
    return this.store.effectiveWorkoutMode() === 'trainer';
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

  /** What a weight / reps field shows: the text typed into it and not sent yet, else what is stored. */
  fieldValue(k: string, id: string, i: number, field: 'w' | 'r', stored: string | number): string {
    return this.drafts()[draftKey(k, id, i, field)]?.value ?? String(stored);
  }

  /** Remembers a typed weight / reps value. No request: it is sent with the next change of the day. */
  setDraft(k: string, id: string, i: number, field: 'w' | 'r', value: string): void {
    this.drafts.update((m) => ({ ...m, [draftKey(k, id, i, field)]: { k, id, i, field, value } }));
  }

  /** Whether the day has typed values that were not sent yet. */
  hasDrafts(k: string): boolean {
    return Object.values(this.drafts()).some((d) => d.k === k);
  }

  private clearDrafts(k: string): void {
    this.drafts.update((m) => Object.fromEntries(Object.entries(m).filter(([, d]) => d.k !== k)));
  }

  /** Writes the day's typed values into a log; returns the ones that were written. */
  private applyDrafts(wo: WorkoutLog, k: string): Draft[] {
    const mine = Object.values(this.drafts()).filter((d) => d.k === k);
    for (const d of mine) {
      const set = wo.ex[d.id]?.sets[d.i];
      if (set) set[d.field] = d.value;
    }
    return mine;
  }

  /** Forgets the typed values that were stored (a value typed again meanwhile stays). */
  private dropDrafts(sent: Draft[]): void {
    this.drafts.update((m) => {
      const next = { ...m };
      for (const d of sent) {
        const key = draftKey(d.k, d.id, d.i, d.field);
        if (next[key]?.value === d.value) delete next[key];
      }
      return next;
    });
  }

  /**
   * Changes the workout log of a day. The typed values are written into the log first and travel in the same request; they are
   * forgotten once it is stored. `fn` may return false to change nothing (the typed values are kept then).
   */
  private async commitWorkout(k: string, fn: (wo: WorkoutLog) => unknown, busyKey: string): Promise<boolean> {
    let sent: Draft[] = [];
    let aborted = false;
    const saved = await this.data.commitDay(
      k,
      (d) => {
        const wo = this.ensureIn(d, k);
        sent = this.applyDrafts(wo, k);
        const result = fn(wo);
        aborted = result === false;
        return result;
      },
      busyKey,
    );
    if (saved && !aborted) this.dropDrafts(sent);
    return saved;
  }

  start(k: string): Promise<boolean> {
    return this.commitWorkout(
      k,
      (wo) => {
        for (const id of Object.keys(wo.ex)) {
          const rec = this.recommend(id, k);
          wo.ex[id].sets.forEach((s) => {
            if (s.w === '' && rec.w != null) s.w = String(rec.w);
          });
        }
        if (!this.isTrainer()) wo.startedAt ??= Date.now();
        return true;
      },
      BUSY.workoutStart(k),
    );
  }

  /** Trainer mode: sets the workout start/end time typed in afterwards. */
  setTime(k: string, field: 'startTime' | 'endTime', value: string): Promise<boolean> {
    return this.commitWorkout(
      k,
      (wo) => {
        wo[field] = value;
        return true;
      },
      BUSY.workoutTime(k, field),
    );
  }

  /** Minutes between the typed start and end time (past midnight counts as the next day); null until both are set. */
  duration(wo: WorkoutLog): number | null {
    if (!wo.startTime || !wo.endTime) return null;
    return (toMin(wo.endTime) - toMin(wo.startTime) + 1440) % 1440;
  }

  /** Stores one value at once (the fields of the page only keep a draft, see `setDraft`). */
  setValue(k: string, id: string, i: number, field: 'w' | 'r', value: string): Promise<boolean> {
    return this.commitWorkout(
      k,
      (wo) => {
        const set = wo.ex[id]?.sets[i];
        if (!set) return false;
        set[field] = value;
        return true;
      },
      BUSY.setField(k, id, i, field),
    );
  }

  /** A weight must be typed for every exercise but the timed ones (0 for a bodyweight exercise): reps without a weight are not a result. */
  private needsWeight(id: string): boolean {
    return this.defOf(id).kind !== 'time';
  }

  private hasWeight(s: { w: string | number }): boolean {
    return String(s.w).trim() !== '';
  }

  /** Toggles a set (with the typed weight and reps); resolves true when it became done (false also when it could not be saved, or the weight is missing). */
  async toggleSet(k: string, id: string, i: number): Promise<boolean> {
    let done = false;
    let missingWeight = false;
    const saved = await this.commitWorkout(
      k,
      (wo) => {
        const s = wo.ex[id]?.sets[i];
        if (!s) return false;
        if (!s.done && this.needsWeight(id) && !this.hasWeight(s)) {
          missingWeight = true;
          return false;
        }
        s.done = !s.done;
        if (s.done && s.r === '') s.r = String(this.defOf(id).min);
        if (!this.isTrainer()) wo.startedAt ??= Date.now();
        done = s.done;
        return true;
      },
      BUSY.set(k, id, i),
    );
    if (missingWeight) this.toast.show(t('workoutSvc.enterWeightFirst'));
    return saved && done;
  }

  addSet(k: string, id: string): Promise<boolean> {
    return this.commitWorkout(
      k,
      (wo) => {
        const sets = wo.ex[id]?.sets;
        if (!sets) return false;
        sets.push({ w: sets.at(-1)?.w ?? '', r: '', done: false });
        return true;
      },
      BUSY.addSet(k, id),
    );
  }

  removeSet(k: string, id: string, i: number): Promise<boolean> {
    return this.commitWorkout(
      k,
      (wo) => {
        const sets = wo.ex[id]?.sets;
        if (!sets) return false;
        sets.splice(i, 1);
        return true;
      },
      BUSY.set(k, id, i),
    );
  }

  async toggleExercise(k: string, id: string): Promise<boolean> {
    let missingWeight = false;
    const saved = await this.commitWorkout(
      k,
      (wo) => {
        const st = wo.ex[id];
        if (!st) return false;
        if (!st.done && this.needsWeight(id) && st.sets.some((s) => parseNum(s.r) > 0 && !this.hasWeight(s))) {
          missingWeight = true;
          return false;
        }
        st.done = !st.done;
        if (st.done) st.sets.forEach((s) => (s.done = parseNum(s.r) > 0 || s.done));
        return true;
      },
      BUSY.exercise(k, id),
    );
    if (missingWeight) this.toast.show(t('workoutSvc.enterWeightFirst'));
    return saved;
  }

  /**
   * A saved workout that no longer fits the plan of its day (the plan or the workout mode changed after it was saved). It is kept as
   * the record of what was done, but its exercises are not the ones the page shows now; `resetLog` starts the day over.
   */
  isStale(k: string): boolean {
    const wo = this.store.peek(k)?.workout;
    return !!wo?.savedAt && !this.matches(wo, k);
  }

  /** Whether the day holds anything to throw away: a saved workout, typed weights or reps, a started workout, or the tick from the checklist. */
  hasProgress(k: string): boolean {
    if (this.hasDrafts(k)) return true;
    const d = this.store.peek(k);
    if (!d) return false;
    const wo = d.workout;
    const typed = (v: string | number): boolean => String(v).trim() !== '';
    return (
      !!d.checks['workout'] ||
      (!!wo &&
        (!!wo.savedAt || !!wo.startedAt || !!wo.startTime || !!wo.endTime || Object.values(wo.ex).some((e) => e.done || e.sets.some((s) => s.done || typed(s.w) || typed(s.r)))))
    );
  }

  /** Deletes the day's workout log and the results it wrote into the history, so the day starts over from the current plan. */
  async resetLog(k: string): Promise<boolean> {
    this.clearDrafts(k);
    const saved = await this.data.commit((s) => {
      const d = s.days[k];
      if (!d || (!d.workout && !d.checks['workout'])) return false;
      d.workout = null;
      delete d.checks['workout'];
      for (const id of Object.keys(s.history)) {
        s.history[id] = s.history[id].filter((h) => h.date !== k);
        if (!s.history[id].length) delete s.history[id];
      }
      return true;
    }, BUSY.toggle(k, 'workout'));
    if (saved) this.toast.show(t('workout.workoutReset'));
    return saved;
  }

  /** Writes logged sets into the per-exercise history. Returns the number of exercises saved. */
  async save(k: string): Promise<number> {
    const wo = structuredClone(this.get(k));
    this.applyDrafts(wo, k); // what is typed counts, whether or not a set was ticked
    if (Object.keys(wo.ex).some((id) => this.needsWeight(id) && wo.ex[id].sets.some((s) => parseNum(s.r) > 0 && !this.hasWeight(s)))) {
      this.toast.show(t('workoutSvc.enterWeightFirst'));
      return 0;
    }
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
    // The history rows and the day's check mark go to the account in one change.
    let sent: Draft[] = [];
    const saved = await this.data.commit((s) => {
      for (const id of Object.keys(wo.ex)) {
        s.history[id] = (s.history[id] ?? []).filter((e) => e.date !== k);
      }
      for (const e of entries) {
        s.history[e.id].push({ date: k, sets: e.sets });
        s.history[e.id].sort((a, b) => a.date.localeCompare(b.date));
      }
      const d = s.days[k];
      if (d) {
        const log = this.ensureIn(d, k);
        sent = this.applyDrafts(log, k);
        log.savedAt = Date.now();
        d.checks['workout'] = true;
      }
    }, BUSY.toggle(k, 'workout'));
    if (!saved) return 0;
    this.dropDrafts(sent);
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
    // The variant alone is not enough: a trainer log carries the day's A/B variant too, but not the program's exercises.
    if (!this.isTrainer()) return wo.variant === this.program.variant(k) && Object.keys(wo.ex).every((id) => id in EXERCISES);
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
