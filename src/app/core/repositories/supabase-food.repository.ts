import { HttpHeaders, HttpResourceRequest } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthError } from '../auth/auth.models';
import { toAuthError } from '../auth/supabase-errors';
import type { Database } from '../backend/database.types';
import { Client, SupabaseClientProvider } from '../backend/supabase-client';
import { Lang, Unit } from '../models';
import { Page, PageParams } from '../paging';
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

/** Characters that would change the meaning of a PostgREST filter or an ilike pattern are dropped from the search text. */
const cleanTerm = (text: string): string => text.replace(/[%_*,()"\\]/g, ' ').replace(/\s+/g, ' ').trim();

/** One page of foods, system foods first and then the user's own, each group by Azerbaijani name. The count comes back in the Content-Range header. */
export function foodsPageRequest(baseUrl: string, p: PageParams): HttpResourceRequest {
  const params: Record<string, string> = {
    select: COLUMNS,
    order: 'user_id.asc.nullsfirst,names->>az.asc,id.asc',
    limit: String(p.pageSize),
    offset: String((p.page - 1) * p.pageSize),
  };
  const term = cleanTerm(p.search);
  if (term) params['or'] = `(names->>az.ilike.*${term}*,names->>en.ilike.*${term}*,names->>ru.ilike.*${term}*)`;
  return { url: `${baseUrl}/rest/v1/foods`, params, headers: { Prefer: 'count=exact' } };
}

/** The Content-Range header "0-9/37" means 37 rows in all; the total is null when the header is missing. */
export function foodsPageParse(body: unknown, headers: HttpHeaders | undefined): Page<FoodRow> {
  const rows = (Array.isArray(body) ? (body as DbColumns[]) : []).map(toRow);
  const total = /\/(\d+)$/.exec(headers?.get('content-range') ?? '')?.[1];
  return { rows, total: total === undefined ? null : Number(total) };
}

/** The food reference list in the Supabase table `foods` (see supabase/migrations). RLS decides what each visitor sees. */
@Injectable()
export class SupabaseFoodRepository extends FoodRepository {
  private readonly provider = inject(SupabaseClientProvider);

  request(p: PageParams): HttpResourceRequest | undefined {
    return environment.supabaseUrl ? foodsPageRequest(environment.supabaseUrl, p) : undefined;
  }

  parse(body: unknown, headers: HttpHeaders | undefined, _p: PageParams): Page<FoodRow> {
    return foodsPageParse(body, headers);
  }

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
