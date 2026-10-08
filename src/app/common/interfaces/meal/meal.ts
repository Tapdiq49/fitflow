import type { Unit, Macros } from '../food/food';

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

/** One meal of the trainer's plan. */
export interface TrainerMeal {
  slot: SlotId;
  time: string;
  name: string;
  items: MealItem[];
}

/** Trainer plan for one week, keyed by weekday (1 = Monday). */
export type WeekPlan = Record<number, TrainerMeal[]>;
