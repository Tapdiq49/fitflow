import { t } from '../i18n/translate';
import { AuthError } from '../../common/interfaces/auth/auth.models';

/** Text for the user. Technical backend messages are never shown; every code has a translated message (`auth.error.<code>`). */
export function authErrorText(error: unknown, params?: Record<string, string>): string {
  return t(`auth.error.${error instanceof AuthError ? error.code : 'unknown'}`, params);
}
