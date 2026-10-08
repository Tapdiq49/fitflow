export type Variant = 'A' | 'B';

export type CardioType = 'walk' | 'jog';

export interface WorkoutSet {
  /** Raw input text (kept as typed so decimals like "62," are not rewritten). */
  w: string | number;
  r: string | number;
  done: boolean;
}

export interface ExerciseLog {
  done: boolean;
  sets: WorkoutSet[];
}

export interface WorkoutLog {
  variant: Variant;
  startedAt: number | null;
  savedAt: number | null;
  /** Trainer mode: workout times ("HH:MM") typed in afterwards instead of a live timer; missing in older logs. */
  startTime?: string;
  endTime?: string;
  ex: Record<string, ExerciseLog>;
}

export interface HistorySet {
  w: number;
  r: number;
}

export interface HistoryEntry {
  date: string;
  sets: HistorySet[];
}

/** One exercise the trainer gave. `id` is derived from the name so history accumulates across weeks. */
export interface TrainerExercise {
  id: string;
  name: string;
  sets: number;
  min: number;
  max: number;
}

/** Trainer workout for one week, keyed by weekday (1 = Monday). */
export type WorkoutWeekPlan = Record<number, TrainerExercise[]>;

export interface Exercise {
  name: string;
  sets: number;
  min: number;
  max: number;
  kind: 'upper' | 'lower' | 'time';
  inc: number;
  /** Increment during the first 4 weeks (post-surgery caution). */
  incEarly?: number;
  note: string;
}

export interface Phase {
  n: 1 | 2 | 3;
  wk: number;
  name: string;
  rir: string;
  text: string;
}

export interface Recommendation {
  w: number | null;
  last: HistoryEntry | null;
  kind: 'new' | 'up' | 'same' | 'down';
  text: string;
}
