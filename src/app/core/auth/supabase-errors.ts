import { AuthError, AuthErrorCode } from '../../common/interfaces/auth/auth.models';

/** Supabase Auth `error.code` values (and the codes our `login` function returns) -> our codes. */
const BY_CODE: Record<string, AuthErrorCode> = {
  invalid_credentials: 'invalid_credentials',
  email_not_confirmed: 'email_not_confirmed',
  weak_password: 'weak_password',
  same_password: 'same_password',
  user_already_exists: 'email_taken',
  email_exists: 'email_taken',
  validation_failed: 'invalid_email',
  email_address_invalid: 'invalid_email',
  over_request_rate_limit: 'rate_limited',
  over_email_send_rate_limit: 'rate_limited',
  rate_limited: 'rate_limited',
  forbidden: 'forbidden',
  system_role: 'system_role',
  role_in_use: 'role_in_use',
  invalid_role: 'invalid_role',
  self_action: 'self_action',
  not_found: 'not_found',
  invalid_image: 'invalid_image',
  session_expired: 'session_expired',
  session_not_found: 'session_expired',
  refresh_token_not_found: 'session_expired',
  refresh_token_already_used: 'session_expired',
  otp_expired: 'link_expired',
  flow_state_expired: 'link_expired',
  flow_state_not_found: 'link_expired',
};

/** Postgres error codes that reach us through PostgREST. */
const BY_SQLSTATE: Record<string, AuthErrorCode> = {
  '23505': 'username_taken', // unique_violation on profiles_username_key
  '23514': 'invalid_username', // check_violation on profiles_username_format
};

interface ErrorLike {
  code?: unknown;
  name?: unknown;
  message?: unknown;
  status?: unknown;
}

/** Turns anything thrown by the SDK, the network or our function into an `AuthError`. */
export function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) return error;
  const e: ErrorLike = typeof error === 'object' && error !== null ? error : {};
  const code = typeof e.code === 'string' ? e.code : '';
  const name = typeof e.name === 'string' ? e.name : '';
  const message = typeof e.message === 'string' ? e.message : '';

  if (Object.hasOwn(BY_CODE, code)) return new AuthError(BY_CODE[code], { cause: error });
  if (Object.hasOwn(BY_SQLSTATE, code)) return new AuthError(BY_SQLSTATE[code], { cause: error });
  if (name === 'AuthRetryableFetchError' || name === 'TypeError' || name === 'TimeoutError' || name === 'AbortError' || /failed to fetch|networkerror|load failed/i.test(message)) {
    return new AuthError('network_error', { cause: error });
  }
  if (e.status === 429) return new AuthError('rate_limited', { cause: error });
  if (name === 'AuthSessionMissingError') return new AuthError('session_expired', { cause: error });
  if (/password/i.test(message) && /(weak|short|at least|character)/i.test(message)) return new AuthError('weak_password', { cause: error });
  return new AuthError('unknown', { cause: error });
}
