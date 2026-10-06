import { Injectable, inject } from '@angular/core';
import { EXERCISES, PROGRAM } from '../data/program';
import { DayRecord, Exercise, HistoryEntry, Recommendation, WorkoutLog } from '../models';
import { F, parseNum, rnd } from '../utils';
import { ProgramService } from './program.service';
import { StoreService } from './store.service';
import { ToastService } from './toast.service';

/** Workout logging and double-progression recommendations. */
@Injectable({ providedIn: 'root' })
export class WorkoutService {
  private readonly store = inject(StoreService);
  private readonly program = inject(ProgramService);
  private readonly toast = inject(ToastService);

  blank(k: string): WorkoutLog {
    const variant = this.program.variantOf(k);
    return {
      variant,
      startedAt: null,
      savedAt: null,
      ex: Object.fromEntries(
        PROGRAM[variant].map((id) => [id, { done: false, sets: Array.from({ length: EXERCISES[id].sets }, () => ({ w: '', r: '', done: false })) }]),
      ),
    };
  }

  /** Read-only view of the day's log (a blank one if nothing was logged). */
  get(k: string): WorkoutLog {
    const wo = this.store.peek(k)?.workout;
    if (wo && (wo.variant === this.program.variant(k) || wo.savedAt)) return wo;
    return this.blank(k);
  }

  start(k: string): void {
    this.store.mutateDay(k, (d) => {
      const wo = this.ensureIn(d, k);
      for (const id of PROGRAM[wo.variant]) {
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
      if (s.done && s.r === '') s.r = String(EXERCISES[id].min);
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
    const entries = PROGRAM[wo.variant]
      .map((id) => ({
        id,
        sets: wo.ex[id].sets
          .filter((s) => parseNum(s.r) > 0)
          .map((s) => ({ w: parseNum(s.w) || 0, r: parseNum(s.r) })),
      }))
      .filter((e) => e.sets.length);
    if (!entries.length) {
      this.toast.show('Heç bir set qeyd olunmayıb — təkrar sayını daxil et');
      return 0;
    }
    this.store.mutate((s) => {
      for (const id of PROGRAM[wo.variant]) {
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
    this.toast.show(`Məşq yadda saxlandı ✓ (${entries.length} hərəkət)`);
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
    const ex = EXERCISES[id];
    const hist = this.history(id, k);
    if (!hist.length) return { w: null, last: null, kind: 'new', text: 'İlk dəfə: rahat çəki seç, 3–4 təkrar ehtiyatda saxla.' };
    const last = hist[hist.length - 1];
    const sets = last.sets.filter((s) => s.r > 0);
    if (!sets.length) return { w: null, last, kind: 'new', text: 'Son məşqdə set qeyd olunmayıb.' };

    if (ex.kind === 'time') {
      const best = Math.max(...sets.map((s) => s.r));
      const allMax = sets.length >= ex.sets && sets.every((s) => s.r >= ex.max);
      return allMax
        ? { w: null, last, kind: 'up', text: `Bütün setlər ${ex.max} san ✓ — növbəti dəfə 60–75 saniyə hədəflə.` }
        : { w: null, last, kind: 'same', text: `Hədəf: hər set ~${Math.min(best + 5, ex.max)} saniyə.` };
    }

    const w = Math.max(...sets.map((s) => s.w || 0));
    const top = sets.filter((s) => (s.w || 0) === w);
    if (top.length >= ex.sets && top.every((s) => s.r >= ex.max)) {
      const nw = rnd(w + this.increment(ex, this.program.phase(k).n, w), 1);
      return { w: nw, last, kind: 'up', text: `Bütün setlərdə ${ex.max}+ təkrar ✓ → ${nw} kq ilə ${ex.min} təkrardan başla.` };
    }
    if (top.some((s) => s.r < ex.min)) {
      const prev = hist[hist.length - 2];
      const prevBelow = prev?.sets.some((s) => (s.w || 0) === w && s.r > 0 && s.r < ex.min);
      if (prevBelow) {
        const nw = rnd(Math.round((w * 0.9) / ex.inc) * ex.inc, 1);
        return { w: nw, last, kind: 'down', text: `2 məşq ardıcıl hədəfdən aşağı — çəkini ~10% azalt (${nw} kq), texnikanı bərpa et.` };
      }
      return { w, last, kind: 'same', text: `Təkrarlar ${ex.min}-dən aşağıdır — eyni çəkidə qal.` };
    }
    return { w, last, kind: 'same', text: `Eyni çəki — hər setdə +1 təkrar hədəflə (${ex.max}-ə çatanda artır).` };
  }

  lastStr(last: HistoryEntry | null, ex: Exercise): string {
    if (!last) return '—';
    return last.sets
      .filter((s) => s.r > 0)
      .map((s) => (ex.kind === 'time' ? `${s.r}s` : `${F.kg(s.w)}×${s.r}`))
      .join(', ');
  }

  private increment(ex: Exercise, phase: number, w: number): number {
    let inc = phase < 3 && ex.incEarly != null ? ex.incEarly : ex.inc;
    if (w > 0) inc = Math.min(inc, Math.max(1, Math.round(w * 0.05 * 2) / 2));
    return inc;
  }

  private ensureIn(d: DayRecord, k: string): WorkoutLog {
    const v = this.program.variantOf(k);
    if (!d.workout || (d.workout.variant !== v && !d.workout.savedAt)) d.workout = this.blank(k);
    return d.workout;
  }
}
