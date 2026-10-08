import { Injectable, computed, inject } from '@angular/core';
import { APP_PERMISSIONS } from '../../common/interfaces';
import { AuthStore } from '../auth/auth.store';

/**
 * What the current person may do. A guest (no account) has the whole app and no administration; an account has what its role holds;
 * an account whose role could not be read falls back to the default role (the whole app). This decides which pages and buttons are
 * shown; the administrative actions are checked again on the server (Edge Function `admin-users`).
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthStore);

  private readonly granted = computed<ReadonlySet<string>>(() => {
    const user = this.auth.user();
    return new Set(user ? (user.permissions ?? APP_PERMISSIONS) : APP_PERMISSIONS);
  });

  can(permission: string): boolean {
    return this.granted().has(permission);
  }
}
