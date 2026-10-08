import type { Sex } from '../../common/interfaces';
import { Injectable, inject } from '@angular/core';
import type { AuthChangeEvent, User } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import type { Database } from '../backend/database.types';
import { Client, SupabaseClientProvider } from '../backend/supabase-client';
import { AuthError, AuthEvent, AuthUser, OAuthProvider, SignInInput, SignUpInput, SignUpResult } from '../../common/interfaces/auth/auth.models';
import { normalizeUsername } from './auth-validation';
import { AuthService } from './auth.service';
import { toAuthError } from './supabase-errors';

type ProfileTable = Database['public']['Tables']['profiles'];
type ProfileRow = Pick<ProfileTable['Row'], 'username' | 'email_preferences' | 'avatar' | 'height_cm' | 'start_weight_kg' | 'age' | 'sex' | 'settings' | 'role_id'>;
type ProfilePatch = ProfileTable['Update'];
/** The columns the app reads from a profile (one list for the read and for the row a write sends back). */
const PROFILE_COLUMNS = 'username, email_preferences, avatar, height_cm, start_weight_kg, age, sex, settings, role_id';
/** Postgres "undefined column": the roles migration has not been applied yet, so the profile is read without `role_id` (everybody is a plain user until it is). */
const UNDEFINED_COLUMN = '42703';
const PROFILE_COLUMNS_WITHOUT_ROLE = 'username, email_preferences, avatar, height_cm, start_weight_kg, age, sex, settings';

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
  private rolePermissions: { roleId: string; permissions: string[] } | null = null;
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
    return this.updateProfile({ username: normalizeUsername(username) });
  }

  async setAvatar(avatar: string | null): Promise<AuthUser> {
    return this.updateProfile({ avatar });
  }

  async setBodyBasics(height: number, startWeight: number, age: number, sex: Sex): Promise<AuthUser> {
    return this.updateProfile({ height_cm: height, start_weight_kg: startWeight, age, sex });
  }

  async setSettings(settings: Record<string, unknown>): Promise<AuthUser> {
    return this.updateProfile({ settings });
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

  /** Writes part of the signed-in user's profile row and gets the row back in the same request (no second read). */
  private async updateProfile(patch: ProfilePatch): Promise<AuthUser> {
    const client = await this.client().catch((e: unknown) => {
      throw toAuthError(e);
    });
    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) throw new AuthError('session_expired');
    let { data, error } = await client.from('profiles').update(patch).eq('id', user.id).select(PROFILE_COLUMNS).maybeSingle();
    if (error?.code === UNDEFINED_COLUMN) {
      const retry = await client.from('profiles').update(patch).eq('id', user.id).select(PROFILE_COLUMNS_WITHOUT_ROLE).maybeSingle();
      data = retry.data as ProfileRow | null;
      error = retry.error;
    }
    if (error) throw toAuthError(error);
    const saved = Promise.resolve(this.toUser(user, data, await this.permissionsOf(client, data?.role_id ?? 'user', false)));
    this.recent = { id: user.id, at: Date.now(), user: saved };
    return saved;
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
    let { data, error } = await client.from('profiles').select(PROFILE_COLUMNS).eq('id', user.id).maybeSingle();
    if (error?.code === UNDEFINED_COLUMN) {
      const retry = await client.from('profiles').select(PROFILE_COLUMNS_WITHOUT_ROLE).eq('id', user.id).maybeSingle();
      data = retry.data as ProfileRow | null;
      error = retry.error;
    }
    return this.toUser(user, data, await this.permissionsOf(client, data?.role_id ?? 'user', true));
  }

  /**
   * What the account's role may do (rows of `role_permissions`). Null when they cannot be read: the app then falls back to the default role
   * (this is for showing pages and buttons; the server decides about administrative actions). A write that returns the profile row
   * reuses the permissions read last time for the same role.
   */
  private async permissionsOf(client: Client, roleId: string, fresh: boolean): Promise<string[] | null> {
    if (!fresh && this.rolePermissions?.roleId === roleId) return this.rolePermissions.permissions;
    const { data, error } = await client.from('role_permissions').select('permission_id').eq('role_id', roleId);
    if (error) return this.rolePermissions?.roleId === roleId ? this.rolePermissions.permissions : null;
    const permissions = data.map((r) => r.permission_id);
    this.rolePermissions = { roleId, permissions };
    return permissions;
  }

  private toUser(user: Pick<User, 'id' | 'email' | 'app_metadata'>, data: ProfileRow | null, permissions: string[] | null): AuthUser {
    return {
      id: user.id,
      email: user.email ?? '',
      username: data?.username ?? null,
      emailPreferences: data?.email_preferences ?? false,
      avatar: data?.avatar ?? null,
      height: data?.height_cm == null ? null : Number(data.height_cm),
      startWeight: data?.start_weight_kg == null ? null : Number(data.start_weight_kg),
      age: data?.age == null ? null : Number(data.age),
      sex: data?.sex === 'male' || data?.sex === 'female' ? data.sex : null,
      settings: data?.settings && typeof data.settings === 'object' && !Array.isArray(data.settings) ? data.settings : null,
      roleId: data?.role_id ?? 'user',
      permissions,
      hasPassword: (user.app_metadata?.['providers'] as string[] | undefined)?.includes('email') ?? false,
    };
  }
}
