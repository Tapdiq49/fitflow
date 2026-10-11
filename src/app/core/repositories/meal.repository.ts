import { HttpHeaders, HttpResourceRequest } from '@angular/common/http';
import { Lang, TemplateKey } from '../../common/interfaces';
import { Page, PageParams } from '../paging';

/** One meal template as the backend holds it. */
export interface MealRow {
  id: string;
  /** Stable key saved menus refer to (`Meal.templateId`). */
  code: string;
  slot: TemplateKey;
  /** Place inside its slot. */
  position: number;
  names: Partial<Record<Lang, string>>;
  /** Main protein source (a food code); null = none. */
  main: string | null;
  /** Light enough for an evening meal after a training meal. */
  light: boolean;
  /** Food code and amount of every food. */
  items: [string, number][];
}

export type NewMealRow = Omit<MealRow, 'id'>;
export type MealChanges = Omit<MealRow, 'id' | 'code'>;

/**
 * Where the meal templates live. Supabase implements it today (`supabase-meal.repository.ts`); a NestJS API replaces it by changing the
 * provider in `app.config.ts`. Everyone reads the templates; writing needs the permission `meals.edit`, which the backend checks.
 * Methods throw `AuthError` (the app's backend error type).
 */
export abstract class MealRepository {
  /** The request for one page of the list (with search), optionally of one pool only; undefined when there is no backend to ask. Read with `pagedResource`. */
  abstract request(p: PageParams, slot: TemplateKey | null): HttpResourceRequest | undefined;
  /** Turns the response of that request into a page of rows (their names come in the asked language and Azerbaijani only). */
  abstract parse(body: unknown, headers: HttpHeaders | undefined, p: PageParams): Page<MealRow>;

  /** Every template with its names in every language, also for guests (the working list of the app). */
  abstract list(): Promise<MealRow[]>;
  abstract add(meal: NewMealRow): Promise<MealRow>;
  abstract update(id: string, meal: MealChanges): Promise<MealRow>;
  abstract remove(id: string): Promise<void>;
}
