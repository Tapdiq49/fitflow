import { AuthEvent, AuthUser, OAuthProvider, SignInInput, SignUpInput, SignUpResult } from './auth.models';
import { AuthService } from './auth.service';

/** In-memory AuthService for specs. Set `stored` before `initialize`, call `emit` to simulate session changes. */
export class FakeAuthService extends AuthService {
  stored: AuthUser | null = null;
  readonly takenUsernames = new Set<string>();
  private listeners: Array<(event: AuthEvent, user: AuthUser | null) => void> = [];

  emit(event: AuthEvent, user: AuthUser | null): void {
    for (const l of this.listeners) l(event, user);
  }

  async initialize(): Promise<AuthUser | null> {
    return this.stored;
  }

  onChange(listener: (event: AuthEvent, user: AuthUser | null) => void): () => void {
    this.listeners.push(listener);
    return () => (this.listeners = this.listeners.filter((l) => l !== listener));
  }

  async accessToken(): Promise<string | null> {
    return this.stored ? 'token' : null;
  }

  async signIn(input: SignInInput): Promise<AuthUser> {
    return (this.stored = { id: 'u1', email: 'a@example.com', username: input.identifier, emailPreferences: false, avatar: null, hasPassword: true });
  }

  async signUp(_input: SignUpInput): Promise<SignUpResult> {
    return 'confirmation_required';
  }

  async signInWithProvider(_provider: OAuthProvider): Promise<void> {}

  async signOut(): Promise<void> {
    this.stored = null;
  }

  async requestPasswordReset(_email: string): Promise<void> {}

  async updatePassword(_password: string): Promise<void> {}

  async isUsernameAvailable(username: string): Promise<boolean> {
    return !this.takenUsernames.has(username.toLowerCase());
  }

  async setUsername(username: string): Promise<AuthUser> {
    if (!this.stored) throw new Error('not signed in');
    return (this.stored = { ...this.stored, username });
  }

  async setAvatar(avatar: string | null): Promise<AuthUser> {
    if (!this.stored) throw new Error('not signed in');
    return (this.stored = { ...this.stored, avatar });
  }

  async changePassword(_current: string, _next: string): Promise<void> {}
}
