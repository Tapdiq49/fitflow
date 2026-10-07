import type { Sex } from '../models';

/** The app's own view of an account. UI code never sees a Supabase (or later NestJS) user object. */
export interface AuthUser {
  id: string;
  email: string;
  /** Null until the user picks one (first OAuth sign-in). */
  username: string | null;
  emailPreferences: boolean;
  /** Small JPEG as a data URL; null = no picture. */
  avatar: string | null;
  /** Height (cm), starting weight (kg), age and sex kept in the profile; null = not entered yet. */
  height: number | null;
  startWeight: number | null;
  age: number | null;
  sex: Sex | null;
  /** False for an account that only signs in with a provider (Google): it has no password to change. */
  hasPassword: boolean;
}

/** `unauthenticated` is also "guest": the app works without an account. */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type OAuthProvider = 'google';

export interface SignInInput {
  /** E-mail address or username. */
  identifier: string;
  password: string;
}

export interface SignUpInput {
  email: string;
  password: string;
  username: string;
  emailPreferences: boolean;
}

/** `confirmation_required`: an e-mail was sent (also the answer for an address that already has an account). */
export type SignUpResult = 'signed_in' | 'confirmation_required';

export type AuthErrorCode =
  | 'invalid_email'
  | 'weak_password'
  | 'same_password'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'email_taken'
  | 'invalid_username'
  | 'invalid_image'
  | 'username_taken'
  | 'oauth_failed'
  | 'network_error'
  | 'session_expired'
  | 'link_expired'
  | 'rate_limited'
  | 'not_configured'
  | 'unknown';

/** What every AuthService implementation throws; the message for the user comes from `authErrorText`. */
export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = 'AuthError';
  }
}

export type AuthEvent = 'signed_in' | 'signed_out' | 'password_recovery' | 'user_updated' | 'token_refreshed';
