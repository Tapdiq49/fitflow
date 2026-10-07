import { HttpHeaders, HttpResourceRequest } from '@angular/common/http';
import { FoodRole, Lang, Unit } from '../models';
import { Page, PageParams, PageSource } from '../paging';

/** One food of the reference list as the backend holds it. A system food has a `code` (the key saved menus use), a user food has none. */
export interface FoodRow {
  id: string;
  code: string | null;
  names: Partial<Record<Lang, string>>;
  unit: Unit;
  /** Per 100 g when the unit is 'q', per single unit otherwise. */
  k: number;
  p: number;
  c: number;
  f: number;
  /** Menu generator fields: set on every system food, null on user foods. */
  role: FoodRole | null;
  step: number | null;
  min: number | null;
  max: number | null;
  /** The signed-in user's own place of this food in the whole list (1, 2, …); null = not placed yet (and always null for guests). */
  position: number | null;
}

export type NewFoodRow = Pick<FoodRow, 'names' | 'unit' | 'k' | 'p' | 'c' | 'f'>;

/**
 * Where the food reference list lives. Supabase implements it today (`supabase-food.repository.ts`); a NestJS API replaces it
 * by changing the provider in `app.config.ts`. Methods throw `AuthError` (the app's backend error type).
 */
export abstract class FoodRepository implements PageSource<FoodRow> {
  /** The request for one page of the food list (with search); undefined when there is no backend to ask. Read with `pagedResource`. */
  abstract request(p: PageParams): HttpResourceRequest | undefined;
  /** Turns the response of that request into a page of rows. */
  abstract parse(body: unknown, headers: HttpHeaders | undefined, p: PageParams): Page<FoodRow>;

  /** Every food the visitor may see: the system foods and, when signed in, their own. Works for guests (system foods only). */
  abstract list(): Promise<FoodRow[]>;
  /** Adds a food for the signed-in user. */
  abstract add(food: NewFoodRow): Promise<FoodRow>;
  /** Changes one of the signed-in user's own foods. */
  abstract update(id: string, food: NewFoodRow): Promise<FoodRow>;
  /** Puts a food (system or own) in the place of another one in the signed-in user's order. Ids are row ids (`FoodRow.id`). */
  abstract move(id: string, targetId: string): Promise<void>;
  /** Deletes one of the signed-in user's own foods; system foods are refused by the backend. */
  abstract remove(id: string): Promise<void>;
}
