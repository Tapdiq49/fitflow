import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthError } from '../../common/interfaces/auth/auth.models';
import { authErrorText } from '../../core/auth/auth-errors';
import { isStrongPassword } from '../../core/auth/auth-validation';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { t } from '../../core/i18n/translate';
import { ToastService } from '../../core/services/toast.service';
import { inputValue } from '../../core/utils';
import { TPipe } from '../../common/pipes/translate/t.pipe';
import { AuthShellComponent } from './auth-shell.component';

/** Target of the link in the password reset e-mail: the link signs the user in, here they choose a new password. */
@Component({
  selector: 'app-reset-password-page',
  imports: [RouterLink, AuthShellComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (store.status()) {
      @case ('authenticated') {
        <app-auth-shell [heading]="'auth.resetPasswordTitle' | t" [subtitle]="'auth.resetPasswordText' | t">
          <form class="flex flex-col gap-3.5" (submit)="submit($event)" novalidate>
            <label class="field">
              {{ 'auth.newPassword' | t }}
              <input type="password" name="new-password" autocomplete="new-password" [value]="password()" (input)="password.set(inputValue($event))" />
              <span class="font-normal">{{ 'auth.passwordRules' | t }}</span>
            </label>
            <label class="field">
              {{ 'auth.confirmPassword' | t }}
              <input type="password" name="confirm-password" autocomplete="new-password" [value]="confirm()" (input)="confirm.set(inputValue($event))" />
            </label>
            @if (error(); as e) {
              <div class="alert alert-bad" role="alert">{{ e }}</div>
            }
            <button type="submit" class="btn btn-primary w-full" [disabled]="busy()">@if (busy()) { <span class="spinner"></span> }{{ 'auth.savePassword' | t }}</button>
          </form>
        </app-auth-shell>
      }
      @case ('unauthenticated') {
        <app-auth-shell [heading]="'auth.resetPasswordTitle' | t" [subtitle]="'auth.error.link_expired' | t">
          <a class="btn btn-primary w-full" routerLink="/auth/forgot-password">{{ 'auth.sendResetLink' | t }}</a>
        </app-auth-shell>
      }
      @default {
        <app-auth-shell [heading]="'auth.resetPasswordTitle' | t" [subtitle]="'auth.loading' | t" />
      }
    }
  `,
})
export class ResetPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly store = inject(AuthStore);

  protected readonly inputValue = inputValue;
  protected readonly password = signal('');
  protected readonly confirm = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async submit(e: Event): Promise<void> {
    e.preventDefault();
    if (this.busy()) return;
    if (!isStrongPassword(this.password())) {
      this.error.set(authErrorText(new AuthError('weak_password')));
      return;
    }
    if (this.password() !== this.confirm()) {
      this.error.set(t('auth.passwordsDontMatch'));
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.updatePassword(this.password());
      this.toast.show(t('auth.passwordUpdated'));
      await this.router.navigateByUrl('/');
    } catch (err) {
      this.error.set(authErrorText(err));
    } finally {
      this.busy.set(false);
    }
  }
}
