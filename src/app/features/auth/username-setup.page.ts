import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthError } from '../../core/auth/auth.models';
import { authErrorText } from '../../core/auth/auth-errors';
import { isValidUsername, normalizeUsername } from '../../core/auth/auth-validation';
import { AuthStore } from '../../core/auth/auth.store';
import { inputValue } from '../../core/utils';
import { TPipe } from '../../shared/t.pipe';
import { AuthShellComponent } from './auth-shell.component';

/** First sign-in with Google / Apple: the account has no username yet. */
@Component({
  selector: 'app-username-setup-page',
  imports: [AuthShellComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-shell [heading]="'auth.chooseUsernameTitle' | t" [subtitle]="'auth.chooseUsernameText' | t">
      <form class="flex flex-col gap-3.5" (submit)="submit($event)" novalidate>
        <label class="field">
          {{ 'auth.username' | t }}
          <input type="text" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" [value]="username()" (input)="username.set(inputValue($event))" />
          <span class="font-normal">{{ 'auth.usernameRules' | t }}</span>
        </label>
        @if (error(); as e) {
          <div class="alert alert-bad" role="alert">{{ e }}</div>
        }
        <button type="submit" class="btn btn-primary w-full" [disabled]="busy()">{{ 'auth.continue' | t }}</button>
      </form>
    </app-auth-shell>
  `,
})
export class UsernameSetupPage {
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly inputValue = inputValue;
  protected readonly username = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async submit(e: Event): Promise<void> {
    e.preventDefault();
    if (this.busy()) return;
    if (!isValidUsername(this.username())) {
      this.error.set(authErrorText(new AuthError('invalid_username')));
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.store.setUsername(normalizeUsername(this.username()));
      await this.router.navigateByUrl('/', { replaceUrl: true });
    } catch (err) {
      this.error.set(authErrorText(err));
    } finally {
      this.busy.set(false);
    }
  }
}
