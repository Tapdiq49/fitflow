import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';

/*
 * No guard blocks the app for guests: every page works without an account.
 * These only keep the auth pages and the half-finished account state tidy.
 */

/** Sign-in / sign-up: a signed-in user has no business there. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  await auth.init();
  if (!auth.isAuthenticated()) return true;
  return router.createUrlTree([auth.needsUsername() ? '/auth/username' : '/']);
};

/** App pages: a user who signed in with a provider must pick a username first. Guests pass. */
export const usernameGuard: CanActivateChildFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  await auth.init();
  return auth.needsUsername() ? router.createUrlTree(['/auth/username']) : true;
};

/** Username setup: only for a signed-in user who still has none. */
export const usernameSetupGuard: CanActivateFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  await auth.init();
  if (!auth.isAuthenticated()) return router.createUrlTree(['/auth/sign-in']);
  return auth.needsUsername() ? true : router.createUrlTree(['/']);
};
