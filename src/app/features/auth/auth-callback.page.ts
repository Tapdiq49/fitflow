import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthError } from '../../common/interfaces/auth/auth.models';
import { authErrorText } from '../../core/auth/auth-errors';
import { AuthStore } from '../../core/auth/auth.store';
import { t } from '../../core/i18n/translate';
import { TPipe } from '../../common/pipes/translate/t.pipe';
import { AuthShellComponent } from './auth-shell.component';

/**
 * Where Google and the e-mail confirmation link send the browser back.
 * The auth client exchanges the one-time code in the URL while the app starts; this page waits for that and moves on.
 */
@Component({
  selector: 'app-auth-callback-page',
  imports: [RouterLink, AuthShellComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error(); as e) {
      <app-auth-shell [heading]="'auth.signIn' | t" [subtitle]="e">
        <a class="btn btn-primary w-full" routerLink="/auth/sign-in">{{ 'auth.backToSignIn' | t }}</a>
      </app-auth-shell>
    } @else {
      <app-auth-shell [heading]="'auth.signIn' | t" [subtitle]="'auth.loading' | t" />
    }
  `,
})
export class AuthCallbackPage {
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly error = signal('');

  constructor() {
    void this.finish();
  }

  private async finish(): Promise<void> {
    await this.store.init();
    if (this.store.isAuthenticated()) {
      // A first-time provider user is offered a username (they can skip it).
      await this.router.navigateByUrl(this.store.needsUsername() ? '/auth/username' : '/', { replaceUrl: true });
      return;
    }
    const { queryParamMap, fragment } = this.route.snapshot;
    const failed = queryParamMap.has('error') || queryParamMap.has('error_code') || /(^|&)error=/.test(fragment ?? '');
    const expired = queryParamMap.get('error_code') === 'otp_expired' || !failed;
    this.error.set(expired ? authErrorText(new AuthError('link_expired')) : t('auth.callbackFailed'));
  }
}
