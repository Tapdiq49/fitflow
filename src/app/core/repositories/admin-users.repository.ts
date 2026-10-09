import { AdminUser, Lang, Role } from '../../common/interfaces';
import { HttpHeaders, HttpResourceRequest } from '@angular/common/http';
import { Page, PageParams, PageSource } from '../paging';

/** A role as the roles page saves it; no id = a new role. */
export interface RoleDraft {
  id?: string;
  /** Name and description per language; at least one name is needed. */
  names: Partial<Record<Lang, string>>;
  descriptions: Partial<Record<Lang, string>>;
  permissions: string[];
}

/**
 * User, role and permission management for people who hold the permissions for it. Supabase implements it today
 * (`supabase-admin-users.repository.ts`, through the Edge Function `admin-users`); a NestJS API replaces it by changing the provider in
 * `app.config.ts`. Methods throw `AuthError`. The server decides what the caller may do; a refused call fails with `forbidden`.
 */
export abstract class AdminUsersRepository implements PageSource<AdminUser> {
  /** The request for one page of accounts (the backend does the search on e-mail / username and the paging); undefined when there is no backend. Read with `pagedResource`. */
  abstract request(p: PageParams): HttpResourceRequest | undefined;
  abstract parse(body: unknown, headers: HttpHeaders | undefined, p: PageParams): Page<AdminUser>;
  abstract remove(id: string): Promise<void>;
  abstract setEmail(id: string, email: string): Promise<void>;
  abstract setPassword(id: string, password: string): Promise<void>;
  /** A JPEG data URL, or null to remove the picture. */
  abstract setAvatar(id: string, avatar: string | null): Promise<void>;
  abstract setRole(id: string, roleId: string): Promise<void>;

  abstract listRoles(): Promise<Role[]>;
  /** Creates (no id) or changes a role; returns its id. */
  abstract saveRole(role: RoleDraft): Promise<string>;
  abstract deleteRole(id: string): Promise<void>;
}
