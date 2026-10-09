import type { Sex } from '../../common/interfaces';
import { Injectable, computed, inject, signal } from '@angular/core';
import { t } from '../i18n/translate';
import { ToastService } from '../services/toast.service';
import { AuthStatus, AuthUser, SignInInput } from '../../common/interfaces/auth/auth.models';
import { AuthService } from './auth.service';

/**
 * Who is using the app. Signals only; the UI and guards read this and never touch `AuthService` directly for state.
 * `unauthenticated` means guest: the app works fully without an account.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  private readonly _status = signal<AuthStatus>('loading');
  private readonly _user = signal<AuthUser | null>(null);
  private started: Promise<void> | null = null;
  private leaving = false;

  readonly status = this._status.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._status() === 'authenticated');
  /** True once the stored session has been checked and there is none. */
  readonly isGuest = computed(() => this._status() === 'unauthenticated');
  /** Signed in through a provider and still without a username. */
  readonly needsUsername = computed(() => {
    const u = this._user();
    return u !== null && u.username === null;
  });

  /** True while `init()` has started and the stored session is still being checked (a signed-in user may be about to appear). */
  restoring(): boolean {
    return this.started !== null && this._status() === 'loading';
  }

  /** Restores the stored session once; resolves when the status is known. Safe to call from guards. */
  init(): Promise<void> {
    return (this.started ??= this.start());
  }

  private async start(): Promise<void> {
    // Subscribe before restoring: the PKCE code in the URL is exchanged during `initialize`.
    this.auth.onChange((event, user) => {
      if (event === 'signed_out' && this._user() && !this.leaving) this.toast.show(t('auth.error.session_expired'));
      this.apply(user);
    });
    this.apply(await this.auth.initialize());
  }

  private apply(user: AuthUser | null): void {
    this._user.set(user);
    this._status.set(user ? 'authenticated' : 'unauthenticated');
  }

  async signIn(input: SignInInput): Promise<void> {
    this.apply(await this.auth.signIn(input));
  }

  async signOut(): Promise<void> {
    this.leaving = true;
    try {
      await this.auth.signOut();
      this.apply(null);
    } finally {
      this.leaving = false;
    }
  }

  async setUsername(username: string): Promise<void> {
    this.apply(await this.auth.setUsername(username));
  }

  async setAvatar(avatar: string | null): Promise<void> {
    this.apply(await this.auth.setAvatar(avatar));
  }

  async setBodyBasics(height: number, startWeight: number, age: number, sex: Sex): Promise<void> {
    this.apply(await this.auth.setBodyBasics(height, startWeight, age, sex));
  }

  async setSettings(settings: Record<string, unknown>): Promise<void> {
    this.apply(await this.auth.setSettings(settings));
  }

  changePassword(current: string, next: string): Promise<void> {
    return this.auth.changePassword(current, next);
  }
}
