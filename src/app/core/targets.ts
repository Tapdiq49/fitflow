import { Goal, Sex } from '../common/interfaces';
import { clamp } from './utils';

/** Bounds of the daily targets the app accepts (also the bounds of the settings form). */
export const KCAL_MIN = 1500;
export const KCAL_MAX = 4500;
export const PROTEIN_MIN = 80;
export const PROTEIN_MAX = 300;

export const UNDERWEIGHT_BMI = 18.5;
/** Below this BMI no menu or target is given at all: that is a case for a doctor, not for a meal plan. */
export const SEVERE_BMI = 16;
/** The app is made for adults; the adult formulas and BMI ranges do not hold for younger people. */
export const ADULT_AGE = 18;
export const OBESE_BMI = 30;

/** Activity factor: trains three to five times a week (what this app is for). */
const ACTIVITY = 1.55;

export const bmiOf = (heightCm: number, kg: number): number => kg / (heightCm / 100) ** 2;

/** A height and weight that cannot belong to one person (a typo such as 100 cm with 300 kg, BMI 300) are refused. */
export const BMI_PLAUSIBLE = { min: 10, max: 70 } as const;
export const plausibleBody = (heightCm: number, kg: number): boolean => {
  const bmi = bmiOf(heightCm, kg);
  return bmi >= BMI_PLAUSIBLE.min && bmi <= BMI_PLAUSIBLE.max;
};

/** Why the app must not give a menu or calorie targets to this person. */
export type BodyIssue = 'minor' | 'underweight';

/** Null when the app may advise; otherwise the reason it must not (under 18, or a BMI below 16). */
export function bodyIssue(heightCm: number, kg: number, age: number): BodyIssue | null {
  if (age < ADULT_AGE) return 'minor';
  if (bmiOf(heightCm, kg) < SEVERE_BMI) return 'underweight';
  return null;
}

export interface TargetInput {
  height: number;
  /** The current weight in kg. */
  weight: number;
  age: number;
  sex: Sex;
  goal: Goal;
}

export interface TargetSuggestion {
  bmi: number;
  /** Calories that keep the weight (Mifflin-St Jeor × activity). */
  maintenance: number;
  kcal: number;
  protein: number;
  /** The goal the numbers are for. Differs from the asked one when it would be unsafe (losing weight while underweight). */
  goal: Goal;
  goalChanged: boolean;
}

const roundTo = (n: number, step: number): number => Math.round(n / step) * step;

/**
 * Daily calories and protein for a person and a goal.
 * Calories: Mifflin-St Jeor × activity; losing takes 20 % off (never more than 500 kcal), gaining adds 10 % (250–400 kcal); never below KCAL_MIN.
 * Protein: 2.0 g per kg when losing, 1.8 otherwise; for BMI 30 and over it is counted on the weight at BMI 27 so it does not run away.
 * Losing weight is not offered below BMI 18.5: that case gets the maintenance numbers.
 */
export function suggestTargets(i: TargetInput): TargetSuggestion {
  const bmi = bmiOf(i.height, i.weight);
  const goal: Goal = i.goal === 'lose' && bmi < UNDERWEIGHT_BMI ? 'maintain' : i.goal;
  const bmr = 10 * i.weight + 6.25 * i.height - 5 * i.age + (i.sex === 'male' ? 5 : -161);
  const maintenance = bmr * ACTIVITY;
  const delta = goal === 'lose' ? -Math.min(500, maintenance * 0.2) : goal === 'gain' ? clamp(maintenance * 0.1, 250, 400) : 0;
  const kcal = roundTo(clamp(maintenance + delta, KCAL_MIN, KCAL_MAX), 10);
  const basis = bmi >= OBESE_BMI ? 27 * (i.height / 100) ** 2 : i.weight;
  const protein = roundTo(clamp(basis * (goal === 'lose' ? 2.0 : 1.8), PROTEIN_MIN, PROTEIN_MAX), 5);
  return { bmi, maintenance: roundTo(maintenance, 10), kcal, protein, goal, goalChanged: goal !== i.goal };
}
