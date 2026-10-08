import { t } from '../i18n/translate';
import { AuthError } from '../../common/interfaces/auth/auth.models';

/** Text for the user. Technical backend messages are never shown; every code has a translated message (`auth.error.<code>`). */
export function authErrorText(error: unknown, params?: Record<string, string>): string {
  return t(`auth.error.${error instanceof AuthError ? error.code : 'unknown'}`, params);
}

/** Text for a failed save of the user's data: no connection, an expired session, or a problem on the server. Nothing was saved in any of them. */
export function saveErrorText(error: unknown): string {
  const code = error instanceof AuthError ? error.code : 'unknown';
  if (code === 'network_error') return t('save.failedOffline');
  if (code === 'session_expired') return t('auth.error.session_expired');
  return t('save.failedServer');
}

/** Throws the network error when the browser knows it is offline, so no request is tried (and nothing is written locally). */
export function assertOnline(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AuthError('network_error');
}
