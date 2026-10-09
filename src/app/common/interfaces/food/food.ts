import type { Lang } from '../settings/settings';
import type { AppState } from '../state/app-state';

/** Grams and millilitres (the numbers of a food are per 100), pieces, tablespoons (x/q), teaspoons (ç.q) and scoops (per one). */
export type Unit = 'q' | 'ml' | 'ədəd' | 'x/q' | 'ç.q' | 'ölçü';

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
