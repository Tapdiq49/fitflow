/** One account as the user management page sees it (the Edge Function `admin-users` builds it from the auth account and its profile). */
export interface AdminUser {
  id: string;
  email: string;
  username: string | null;
  /** Small JPEG as a data URL; null = no picture. */
  avatar: string | null;
  /** Id of the account's role (see `Role`). */
  roleId: string;
  /** Name of that role, so the user list needs no second request for the roles. */
  roleName: string;
  /** ISO date-time. */
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
}
