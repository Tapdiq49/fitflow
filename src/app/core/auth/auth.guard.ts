import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { NAV } from '../../app.nav';
import { PermissionId } from '../../common/interfaces';
import { TextPack, loadPack } from '../i18n/translate';
import { PermissionService } from '../services/permission.service';
import { AuthStore } from './auth.store';

/*
 * No guard blocks the app for guests: every page works without an account.
 * These only keep the auth pages tidy.
 */

/** Sign-in / sign-up: a signed-in user has no business there. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  await auth.init();
  return auth.isAuthenticated() ? router.createUrlTree(['/']) : true;
};

/** Pages that only make sense with an account (profile). Guests are sent to sign in. */
export const accountGuard: CanActivateFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  await auth.init();
  return auth.isAuthenticated() ? true : router.createUrlTree(['/auth/sign-in']);
};

/** Username setup (offered after a provider sign-in, skippable): only for a signed-in user who still has none. */
export const usernameSetupGuard: CanActivateFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  await auth.init();
  if (!auth.isAuthenticated()) return router.createUrlTree(['/auth/sign-in']);
  return auth.needsUsername() ? true : router.createUrlTree(['/']);
};

/**
 * A page that needs a permission (its `view`). Without it the person lands on the first page of the menu they may open, or on the
 * "no access" page when there is none. `pack` loads the text pack of an area before its page is shown.
 */
export const permissionGuard =
  (permission: PermissionId, options: { pack?: TextPack } = {}): CanActivateFn =>
  async () => {
    const auth = inject(AuthStore);
    const perms = inject(PermissionService);
    const router = inject(Router);
    await auth.init();
    if (options.pack) await loadPack(options.pack);
    if (perms.can(permission)) return true;
    return router.createUrlTree([NAV.find((n) => perms.can(n.permission))?.path ?? '/no-access']);
  };

/** A page without a permission of its own that still needs the texts of a pack. */
export const packGuard =
  (pack: TextPack): CanActivateFn =>
  async () => {
    await loadPack(pack);
    return true;
  };
