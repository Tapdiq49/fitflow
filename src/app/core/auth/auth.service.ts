import { AuthEvent, AuthUser, OAuthProvider, SignInInput, SignUpInput, SignUpResult } from './auth.models';

/**
 * The one door to authentication. Supabase Auth implements it today (`supabase-auth.service.ts`); a NestJS
 * implementation (JWT issued by the API) replaces it by changing the provider in `app.config.ts`.
 * Methods throw `AuthError`.
 */
export abstract class AuthService {
  /** Restores the stored session. Null = guest. Never throws; a broken backend means guest. */
  abstract initialize(): Promise<AuthUser | null>;

  /** Calls back whenever the session changes after `initialize`. Returns the unsubscribe function. */
  abstract onChange(listener: (event: AuthEvent, user: AuthUser | null) => void): () => void;

  /** Bearer token for the data API (used by the storage migration later). Null = guest. */
  abstract accessToken(): Promise<string | null>;

  abstract signIn(input: SignInInput): Promise<AuthUser>;
  abstract signUp(input: SignUpInput): Promise<SignUpResult>;
  /** Leaves the app: the provider redirects the browser and comes back to `/auth/callback`. */
  abstract signInWithProvider(provider: OAuthProvider): Promise<void>;
  abstract signOut(): Promise<void>;

  /** Always succeeds from the user's point of view (does not reveal whether the address has an account). */
  abstract requestPasswordReset(email: string): Promise<void>;
  /** For the signed-in recovery session reached through the e-mailed link. */
  abstract updatePassword(password: string): Promise<void>;

  abstract isUsernameAvailable(username: string): Promise<boolean>;
  abstract setUsername(username: string): Promise<AuthUser>;
  /** A resized JPEG data URL, or null to remove the picture. */
  abstract setAvatar(avatar: string | null): Promise<AuthUser>;
  /** Checks the current password first (throws invalid_credentials), then sets the new one. */
  abstract changePassword(current: string, next: string): Promise<void>;
}
