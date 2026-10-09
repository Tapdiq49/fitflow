import { DayRecord, HistorySet, WeightEntry } from '../../common/interfaces';

/** Everything of the signed-in user that is not a setting or a plan: the daily records, the weights and the exercise history. */
export interface StoredUserData {
  days: Record<string, DayRecord>;
  weights: WeightEntry[];
  /** Per exercise id, oldest first. */
  history: Record<string, { date: string; sets: HistorySet[] }[]>;
}

/** Sets of one exercise on one day; `null` deletes that entry. */
export interface HistoryChange {
  exerciseId: string;
  date: string;
  sets: HistorySet[] | null;
}

/** One change of the app, applied by the backend as a whole (all of it or nothing). A `null` value deletes. */
export interface UserDataChanges {
  /** Delete everything of the user first (import, "delete all data"). */
  clear?: boolean;
  /** Keyed by day (YYYY-MM-DD). */
  days?: Record<string, DayRecord | null>;
  /** Keyed by day (YYYY-MM-DD). */
  weights?: Record<string, { kg: number; waist: number | null } | null>;
  history?: HistoryChange[];
}

/**
 * Where the signed-in user's daily records, weights and exercise history live. Supabase implements it today
 * (`supabase-user-data.repository.ts`); a NestJS API replaces it by changing the provider in `app.config.ts`.
 * Guests have no repository: their data stays in localStorage. Methods throw `AuthError` (the app's backend error type).
 */
export abstract class UserDataRepository {
  /** All data of the current user. */
  abstract load(): Promise<StoredUserData>;
  /** Applies one change in a single transaction: either all of it is stored or none of it. */
  abstract apply(changes: UserDataChanges): Promise<void>;
}
