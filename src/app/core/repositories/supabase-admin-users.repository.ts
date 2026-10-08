import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AdminUser, Role } from '../../common/interfaces';
import { AuthError } from '../../common/interfaces/auth/auth.models';
import { toAuthError } from '../auth/supabase-errors';
import { SupabaseClientProvider } from '../backend/supabase-client';
import { AdminUsersRepository, RoleDraft } from './admin-users.repository';

/** Talks to the Edge Function `admin-users` (supabase/functions/admin-users) with the signed-in user's session token. */
@Injectable()
export class SupabaseAdminUsersRepository extends AdminUsersRepository {
  private readonly provider = inject(SupabaseClientProvider);

  private async call<T>(body: Record<string, unknown>): Promise<T> {
    const client = await this.provider.client().catch((e: unknown) => {
      throw toAuthError(e);
    });
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new AuthError('session_expired');
    let response: Response;
    try {
      response = await fetch(`${environment.supabaseUrl}/functions/v1/${environment.adminUsersFunction}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: environment.supabasePublishableKey, Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (e) {
      throw toAuthError(e);
    }
    const json = (await response.json().catch(() => ({}))) as { error?: string } & T;
    if (!response.ok) throw toAuthError({ code: json.error, status: response.status });
    return json;
  }

  async list(): Promise<AdminUser[]> {
    return (await this.call<{ users: AdminUser[] }>({ action: 'list' })).users;
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
    return (await this.call<{ roles: Role[] }>({ action: 'roles' })).roles;
  }

  async saveRole(role: RoleDraft): Promise<string> {
    return (await this.call<{ id: string }>({ action: 'save_role', ...role })).id;
  }

  async deleteRole(id: string): Promise<void> {
    await this.call({ action: 'delete_role', id });
  }
}
