import { HttpHeaders, HttpResourceRequest } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AdminUser, Role } from '../../common/interfaces';
import { AuthError } from '../../common/interfaces/auth/auth.models';
import { toAuthError } from '../auth/supabase-errors';
import { SupabaseClientProvider } from '../backend/supabase-client';
import { Page, PageParams } from '../paging';
import { activeLang } from '../utils';
import { AdminUsersRepository, RoleDraft } from './admin-users.repository';

/** Talks to the Edge Function `admin-users` (supabase/functions/admin-users) with the signed-in user's session token. */
@Injectable()
export class SupabaseAdminUsersRepository extends AdminUsersRepository {
  private readonly provider = inject(SupabaseClientProvider);

  /** A read is a GET with query parameters, a change a POST with a JSON body. */
  private async call<T>(body: Record<string, unknown>, method: 'GET' | 'POST' = 'POST'): Promise<T> {
    const client = await this.provider.client().catch((e: unknown) => {
      throw toAuthError(e);
    });
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new AuthError('session_expired');
    let response: Response;
    try {
      const base = `${environment.supabaseUrl}/functions/v1/${environment.adminUsersFunction}`;
      const headers: Record<string, string> = { apikey: environment.supabasePublishableKey, Authorization: `Bearer ${token}` };
      const signal = AbortSignal.timeout(30_000);
      response =
        method === 'GET'
          ? await fetch(`${base}?${new URLSearchParams(body as Record<string, string>)}`, { method, headers, signal })
          : await fetch(base, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    } catch (e) {
      throw toAuthError(e);
    }
    const json = (await response.json().catch(() => ({}))) as { error?: string } & T;
    if (!response.ok) throw toAuthError({ code: json.error, status: response.status });
    return json;
  }

  request(p: PageParams): HttpResourceRequest | undefined {
    if (!environment.supabaseUrl) return undefined;
    return {
      url: `${environment.supabaseUrl}/functions/v1/${environment.adminUsersFunction}`,
      // The language is part of the request: the names of the built-in roles come translated, and a language switch asks again.
      params: { page: p.page, pageSize: p.pageSize, search: p.search, lang: activeLang() },
    };
  }

  parse(body: unknown, _headers: HttpHeaders | undefined, _p: PageParams): Page<AdminUser> {
    const { users, total } = (body ?? {}) as { users?: AdminUser[]; total?: number };
    return { rows: users ?? [], total: total ?? null };
  }

  async remove(id: string): Promise<void> {
    await this.call({ action: 'delete', id });
  }

  async setEmail(id: string, email: string): Promise<void> {
    await this.call({ action: 'set_email', id, email });
  }

  async setPassword(id: string, password: string): Promise<void> {
    await this.call({ action: 'set_password', id, password });
  }

  async setAvatar(id: string, avatar: string | null): Promise<void> {
    await this.call({ action: 'set_avatar', id, avatar });
  }

  async setRole(id: string, roleId: string): Promise<void> {
    await this.call({ action: 'set_role', id, role: roleId });
  }

  async listRoles(): Promise<Role[]> {
    const { roles } = await this.call<{ roles?: Role[] }>({ resource: 'roles', lang: activeLang() }, 'GET');
    // An answer without the roles (an older deployed function answers every GET with the user list) is an error, not an empty list.
    if (!Array.isArray(roles)) throw new AuthError('unknown');
    return roles;
  }

  async saveRole(role: RoleDraft): Promise<string> {
    return (await this.call<{ id: string }>({ action: 'save_role', ...role })).id;
  }

  async deleteRole(id: string): Promise<void> {
    await this.call({ action: 'delete_role', id });
  }
}
