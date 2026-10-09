import { Injectable, inject } from '@angular/core';
import { DayRecord } from '../../common/interfaces';
import { toAuthError } from '../auth/supabase-errors';
import { Client, SupabaseClientProvider } from '../backend/supabase-client';
import { StoredUserData, UserDataChanges, UserDataRepository } from './user-data.repository';

/** PostgREST returns at most 1000 rows per request, so the lists are read page by page. */
const PAGE = 1000;

async function readAll<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await read(from, from + PAGE - 1);
    if (error) throw toAuthError(error);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/**
 * The daily records, weights and exercise history in the Supabase tables `days`, `weights` and `exercise_history`
 * (see supabase/migrations). Reads are plain selects; every write is the one function `apply_user_data`, which runs a whole
 * change in a single transaction. RLS lets everyone read and write only their own rows.
 */
@Injectable()
export class SupabaseUserDataRepository extends UserDataRepository {
  private readonly provider = inject(SupabaseClientProvider);

  private client(): Promise<Client> {
    return this.provider.client().catch((e: unknown) => {
      throw toAuthError(e);
    });
  }

  async load(): Promise<StoredUserData> {
    const client = await this.client();
    const [days, weights, history] = await Promise.all([
      readAll((from, to) => client.from('days').select('day, record').order('day').range(from, to)),
      readAll((from, to) => client.from('weights').select('day, kg, waist').order('day').range(from, to)),
      readAll((from, to) => client.from('exercise_history').select('exercise_id, day, sets').order('exercise_id').order('day').range(from, to)),
    ]);
    const data: StoredUserData = { days: {}, weights: [], history: {} };
    for (const r of days) data.days[r.day] = r.record as unknown as DayRecord;
    // numeric columns can arrive as numbers or strings depending on the transport; the app wants numbers.
    for (const r of weights) data.weights.push({ date: r.day, kg: Number(r.kg), waist: r.waist == null ? null : Number(r.waist) });
    for (const r of history) (data.history[r.exercise_id] ??= []).push({ date: r.day, sets: r.sets });
    return data;
  }

  async apply(changes: UserDataChanges): Promise<void> {
    const client = await this.client();
    const payload = {
      ...(changes.clear ? { clear: true } : {}),
      ...(changes.days ? { days: changes.days } : {}),
      ...(changes.weights ? { weights: changes.weights } : {}),
      ...(changes.history ? { history: changes.history.map((h) => ({ exercise_id: h.exerciseId, day: h.date, sets: h.sets })) } : {}),
    };
    const { error } = await client.rpc('apply_user_data', { p_changes: payload });
    if (error) throw toAuthError(error);
  }
}
