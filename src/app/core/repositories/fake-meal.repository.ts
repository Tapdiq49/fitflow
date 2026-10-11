import { HttpHeaders, HttpResourceRequest } from '@angular/common/http';
import { AuthError } from '../../common/interfaces/auth/auth.models';
import { Page, PageParams } from '../paging';
import { MealChanges, MealRepository, MealRow, NewMealRow } from './meal.repository';

/** In-memory MealRepository for specs. `rows` is the table; set `failing` to simulate a backend that cannot be reached, `denied` one that refuses writes. */
export class FakeMealRepository extends MealRepository {
  rows: MealRow[] = [];
  failing = false;
  /** Writes are refused (the caller lacks `meals.edit`); reading still works. */
  denied = false;
  private seq = 0;

  /** No HTTP backend in specs: the page falls back to the in-memory list. */
  request(_p: PageParams, _slot: unknown): HttpResourceRequest | undefined {
    return undefined;
  }

  parse(_body: unknown, _headers: HttpHeaders | undefined, _p: PageParams): Page<MealRow> {
    return { rows: [], total: null };
  }

  private check(write = false): void {
    if (this.failing) throw new AuthError('network_error');
    if (write && this.denied) throw new AuthError('forbidden');
  }

  async list(): Promise<MealRow[]> {
    this.check();
    return this.rows.map((r) => structuredClone(r));
  }

  async add(meal: NewMealRow): Promise<MealRow> {
    this.check(true);
    const row: MealRow = { ...structuredClone(meal), id: `row-${++this.seq}` };
    this.rows.push(row);
    return structuredClone(row);
  }

  async update(id: string, meal: MealChanges): Promise<MealRow> {
    this.check(true);
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new AuthError('not_found');
    Object.assign(row, structuredClone(meal));
    return structuredClone(row);
  }

  async remove(id: string): Promise<void> {
    this.check(true);
    this.rows = this.rows.filter((r) => r.id !== id);
  }
}
