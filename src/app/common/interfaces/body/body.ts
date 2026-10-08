import type { Sex } from '../settings/settings';

export interface WeightEntry {
  date: string;
  kg: number;
  waist: number | null;
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

/** Height (cm), starting weight (kg), age (years) and sex, all entered. */
export interface BodyBasics {
  height: number;
  startWeight: number;
  age: number;
  sex: Sex;
}
