import type { Meal } from '../meal/meal';
import type { CardioType, WorkoutLog } from '../workout/workout';
import type { Settings } from '../settings/settings';

export type DayType = 'training' | 'cardio' | 'rest';

/** Settings that shape a day's timeline; frozen into past days when the settings change, so history keeps what it was. */
export type DaySnapshot = Pick<Settings, 'workoutTime' | 'wakeTime' | 'sleepTime' | 'showCreatine'>;

export interface DayRecord {
  menu: Meal[] | null;
  water: number;
  waterLog: number[];
  sleep: { bed: string; wake: string };
  checks: Record<string, boolean>;
  creatine: boolean;
  workout: WorkoutLog | null;
  cardio: { type: CardioType; minutes: string; done: boolean };
  /** Null while the day uses the live settings; set once the day is in the past and a setting changed. */
  snap: DaySnapshot | null;
}

export interface TimelineItem {
  id: string;
  time: string;
  label: string;
  sub: string;
  done: boolean;
  auto?: boolean;
  frac?: number;
}

export interface WeekDay {
  k: string;
  type: DayType;
  score: number | null;
  p: number | null;
  water: number | null;
  sleep: number | null;
  workout: boolean;
  cardio: boolean;
}

export const newDay = (): DayRecord => ({
  menu: null,
  water: 0,
  waterLog: [],
  sleep: { bed: '', wake: '' },
  checks: {},
  creatine: false,
  workout: null,
  cardio: { type: 'walk', minutes: '', done: false },
  snap: null,
});
