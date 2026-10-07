import { Injectable } from '@angular/core';
import type { AuthChangeEvent, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AuthError, AuthEvent, AuthUser, OAuthProvider, SignInInput, SignUpInput, SignUpResult } from './auth.models';
import { normalizeUsername } from './auth-validation';
import { AuthService } from './auth.service';
import type { Database } from './database.types';
import { toAuthError } from './supabase-errors';

type Client = SupabaseClient<Database>;

const EVENTS: Partial<Record<AuthChangeEvent, AuthEvent>> = {
  SIGNED_IN: 'signed_in',
  SIGNED_OUT: 'signed_out',
  PASSWORD_RECOVERY: 'password_recovery',
  USER_UPDATED: 'user_updated',
  TOKEN_REFRESHED: 'token_refreshed',
};

/**
 * Supabase Auth behind `AuthService`. The only file that imports the SDK. The SDK is loaded on demand,
 * so it stays out of the initial bundle, and a missing configuration just means "guest".
 */
@Injectable()
export class SupabaseAuthService extends AuthService {
  private clientPromise: Promise<Client> | null = null;

  private client(): Promise<Client> {
    if (!environment.supabaseUrl || !environment.supabasePublishableKey) return Promise.reject(new AuthError('not_configured'));
    return (this.clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
      createClient<Database>(environment.supabaseUrl, environment.supabasePublishableKey, {
        // PKCE: the e-mail / OAuth redirect carries a one-time code that only this browser can exchange.
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      }),
    ));
  }

  async initialize(): Promise<AuthUser | null> {
    try {
      const client = await this.client();
      const { data } = await client.auth.getSession();
      return data.session ? await this.loadUser(client, data.session.user.id, data.session.user.email) : null;
    } catch {
      return null;
    }
  }

  onChange(listener: (event: AuthEvent, user: AuthUser | null) => void): () => void {
    let cancelled = false;
    let unsubscribe = (): void => undefined;
    this.client()
      .then((client) => {
        if (cancelled) return;
        const { data } = client.auth.onAuthStateChange((event, session) => {
          const mapped = EVENTS[event];
          if (!mapped) return;
          // Calling the SDK inside this callback can deadlock it, so the profile is read on the next tick.
          setTimeout(async () => {
            try {
              listener(mapped, session ? await this.loadUser(client, session.user.id, session.user.email) : null);
            } catch {
              listener(mapped, null);
            }
          }, 0);
        });
        unsubscribe = () => data.subscription.unsubscribe();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }

  async accessToken(): Promise<string | null> {
    try {
      const { data } = await (await this.client()).auth.getSession();
      return data.session?.access_token ?? null;
    } catch {
      return null;
    }
  }

  /** Goes through the `login` Edge Function so a username never has to be turned into an e-mail in the browser. */
  async signIn(input: SignInInput): Promise<AuthUser> {
    const client = await this.client().catch((e: unknown) => {
      throw toAuthError(e);
    });
    let response: Response;
    try {
      response = await fetch(`${environment.supabaseUrl}/functions/v1/${environment.loginFunction}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: environment.supabasePublishableKey },
        body: JSON.stringify({ identifier: input.identifier.trim(), password: input.password }),
      });
    } catch (e) {
      throw toAuthError(e);
    }
    const body = (await response.json().catch(() => ({}))) as { error?: string; access_token?: string; refresh_token?: string };
    if (!response.ok || !body.access_token || !body.refresh_token) throw toAuthError({ code: body.error, status: response.status });

    const { data, error } = await client.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token });
    if (error || !data.session) throw toAuthError(error);
    return this.loadUser(client, data.session.user.id, data.session.user.email);
  }

  async signUp(input: SignUpInput): Promise<SignUpResult> {
    const client = await this.client().catch((e: unknown) => {
      throw toAuthError(e);
    });
    const username = normalizeUsername(input.username);
    const { data, error } = await client.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        emailRedirectTo: `${environment.siteUrl}/auth/callback`,
        data: { username, marketing_opt_in: input.emailPreferences },
      },
    });
    if (error) {
      const mapped = toAuthError(error);
      // The database trigger rejects a taken username, and GoTrue hides the reason behind a generic failure.
      if (mapped.code === 'unknown' && !(await this.isUsernameAvailable(username).catch(() => true))) throw new AuthError('username_taken');
      throw mapped;
    }
    // With e-mail confirmation on there is no session; Supabase answers the same way for an address that already has an account.
    return data.session ? 'signed_in' : 'confirmation_required';
  }

  async signInWithProvider(provider: OAuthProvider): Promise<void> {
    const client = await this.client().catch((e: unknown) => {
      throw toAuthError(e);
    });
    const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo: `${environment.siteUrl}/auth/callback` } });
    if (error) throw new AuthError(toAuthError(error).code === 'network_error' ? 'network_error' : 'oauth_failed', { cause: error });
  }

  async signOut(): Promise<void> {
    const client = await this.client().catch((e: unknown) => {
      throw toAuthError(e);
    });
    // "local": ends this device's session only.
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw toAuthError(error);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const client = await this.client().catch((e: unknown) => {
      throw toAuthError(e);
    });
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${environment.siteUrl}/auth/reset-password` });
    if (!error) return;
    // Anything but a network or rate-limit problem is swallowed, so the answer never reveals whether the address has an account.
    const mapped = toAuthError(error);
    if (mapped.code === 'network_error' || mapped.code === 'rate_limited') throw mapped;
  }

  async updatePassword(password: string): Promise<void> {
    const client = await this.client().catch((e: unknown) => {
      throw toAuthError(e);
    });
    const { error } = await client.auth.updateUser({ password });
    if (error) throw toAuthError(error);
  }

  async isUsernameAvailable(username: string): Promise<boolean> {
    const client = await this.client().catch((e: unknown) => {
      throw toAuthError(e);
    });
    const { data, error } = await client.rpc('is_username_available', { p_username: normalizeUsername(username) });
    if (error) throw toAuthError(error);
    return data === true;
  }

  async setUsername(username: string): Promise<AuthUser> {
    const client = await this.client().catch((e: unknown) => {
      throw toAuthError(e);
    });
    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) throw new AuthError('session_expired');
    const { error } = await client.from('profiles').update({ username: normalizeUsername(username) }).eq('id', user.id);
    if (error) throw toAuthError(error);
    return this.loadUser(client, user.id, user.email);
  }

  private async loadUser(client: Client, id: string, email: string | undefined): Promise<AuthUser> {
    const { data } = await client.from('profiles').select('username, email_preferences').eq('id', id).maybeSingle();
    return { id, email: email ?? '', username: data?.username ?? null, emailPreferences: data?.email_preferences ?? false };
  }
}
