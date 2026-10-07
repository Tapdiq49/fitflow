import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { authErrorText } from '../../core/auth/auth-errors';
import { OAuthProvider } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { TPipe } from '../../shared/t.pipe';

/** "Continue with Google / Apple". The browser leaves for the provider; it returns to /auth/callback. */
@Component({
  selector: 'app-oauth-buttons',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-3 text-[12px] text-muted"><span class="h-px flex-1 bg-border-soft"></span>{{ 'auth.or' | t }}<span class="h-px flex-1 bg-border-soft"></span></div>
    <button type="button" class="btn w-full" [disabled]="busy()" (click)="start('google')">{{ 'auth.continueWithGoogle' | t }}</button>
    <button type="button" class="btn w-full" [disabled]="busy()" (click)="start('apple')">{{ 'auth.continueWithApple' | t }}</button>
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
      this.error.set(authErrorText(e, { provider: provider === 'google' ? 'Google' : 'Apple' }));
      this.busy.set(false);
    }
  }
}
