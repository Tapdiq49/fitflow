import { Injectable, inject } from '@angular/core';
import { AuthError } from '../auth/auth.models';
import { toAuthError } from '../auth/supabase-errors';
import type { Database } from '../backend/database.types';
import { Client, SupabaseClientProvider } from '../backend/supabase-client';
import { Lang, Unit } from '../models';
import { FoodRepository, FoodRow, NewFoodRow } from './food.repository';

type DbFood = Database['public']['Tables']['foods']['Row'];
type DbColumns = Pick<DbFood, 'id' | 'code' | 'names' | 'unit' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'role' | 'step' | 'min_amount' | 'max_amount'>;
type DbUnit = DbFood['unit'];

const COLUMNS = 'id, code, names, unit, kcal, protein, carbs, fat, role, step, min_amount, max_amount';
const UNIT_TO_DB: Record<Unit, DbUnit> = { q: 'g', 'ədəd': 'piece', 'ölçü': 'scoop' };
const UNIT_FROM_DB: Record<DbUnit, Unit> = { g: 'q', piece: 'ədəd', scoop: 'ölçü' };

const num = (v: number | string | null): number | null => (v === null ? null : Number(v));

const toRow = (r: DbColumns): FoodRow => ({
  id: r.id,
  code: r.code,
  names: r.names as Partial<Record<Lang, string>>,
  unit: UNIT_FROM_DB[r.unit],
  k: Number(r.kcal),
  p: Number(r.protein),
  c: Number(r.carbs),
  f: Number(r.fat),
  role: r.role,
  step: num(r.step),
  min: num(r.min_amount),
  max: num(r.max_amount),
});

/** The food reference list in the Supabase table `foods` (see supabase/migrations). RLS decides what each visitor sees. */
@Injectable()
export class SupabaseFoodRepository extends FoodRepository {
  private readonly provider = inject(SupabaseClientProvider);

  private client(): Promise<Client> {
    return this.provider.client().catch((e: unknown) => {
      throw toAuthError(e);
    });
  }

  async list(): Promise<FoodRow[]> {
    const client = await this.client();
    const { data, error } = await client.from('foods').select(COLUMNS).order('created_at').order('id');
    if (error) throw toAuthError(error);
    return data.map(toRow);
  }

  async add(food: NewFoodRow): Promise<FoodRow> {
    const client = await this.client();
    const { data: session } = await client.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) throw new AuthError('session_expired');
    const { data, error } = await client
      .from('foods')
      .insert({ user_id: userId, names: food.names as Record<string, string>, unit: UNIT_TO_DB[food.unit], kcal: food.k, protein: food.p, carbs: food.c, fat: food.f })
      .select(COLUMNS)
      .single();
    if (error) throw toAuthError(error);
    return toRow(data);
  }

  async remove(id: string): Promise<void> {
    const client = await this.client();
    const { error } = await client.from('foods').delete().eq('id', id);
    if (error) throw toAuthError(error);
  }
}
