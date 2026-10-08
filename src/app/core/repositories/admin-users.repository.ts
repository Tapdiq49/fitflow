import { AdminUser, Role } from '../../common/interfaces';

/** A role as the roles page saves it; no id = a new role. */
export interface RoleDraft {
  id?: string;
  name: string;
  description: string;
  permissions: string[];
}

/**
 * User, role and permission management for people who hold the permissions for it. Supabase implements it today
 * (`supabase-admin-users.repository.ts`, through the Edge Function `admin-users`); a NestJS API replaces it by changing the provider in
 * `app.config.ts`. Methods throw `AuthError`. The server decides what the caller may do; a refused call fails with `forbidden`.
 */
export abstract class AdminUsersRepository {
  abstract list(): Promise<AdminUser[]>;
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
