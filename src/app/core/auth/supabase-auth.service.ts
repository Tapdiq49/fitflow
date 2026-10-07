import { Injectable, inject } from '@angular/core';
import type { AuthChangeEvent, User } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Client, SupabaseClientProvider } from '../backend/supabase-client';
import { AuthError, AuthEvent, AuthUser, OAuthProvider, SignInInput, SignUpInput, SignUpResult } from './auth.models';
import { normalizeUsername } from './auth-validation';
import { AuthService } from './auth.service';
import { toAuthError } from './supabase-errors';

/** How long a profile read is reused (sign-in / restore are followed at once by a session event). */
const RECENT_MS = 30_000;

const EVENTS: Partial<Record<AuthChangeEvent, AuthEvent>> = {
  SIGNED_IN: 'signed_in',
  SIGNED_OUT: 'signed_out',
  PASSWORD_RECOVERY: 'password_recovery',
  USER_UPDATED: 'user_updated',
};

/**
 * Supabase Auth behind `AuthService`. The only file that imports the SDK. The SDK is loaded on demand,
 * so it stays out of the initial bundle, and a missing configuration just means "guest".
 */
@Injectable()
export class SupabaseAuthService extends AuthService {
  private readonly provider = inject(SupabaseClientProvider);
  /** The profile read of the last sign-in / restore, so the session event that follows it does not repeat the request. */
  private recent: { id: string; at: number; user: Promise<AuthUser> } | null = null;

  private client(): Promise<Client> {
    return this.provider.client();
  }

  async initialize(): Promise<AuthUser | null> {
    try {
      const client = await this.client();
      const { data } = await client.auth.getSession();
      return data.session ? await this.loadUser(client, data.session.user) : null;
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
              listener(mapped, session ? await this.loadUser(client, session.user) : null);
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
        // A hung request ends with the network message instead of spinning forever.
        signal: AbortSignal.timeout(20_000),
      });
    } catch (e) {
      throw toAuthError(e);
    }
    const body = (await response.json().catch(() => ({}))) as { error?: string; access_token?: string; refresh_token?: string };
    if (!response.ok || !body.access_token || !body.refresh_token) throw toAuthError({ code: body.error, status: response.status });

    const { data, error } = await client.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token });
    if (error || !data.session) throw toAuthError(error);
    return this.loadUser(client, data.session.user);
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
    this.recent = null;
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
    return this.loadUser(client, user, true);
  }

  async setAvatar(avatar: string | null): Promise<AuthUser> {
    const client = await this.client().catch((e: unknown) => {
      throw toAuthError(e);
    });
    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) throw new AuthError('session_expired');
    const { error } = await client.from('profiles').update({ avatar }).eq('id', user.id);
    if (error) throw toAuthError(error);
    return this.loadUser(client, user, true);
  }

  async changePassword(current: string, next: string): Promise<void> {
    const client = await this.client().catch((e: unknown) => {
      throw toAuthError(e);
    });
    const { data } = await client.auth.getSession();
    const email = data.session?.user.email;
    if (!email) throw new AuthError('session_expired');
    // Proves the current password (same throttled path as sign-in) before the new one is accepted.
    await this.signIn({ identifier: email, password: current });
    await this.updatePassword(next);
  }

  private loadUser(client: Client, user: Pick<User, 'id' | 'email' | 'app_metadata'>, fresh = false): Promise<AuthUser> {
    const now = Date.now();
    if (!fresh && this.recent?.id === user.id && now - this.recent.at < RECENT_MS) return this.recent.user;
    const read = this.readUser(client, user);
    this.recent = { id: user.id, at: now, user: read };
    // A failed read must not be served again.
    read.catch(() => {
      if (this.recent?.user === read) this.recent = null;
    });
    return read;
  }

  private async readUser(client: Client, user: Pick<User, 'id' | 'email' | 'app_metadata'>): Promise<AuthUser> {
    const { data } = await client.from('profiles').select('username, email_preferences, avatar').eq('id', user.id).maybeSingle();
    return {
      id: user.id,
      email: user.email ?? '',
      username: data?.username ?? null,
      emailPreferences: data?.email_preferences ?? false,
      avatar: data?.avatar ?? null,
      hasPassword: (user.app_metadata?.['providers'] as string[] | undefined)?.includes('email') ?? false,
    };
  }
}
