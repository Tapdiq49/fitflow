import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
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
