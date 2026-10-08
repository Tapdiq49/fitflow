import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { authErrorText } from '../../core/auth/auth-errors';
import { AuthStore } from '../../core/auth/auth.store';
import { inputValue } from '../../core/utils';
import { t } from '../../core/i18n/translate';
import { TPipe } from '../../common/pipes/translate/t.pipe';
import { AuthShellComponent } from './auth-shell.component';
import { OAuthButtonsComponent } from './oauth-buttons.component';

@Component({
  selector: 'app-sign-in-page',
  imports: [RouterLink, AuthShellComponent, OAuthButtonsComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-shell [heading]="'auth.signIn' | t" [subtitle]="'auth.signInSubtitle' | t">
      <form class="flex flex-col gap-3.5" (submit)="submit($event)" novalidate>
        <label class="field">
          {{ 'auth.identifier' | t }}
          <input type="text" name="identifier" autocomplete="username" autocapitalize="none" spellcheck="false" [value]="identifier()" (input)="identifier.set(inputValue($event))" />
        </label>
        <label class="field">
          {{ 'auth.password' | t }}
          <input type="password" name="password" autocomplete="current-password" [value]="password()" (input)="password.set(inputValue($event))" />
        </label>
        <div class="text-right text-[0.8125rem]"><a routerLink="/auth/forgot-password">{{ 'auth.forgotPassword' | t }}</a></div>
        @if (error(); as e) {
          <div class="alert alert-bad" role="alert">{{ e }}</div>
        }
        <button type="submit" class="btn btn-primary w-full" [disabled]="busy()">@if (busy()) { <span class="spinner"></span> }{{ 'auth.signIn' | t }}</button>
      </form>
      <app-oauth-buttons />
      <div class="text-center text-[0.8125rem] text-text-2">{{ 'auth.noAccount' | t }} <a routerLink="/auth/sign-up">{{ 'auth.signUp' | t }}</a></div>
    </app-auth-shell>
  `,
})
export class SignInPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly inputValue = inputValue;
  protected readonly identifier = signal('');
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async submit(e: Event): Promise<void> {
    e.preventDefault();
    if (this.busy()) return;
    if (!this.identifier().trim() || !this.password()) {
      this.error.set(t('auth.required'));
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.signIn({ identifier: this.identifier(), password: this.password() });
      await this.router.navigateByUrl('/');
    } catch (err) {
      this.error.set(authErrorText(err));
    } finally {
      this.busy.set(false);
    }
  }
}
