import type { Lang } from '../settings/settings';
/**
 * Every permission of the system, `<module>.<action>`. A module is a page or an area, an action what may be done in it:
 * `view` opens the page (menu entry and route), the other actions are the things that change data.
 *
 * Keep it in step with the table `permissions` (supabase/migrations/..._roles_permissions.sql): a new permission is added here AND in a
 * new migration. Roles hold a set of these ids; the Edge Function `admin-users` refuses an id that is not in the table.
 */
export const PERMISSIONS = [
  'today.view',
  'today.edit',
  'workout.view',
  'workout.edit',
  'plan.view',
  'plan.edit',
  'body.view',
  'body.edit',
  'supplements.view',
  'supplements.edit',
  'calendar.view',
  'references.view',
  'references.edit',
  'settings.view',
  'settings.edit',
  'settings.export',
  'settings.import',
  'settings.reset',
  'profile.view',
  'profile.edit',
  'display.edit',
  'users.view',
  'users.edit_email',
  'users.edit_password',
  'users.edit_avatar',
  'users.assign_role',
  'users.delete',
  'roles.view',
  'roles.create',
  'roles.edit',
  'roles.delete',
] as const;

export type PermissionId = (typeof PERMISSIONS)[number];

/** Areas that manage the system itself. Guests and the default role never get them. */
export const ADMIN_MODULES: readonly string[] = ['users', 'roles'];

export const moduleOf = (id: string): string => id.slice(0, id.indexOf('.'));
export const actionOf = (id: string): string => id.slice(id.indexOf('.') + 1);
export const isAdminPermission = (id: string): boolean => ADMIN_MODULES.includes(moduleOf(id));

/** The permissions of the app itself: what a guest and the default role may do. */
export const APP_PERMISSIONS: readonly PermissionId[] = PERMISSIONS.filter((p) => !isAdminPermission(p));

export interface PermissionGroup {
  module: string;
  permissions: PermissionId[];
}

/** The permissions per module, in catalog order (what the roles page shows as one block each). */
export const PERMISSION_GROUPS: readonly PermissionGroup[] = PERMISSIONS.reduce<PermissionGroup[]>((groups, p) => {
  const module = moduleOf(p);
  const group = groups.find((g) => g.module === module);
  if (group) group.permissions.push(p);
  else groups.push({ module, permissions: [p] });
  return groups;
}, []);

/** Built-in roles. `admin` holds everything and cannot be changed; `user` is what every new account gets. */
export const ADMIN_ROLE_ID = 'admin';
export const DEFAULT_ROLE_ID = 'user';

export interface Role {
  id: string;
  /** Name and description in the language the list was asked for (the backend picks it, falling back to Azerbaijani). */
  name: string;
  description: string;
  /** The texts in every language, for the form that edits them. */
  names: Partial<Record<Lang, string>>;
  descriptions: Partial<Record<Lang, string>>;
  /** Built-in: cannot be deleted (and `admin` cannot be edited). */
  isSystem: boolean;
  permissions: string[];
  /** Accounts that have this role. */
  users: number;
}
