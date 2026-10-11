import { HttpHeaders, HttpResourceRequest } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthError } from '../../common/interfaces/auth/auth.models';
import { toAuthError } from '../auth/supabase-errors';
import type { Database } from '../backend/database.types';
import { Client, SupabaseClientProvider } from '../backend/supabase-client';
import { Lang, TemplateKey } from '../../common/interfaces';
import { Page, PageParams } from '../paging';
import { activeLang } from '../utils';
import { cleanTerm } from './supabase-food.repository';
import { MealChanges, MealRepository, MealRow, NewMealRow } from './meal.repository';

type DbMeal = Database['public']['Tables']['meal_templates']['Row'];

const COLUMNS = 'id, code, slot, position, names, main, light, items';

const toRow = (r: Pick<DbMeal, 'id' | 'code' | 'slot' | 'position' | 'names' | 'main' | 'light' | 'items'>): MealRow => ({
  id: r.id,
  code: r.code,
  slot: r.slot,
  position: r.position,
  names: r.names as Partial<Record<Lang, string>>,
  main: r.main,
  light: r.light,
  items: r.items,
});

/** A row of the paged list: only the name in the asked language (`n_<lang>`) and in Azerbaijani (`n_az`, the fallback) came with it. */
type PageRow = Pick<DbMeal, 'id' | 'code' | 'slot' | 'position' | 'main' | 'light' | 'items'> & Partial<Record<`n_${Lang}`, string | null>>;

const toPageRow = (r: PageRow): MealRow => {
  const names: Partial<Record<Lang, string>> = {};
  for (const lang of ['az', 'en', 'ru'] as const) {
    const name = r[`n_${lang}`];
    if (name) names[lang] = name;
  }
  return { id: r.id, code: r.code, slot: r.slot, position: r.position, names, main: r.main, light: r.light, items: r.items };
};

/**
 * One page of the meal list in the order of the day (breakfast … dinner) and of the place inside the pool. The language is part of the
 * request (rule 13): only the name in `lang` (and the Azerbaijani one as the fallback) comes back and the search looks at that name only.
 * `slot` limits the list to one pool. The count comes back in the Content-Range header.
 */
export function mealsPageRequest(baseUrl: string, p: PageParams, lang: Lang, slot: TemplateKey | null): HttpResourceRequest {
  const names = lang === 'az' ? 'n_az:names->>az' : `n_az:names->>az, n_${lang}:names->>${lang}`;
  const params: Record<string, string> = {
    select: `id, code, slot, position, main, light, items, ${names}`,
    order: 'slot_rank.asc,position.asc,code.asc',
    limit: String(p.pageSize),
    offset: String((p.page - 1) * p.pageSize),
  };
  if (slot) params['slot'] = `eq.${slot}`;
  const term = cleanTerm(p.search);
  if (term) params[`names->>${lang}`] = `ilike.*${term}*`;
  return { url: `${baseUrl}/rest/v1/meal_templates`, params, headers: { Prefer: 'count=exact' } };
}

/** The Content-Range header "0-9/37" means 37 rows in all; the total is null when the header is missing. */
export function mealsPageParse(body: unknown, headers: HttpHeaders | undefined): Page<MealRow> {
  const rows = (Array.isArray(body) ? (body as PageRow[]) : []).map(toPageRow);
  const total = /\/(\d+)$/.exec(headers?.get('content-range') ?? '')?.[1];
  return { rows, total: total === undefined ? null : Number(total) };
}

/** The meal templates in the Supabase table `meal_templates` (see supabase/migrations). RLS lets everyone read and only `meals.edit` write. */
@Injectable()
export class SupabaseMealRepository extends MealRepository {
  private readonly provider = inject(SupabaseClientProvider);

  request(p: PageParams, slot: TemplateKey | null): HttpResourceRequest | undefined {
    return environment.supabaseUrl ? mealsPageRequest(environment.supabaseUrl, p, activeLang(), slot) : undefined;
  }

  parse(body: unknown, headers: HttpHeaders | undefined, _p: PageParams): Page<MealRow> {
    return mealsPageParse(body, headers);
  }

  private client(): Promise<Client> {
    return this.provider.client().catch((e: unknown) => {
      throw toAuthError(e);
    });
  }

  async list(): Promise<MealRow[]> {
    const client = await this.client();
    const { data, error } = await client.from('meal_templates').select(COLUMNS).order('slot').order('position').order('code');
    if (error) throw toAuthError(error);
    return data.map(toRow);
  }

  async add(meal: NewMealRow): Promise<MealRow> {
    const client = await this.client();
    const { data, error } = await client
      .from('meal_templates')
      .insert({ code: meal.code, slot: meal.slot, position: meal.position, names: meal.names as Record<string, string>, main: meal.main, light: meal.light, items: meal.items })
      .select(COLUMNS)
      .single();
    if (error) throw toAuthError(error);
    return toRow(data);
  }

  async update(id: string, meal: MealChanges): Promise<MealRow> {
    const client = await this.client();
    const { data, error } = await client
      .from('meal_templates')
      .update({ slot: meal.slot, position: meal.position, names: meal.names as Record<string, string>, main: meal.main, light: meal.light, items: meal.items })
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw toAuthError(error);
    // A write that Row Level Security hides matches no row and raises no error: the caller lacks `meals.edit`.
    if (!data) throw new AuthError('forbidden');
    return toRow(data);
  }

  async remove(id: string): Promise<void> {
    const client = await this.client();
    const { data, error } = await client.from('meal_templates').delete().eq('id', id).select('id');
    if (error) throw toAuthError(error);
    if (!data.length) throw new AuthError('forbidden');
  }
}
