import { ChangeDetectionStrategy, Component, inject, linkedSignal, signal } from '@angular/core';
import { AuthError } from '../../common/interfaces/auth/auth.models';
import { authErrorText } from '../../core/auth/auth-errors';
import { isStrongPassword, isValidUsername, normalizeUsername } from '../../core/auth/auth-validation';
import { imageToAvatarDataUrl } from '../../core/auth/avatar';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { t } from '../../core/i18n/translate';
import { ToastService } from '../../core/services/toast.service';
import { inputValue } from '../../core/utils';
import { IconComponent } from '../../shared/icon/icon.component';
import { TPipe } from '../../common/pipes/translate/t.pipe';
import { AvatarComponent } from '../auth/avatar.component';

/** Account page: picture, username, password. Reached from the avatar menu; guests are sent to sign in. */
@Component({
  selector: 'app-profile-page',
  imports: [AvatarComponent, IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.user(); as u) {
      <div class="mx-auto flex max-w-[640px] flex-col gap-[18px]">
        <div class="card">
          <div class="card-head"><h3><app-icon name="heart" /> {{ 'profile.title' | t }}</h3></div>

          <div class="flex flex-wrap items-center gap-4">
            <app-avatar [user]="u" [size]="96" />
            <div class="flex flex-col gap-2">
              <div class="flex flex-wrap gap-2">
                <button class="btn" [disabled]="photoBusy()" (click)="file.click()">@if (photoBusy()) { <span class="spinner"></span> } @else { <app-icon name="upload" size="sm" /> }{{ 'profile.changePhoto' | t }}</button>
                @if (u.avatar) {
                  <button class="btn btn-danger" [disabled]="photoBusy()" (click)="removePhoto()"><app-icon name="trash" size="sm" />{{ 'profile.removePhoto' | t }}</button>
                }
              </div>
              <span class="text-muted" style="font-size: 12px">{{ 'profile.photoHint' | t }}</span>
              <input #file type="file" accept="image/*" hidden (change)="pickPhoto(file)" />
            </div>
          </div>
          @if (photoError(); as e) {
            <div class="alert alert-bad" role="alert" style="margin-top: 12px">{{ e }}</div>
          }

          <div class="field" style="margin-top: 20px">
            {{ 'auth.email' | t }}
            <input type="text" [value]="u.email" disabled />
          </div>

          <form class="flex flex-col gap-3" style="margin-top: 14px" (submit)="saveUsername($event)" novalidate>
            <label class="field">
              {{ 'auth.username' | t }}
              <input type="text" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" [value]="username()" (input)="username.set(inputValue($event))" (blur)="checkUsername()" />
              <span class="font-normal">{{ 'auth.usernameRules' | t }}</span>
            </label>
            @if (usernameError(); as e) {
              <div class="alert alert-bad" role="alert">{{ e }}</div>
            }
            <div><button type="submit" class="btn btn-primary" [disabled]="usernameBusy()">@if (usernameBusy()) { <span class="spinner"></span> }{{ 'common.save' | t }}</button></div>
          </form>
        </div>

        <div class="card">
          <div class="card-head"><h3><app-icon name="lock" /> {{ 'profile.password' | t }}</h3></div>
          @if (u.hasPassword) {
            <form class="flex flex-col gap-3" (submit)="savePassword($event)" novalidate>
              <label class="field">
                {{ 'profile.currentPassword' | t }}
                <input type="password" name="current-password" autocomplete="current-password" [value]="current()" (input)="current.set(inputValue($event))" />
              </label>
              <label class="field">
                {{ 'auth.newPassword' | t }}
                <input type="password" name="new-password" autocomplete="new-password" [value]="next()" (input)="next.set(inputValue($event))" />
                <span class="font-normal">{{ 'auth.passwordRules' | t }}</span>
              </label>
              <label class="field">
                {{ 'auth.confirmPassword' | t }}
                <input type="password" name="confirm-password" autocomplete="new-password" [value]="confirm()" (input)="confirm.set(inputValue($event))" />
              </label>
              @if (passwordError(); as e) {
                <div class="alert alert-bad" role="alert">{{ e }}</div>
              }
              <div><button type="submit" class="btn btn-primary" [disabled]="passwordBusy()">@if (passwordBusy()) { <span class="spinner"></span> }{{ 'auth.savePassword' | t }}</button></div>
            </form>
          } @else {
            <p class="text-text-2" style="margin: 0">{{ 'profile.providerAccount' | t }}</p>
          }
        </div>
      </div>
    }
  `,
})
export class ProfilePage {
  protected readonly auth = inject(AuthStore);
  private readonly service = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly inputValue = inputValue;

  protected readonly photoBusy = signal(false);
  protected readonly photoError = signal('');

  /** Editable draft, re-synced when the stored username changes. */
  protected readonly username = linkedSignal(() => this.auth.user()?.username ?? '');
  protected readonly usernameBusy = signal(false);
  protected readonly usernameError = signal('');

  protected readonly current = signal('');
  protected readonly next = signal('');
  protected readonly confirm = signal('');
  protected readonly passwordBusy = signal(false);
  protected readonly passwordError = signal('');

  protected async pickPhoto(input: HTMLInputElement): Promise<void> {
    const picked = input.files?.[0];
    input.value = '';
    if (!picked) return;
    await this.savePhoto(() => imageToAvatarDataUrl(picked));
  }

  protected removePhoto(): Promise<void> {
    return this.savePhoto(async () => null);
  }

  private async savePhoto(read: () => Promise<string | null>): Promise<void> {
    this.photoBusy.set(true);
    this.photoError.set('');
    try {
      await this.auth.setAvatar(await read());
      this.toast.show(t('profile.photoSaved'));
    } catch (e) {
      this.photoError.set(authErrorText(e));
    } finally {
      this.photoBusy.set(false);
    }
  }

  private isOwnUsername(name: string): boolean {
    return normalizeUsername(name) === this.auth.user()?.username;
  }

  /** Early hint when the user leaves the field; the unique index in the database stays the real guard. */
  protected async checkUsername(): Promise<void> {
    const name = this.username();
    if (!isValidUsername(name) || this.isOwnUsername(name)) return;
    try {
      if (!(await this.service.isUsernameAvailable(name))) this.usernameError.set(authErrorText(new AuthError('username_taken')));
    } catch {
      // Only a hint; saving reports real problems.
    }
  }

  protected async saveUsername(e: Event): Promise<void> {
    e.preventDefault();
    if (this.usernameBusy()) return;
    const name = this.username();
    if (!isValidUsername(name)) {
      this.usernameError.set(authErrorText(new AuthError('invalid_username')));
      return;
    }
    if (this.isOwnUsername(name)) {
      this.usernameError.set('');
      return;
    }
    this.usernameBusy.set(true);
    this.usernameError.set('');
    try {
      if (!(await this.service.isUsernameAvailable(name))) throw new AuthError('username_taken');
      await this.auth.setUsername(normalizeUsername(name));
      this.toast.show(t('profile.usernameSaved'));
    } catch (err) {
      this.usernameError.set(authErrorText(err));
    } finally {
      this.usernameBusy.set(false);
    }
  }

  protected async savePassword(e: Event): Promise<void> {
    e.preventDefault();
    if (this.passwordBusy()) return;
    if (!this.current()) {
      this.passwordError.set(t('auth.required'));
      return;
    }
    if (!isStrongPassword(this.next())) {
      this.passwordError.set(authErrorText(new AuthError('weak_password')));
      return;
    }
    if (this.next() !== this.confirm()) {
      this.passwordError.set(t('auth.passwordsDontMatch'));
      return;
    }
    this.passwordBusy.set(true);
    this.passwordError.set('');
    try {
      await this.auth.changePassword(this.current(), this.next());
      this.current.set('');
      this.next.set('');
      this.confirm.set('');
      this.toast.show(t('auth.passwordUpdated'));
    } catch (err) {
      this.passwordError.set(err instanceof AuthError && err.code === 'invalid_credentials' ? t('profile.currentPasswordWrong') : authErrorText(err));
    } finally {
      this.passwordBusy.set(false);
    }
  }
}
