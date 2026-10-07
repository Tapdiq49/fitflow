import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { authErrorText } from '../../core/auth/auth-errors';
import { OAuthProvider } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { TPipe } from '../../shared/t.pipe';

/** "Continue with Google". The browser leaves for the provider; it returns to /auth/callback. */
@Component({
  selector: 'app-oauth-buttons',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-3 text-[12px] text-muted"><span class="h-px flex-1 bg-border-soft"></span>{{ 'auth.or' | t }}<span class="h-px flex-1 bg-border-soft"></span></div>
    <button type="button" class="btn w-full" [disabled]="busy()" (click)="start('google')">@if (busy()) {
        <span class="spinner"></span>
      } @else {
        <svg class="size-[18px] flex-none" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
      }
      {{ 'auth.continueWithGoogle' | t }}</button>
    @if (error(); as e) {
      <div class="alert alert-bad" role="alert">{{ e }}</div>
    }
  `,
})
export class OAuthButtonsComponent {
  private readonly auth = inject(AuthService);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async start(provider: OAuthProvider): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.signInWithProvider(provider);
    } catch (e) {
      this.error.set(authErrorText(e, { provider: 'Google' }));
      this.busy.set(false);
    }
  }
}
