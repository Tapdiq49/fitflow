import type { SystemFood } from '../food/food';
import type { WeekPlan } from '../meal/meal';
import type { HistoryEntry, WorkoutWeekPlan } from '../workout/workout';
import type { Settings } from '../settings/settings';
import type { DayRecord } from '../day/day';
import type { WeightEntry } from '../body/body';

export interface AppState {
  settings: Settings;
  /** System foods from the last successful backend read; empty until the first one. */
  foodCache: SystemFood[];
  /** Trainer plans written by the user, keyed by the week's Monday. Weeks without an entry reuse the latest earlier one. */
  weekPlans: Record<string, WeekPlan>;
  /** Trainer workouts keyed by the week's Monday; a week without an entry reuses the latest earlier one. */
  workoutPlans: Record<string, WorkoutWeekPlan>;
  days: Record<string, DayRecord>;
  history: Record<string, HistoryEntry[]>;
  weights: WeightEntry[];
}
