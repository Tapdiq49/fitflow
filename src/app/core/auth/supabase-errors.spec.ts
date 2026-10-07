import { AuthError } from './auth.models';
import { toAuthError } from './supabase-errors';

describe('toAuthError', () => {
  it.each([
    [{ code: 'invalid_credentials' }, 'invalid_credentials'],
    [{ code: 'email_not_confirmed' }, 'email_not_confirmed'],
    [{ code: 'weak_password' }, 'weak_password'],
    [{ code: 'user_already_exists' }, 'email_taken'],
    [{ code: 'over_email_send_rate_limit' }, 'rate_limited'],
    [{ code: 'otp_expired' }, 'link_expired'],
    [{ code: 'refresh_token_not_found' }, 'session_expired'],
    [{ code: '23505' }, 'username_taken'],
    [{ code: '23514' }, 'invalid_username'],
    [{ status: 429 }, 'rate_limited'],
    [{ name: 'AuthRetryableFetchError', message: 'x' }, 'network_error'],
    [new TypeError('Failed to fetch'), 'network_error'],
    [new DOMException('signal timed out', 'TimeoutError'), 'network_error'],
    [{ message: 'Password should be at least 10 characters' }, 'weak_password'],
    [{ code: 'something_new', message: 'Database error saving new user' }, 'unknown'],
    ['boom', 'unknown'],
    [null, 'unknown'],
  ])('maps %j to %s', (input, code) => {
    expect(toAuthError(input).code).toBe(code);
  });

  it('keeps an AuthError as it is and never exposes the backend message', () => {
    const own = new AuthError('username_taken');
    expect(toAuthError(own)).toBe(own);
    expect(toAuthError({ message: 'duplicate key value violates unique constraint "profiles_username_key"' }).message).toBe('unknown');
  });
});
