export type Unit = 'q' | 'ədəd' | 'ölçü';
export type FoodRole = 'protein' | 'carb' | 'fat' | 'fruit' | 'veg' | 'dairy' | 'supp';

/** Macros are per 100 q (unit "q") or per piece/scoop. */
export interface Food {
  name: string;
  unit: Unit;
  k: number;
  p: number;
  c: number;
  f: number;
  role: FoodRole;
  step: number;
  min: number;
  max: number;
}

export interface Macros {
  k: number;
  p: number;
  c: number;
  f: number;
}

export type TemplateKey = 'breakfast' | 'snack' | 'lunch' | 'pre' | 'post' | 'dinner';
export type SlotId = TemplateKey | 'snack2' | 'supp' | 'custom';

export interface MealTemplate {
  id: string;
  name: string;
  /** Main protein source — used to avoid repeats on consecutive days. */
  main?: string;
  light?: boolean;
  items: ReadonlyArray<readonly [string, number]>;
}

export interface MealItem {
  /** Code of a system food. */
  food?: string;
  amt: number;
  base?: number;
  /** Snapshot taken when the item was created (system foods): unit and macros per 100 g / per piece, so the saved menu never changes with the food list. */
  unit?: Unit;
  per?: Macros;
  note?: string;
  /** Custom (non-database) item fields. */
  name?: string;
  k?: number;
  p?: number;
  c?: number;
  f?: number;
  amtLabel?: string;
}

export interface Meal {
  id: string;
  slot: SlotId;
  name: string;
  templateId?: string;
  main?: string | null;
  time: string;
  done: boolean;
  custom?: boolean;
  locked?: boolean;
  items: MealItem[];
}

export type DayType = 'training' | 'cardio' | 'rest';
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

export interface HistorySet {
  w: number;
  r: number;
}

export interface HistoryEntry {
  date: string;
  sets: HistorySet[];
}

export interface WeightEntry {
  date: string;
  kg: number;
  waist: number | null;
}

/** 'auto' = generated menu hitting the kcal/protein targets; 'trainer' = fixed 7-day plan from the trainer. */
export type MenuMode = 'auto' | 'trainer';

export type Lang = 'az' | 'en' | 'ru';

/** 'system' follows the OS light/dark preference. */
export type ThemeMode = 'system' | 'light' | 'dark';

/** 'program' = built-in Full Body A/B with progression; 'trainer' = exercises the trainer gives, entered per week. */
export type WorkoutMode = 'program' | 'trainer';

export interface Settings {
  height: number;
  startWeight: number;
  kcalTarget: number;
  proteinTarget: number;
  mealsPerDay: number;
  useWhey: boolean;
  menuMode: MenuMode;
  workoutMode: WorkoutMode;
  theme: ThemeMode;
  lang: Lang;
  showCreatine: boolean;
  workoutTime: string;
  wakeTime: string;
  sleepTime: string;
  programStart: string;
  /** Local date key of the day the guest notice was closed; '' = never. It comes back after a week. */
  guestNoticeDismissedAt: string;
}

/** One meal of the trainer's plan. */
export interface TrainerMeal {
  slot: SlotId;
  time: string;
  name: string;
  items: MealItem[];
}

/** Trainer plan for one week, keyed by weekday (1 = Monday). */
export type WeekPlan = Record<number, TrainerMeal[]>;

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

/** A system food as the backend sends it. Kept in the saved state (`AppState.foodCache`) so the menu generator also works offline. */
export interface SystemFood {
  code: string;
  names: Partial<Record<Lang, string>>;
  unit: Unit;
  /** Per 100 g when the unit is 'q', per single unit otherwise. */
  k: number;
  p: number;
  c: number;
  f: number;
  role: FoodRole;
  step: number;
  min: number;
  max: number;
}

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

export interface TimelineItem {
  id: string;
  time: string;
  label: string;
  sub: string;
  done: boolean;
  auto?: boolean;
  frac?: number;
}

export interface BodyStats {
  first: WeightEntry;
  cur: WeightEntry;
  today: WeightEntry | null;
  avg7: number | null;
  rate: number | null;
  change: number;
  waistFirst: number | null;
  waistCur: number | null;
}

export interface Advice {
  level: 'info' | 'warn' | 'good';
  text: string;
  delta?: number;
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
