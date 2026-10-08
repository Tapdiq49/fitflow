import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthError } from '../../common/interfaces/auth/auth.models';
import { authErrorText } from '../../core/auth/auth-errors';
import { isEmail } from '../../core/auth/auth-validation';
import { AuthService } from '../../core/auth/auth.service';
import { inputValue } from '../../core/utils';
import { TPipe } from '../../common/pipes/translate/t.pipe';
import { AuthShellComponent } from './auth-shell.component';

@Component({
  selector: 'app-forgot-password-page',
  imports: [RouterLink, AuthShellComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sentTo(); as address) {
      <app-auth-shell [heading]="'auth.resetSentTitle' | t" [subtitle]="'auth.resetSentText' | t: { email: address }">
        <a class="btn w-full" routerLink="/auth/sign-in">{{ 'auth.backToSignIn' | t }}</a>
      </app-auth-shell>
    } @else {
      <app-auth-shell [heading]="'auth.forgotPasswordTitle' | t" [subtitle]="'auth.forgotPasswordText' | t">
        <form class="flex flex-col gap-3.5" (submit)="submit($event)" novalidate>
          <label class="field">
            {{ 'auth.email' | t }}
            <input type="email" name="email" autocomplete="email" autocapitalize="none" spellcheck="false" [value]="email()" (input)="email.set(inputValue($event))" />
          </label>
          @if (error(); as e) {
            <div class="alert alert-bad" role="alert">{{ e }}</div>
          }
          <button type="submit" class="btn btn-primary w-full" [disabled]="busy()">@if (busy()) { <span class="spinner"></span> }{{ 'auth.sendResetLink' | t }}</button>
        </form>
        <div class="text-center text-[0.8125rem]"><a routerLink="/auth/sign-in">{{ 'auth.backToSignIn' | t }}</a></div>
      </app-auth-shell>
    }
  `,
})
export class ForgotPasswordPage {
  private readonly auth = inject(AuthService);

  protected readonly inputValue = inputValue;
  protected readonly email = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly sentTo = signal('');

  protected async submit(e: Event): Promise<void> {
    e.preventDefault();
    if (this.busy()) return;
    if (!isEmail(this.email())) {
      this.error.set(authErrorText(new AuthError('invalid_email')));
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.requestPasswordReset(this.email().trim());
      this.sentTo.set(this.email().trim());
    } catch (err) {
      this.error.set(authErrorText(err));
    } finally {
      this.busy.set(false);
    }
  }
}
