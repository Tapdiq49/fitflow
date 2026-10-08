import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthError } from '../../common/interfaces/auth/auth.models';
import { authErrorText } from '../../core/auth/auth-errors';
import { isEmail, isStrongPassword, isValidUsername, normalizeUsername } from '../../core/auth/auth-validation';
import { AuthService } from '../../core/auth/auth.service';
import { inputValue } from '../../core/utils';
import { TPipe } from '../../common/pipes/translate/t.pipe';
import { AuthShellComponent } from './auth-shell.component';
import { OAuthButtonsComponent } from './oauth-buttons.component';

@Component({
  selector: 'app-sign-up-page',
  imports: [RouterLink, AuthShellComponent, OAuthButtonsComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sentTo(); as address) {
      <app-auth-shell [heading]="'auth.signUpConfirmTitle' | t" [subtitle]="'auth.signUpConfirmText' | t: { email: address }">
        <a class="btn w-full" routerLink="/auth/sign-in">{{ 'auth.backToSignIn' | t }}</a>
      </app-auth-shell>
    } @else {
      <app-auth-shell [heading]="'auth.signUpTitle' | t" [subtitle]="'auth.signUpSubtitle' | t">
        <form class="flex flex-col gap-3.5" (submit)="submit($event)" novalidate>
          <label class="field">
            {{ 'auth.email' | t }} *
            <input type="email" name="email" autocomplete="email" autocapitalize="none" spellcheck="false" [value]="email()" (input)="email.set(inputValue($event))" />
          </label>
          <label class="field">
            {{ 'auth.password' | t }} *
            <input type="password" name="new-password" autocomplete="new-password" [value]="password()" (input)="password.set(inputValue($event))" />
            <span class="font-normal">{{ 'auth.passwordRules' | t }}</span>
          </label>
          <label class="field">
            {{ 'auth.username' | t }} *
            <input type="text" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" [value]="username()" (input)="username.set(inputValue($event))" (blur)="checkUsername()" />
            <span class="font-normal">{{ 'auth.usernameRules' | t }}</span>
          </label>
          <fieldset class="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend class="eyebrow mb-1.5 p-0">{{ 'auth.emailPreferences' | t }}</legend>
            <label class="flex cursor-pointer items-start gap-2">
              <input type="checkbox" class="mt-0.5" [checked]="emailPreferences()" (change)="emailPreferences.set(checked($event))" /> {{ 'auth.productUpdates' | t }}
            </label>
          </fieldset>
          @if (error(); as e) {
            <div class="alert alert-bad" role="alert">{{ e }}</div>
          }
          <button type="submit" class="btn btn-primary w-full" [disabled]="busy()">@if (busy()) { <span class="spinner"></span> }{{ 'auth.signUp' | t }}</button>
        </form>
        <app-oauth-buttons />
        <div class="text-center text-[0.8125rem] text-text-2">{{ 'auth.haveAccount' | t }} <a routerLink="/auth/sign-in">{{ 'auth.signIn' | t }}</a></div>
      </app-auth-shell>
    }
  `,
})
export class SignUpPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly inputValue = inputValue;
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly username = signal('');
  protected readonly emailPreferences = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  /** Set once the confirmation e-mail is on its way. */
  protected readonly sentTo = signal('');

  protected checked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }

  /** Early hint when the user leaves the username field; the database unique index stays the real guard. */
  protected async checkUsername(): Promise<void> {
    if (!this.username().trim() || !isValidUsername(this.username())) return;
    try {
      if (!(await this.auth.isUsernameAvailable(this.username()))) this.error.set(authErrorText(new AuthError('username_taken')));
    } catch {
      // Only a hint; the submit reports real problems.
    }
  }

  protected async submit(e: Event): Promise<void> {
    e.preventDefault();
    if (this.busy()) return;
    const invalid = !isEmail(this.email())
      ? 'invalid_email'
      : !isStrongPassword(this.password())
        ? 'weak_password'
        : !isValidUsername(this.username())
          ? 'invalid_username'
          : null;
    if (invalid) {
      this.error.set(authErrorText(new AuthError(invalid)));
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await this.auth.signUp({
        email: this.email().trim(),
        password: this.password(),
        username: normalizeUsername(this.username()),
        emailPreferences: this.emailPreferences(),
      });
      if (result === 'signed_in') await this.router.navigateByUrl('/');
      else this.sentTo.set(this.email().trim());
    } catch (err) {
      this.error.set(authErrorText(err));
    } finally {
      this.busy.set(false);
    }
  }
}
