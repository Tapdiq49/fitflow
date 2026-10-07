import { AuthError } from '../auth/auth.models';
import { FoodRepository, FoodRow, NewFoodRow } from './food.repository';

/** In-memory FoodRepository for specs. `rows` is the table; set `failing` to simulate a backend that cannot be reached. */
export class FakeFoodRepository extends FoodRepository {
  rows: FoodRow[] = [];
  failing = false;
  /** Only `add` fails (list still works): a backend that reads but refuses writes. */
  failAdd = false;
  private seq = 0;

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
    const row: FoodRow = { ...food, id: `row-${++this.seq}`, code: null, role: null, step: null, min: null, max: null };
    this.rows.push(row);
    return { ...row };
  }

  async remove(id: string): Promise<void> {
    this.check();
    this.rows = this.rows.filter((r) => r.id !== id || r.code !== null);
  }
}
