import { HttpHeaders, HttpResourceRequest } from '@angular/common/http';
import { AuthError } from '../../common/interfaces/auth/auth.models';
import { Page, PageParams } from '../paging';
import { FoodRepository, FoodRow, NewFoodRow } from './food.repository';

/** In-memory FoodRepository for specs. `rows` is the table; set `failing` to simulate a backend that cannot be reached. */
export class FakeFoodRepository extends FoodRepository {
  rows: FoodRow[] = [];
  failing = false;
  /** Only `add` fails (list still works): a backend that reads but refuses writes. */
  failAdd = false;
  private seq = 0;

  /** No HTTP backend in specs: the page falls back to the in-memory list. */
  request(_p: PageParams): HttpResourceRequest | undefined {
    return undefined;
  }

  parse(_body: unknown, _headers: HttpHeaders | undefined, _p: PageParams): Page<FoodRow> {
    return { rows: [], total: null };
  }

  private check(): void {
    if (this.failing) throw new AuthError('network_error');
  }

  async list(): Promise<FoodRow[]> {
    this.check();
    return this.rows.map((r) => ({ ...r }));
  }

  async add(food: NewFoodRow): Promise<FoodRow> {
    this.check();
    if (this.failAdd) throw new AuthError('network_error');
    const row: FoodRow = { ...food, id: `row-${++this.seq}`, code: null, role: null, step: null, min: null, max: null, position: null };
    this.rows.push(row);
    return { ...row };
  }

  async update(id: string, food: NewFoodRow): Promise<FoodRow> {
    this.check();
    if (this.failAdd) throw new AuthError('network_error');
    const i = this.rows.findIndex((r) => r.id === id && r.code === null);
    if (i < 0) throw new AuthError('unknown');
    this.rows[i] = { ...this.rows[i], ...food };
    return { ...this.rows[i] };
  }

  /** Numbers the whole list in its current order, then moves `id` to the place of `targetId` (like the backend function). */
  async move(id: string, targetId: string): Promise<void> {
    this.check();
    if (this.failAdd) throw new AuthError('network_error');
    const order = [...this.rows].sort((x, y) => (x.position ?? 1e9) - (y.position ?? 1e9));
    const from = order.findIndex((r) => r.id === id);
    const to = order.findIndex((r) => r.id === targetId);
    if (from < 0 || to < 0) return;
    order.splice(to, 0, ...order.splice(from, 1));
    order.forEach((r, i) => (r.position = i + 1));
  }

  async remove(id: string): Promise<void> {
    this.check();
    this.rows = this.rows.filter((r) => r.id !== id || r.code !== null);
  }
}
