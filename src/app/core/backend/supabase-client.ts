import { Injectable } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AuthError } from '../../common/interfaces/auth/auth.models';
import type { Database } from './database.types';

export type Client = SupabaseClient<Database>;

/**
 * The one Supabase client of the app, shared by the Supabase adapters (auth, repositories). It is created on first use
 * with a dynamic import, so the SDK stays out of the initial bundle. A missing configuration rejects with `not_configured`
 * and the app simply keeps working as a guest on local data.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseClientProvider {
  private promise: Promise<Client> | null = null;

  client(): Promise<Client> {
    if (!environment.supabaseUrl || !environment.supabasePublishableKey) return Promise.reject(new AuthError('not_configured'));
    return (this.promise ??= import('@supabase/supabase-js').then(({ createClient }) =>
      createClient<Database>(environment.supabaseUrl, environment.supabasePublishableKey, {
        // PKCE: the e-mail / OAuth redirect carries a one-time code that only this browser can exchange.
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      }),
    ));
  }
}
