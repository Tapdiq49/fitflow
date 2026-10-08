import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ConnectedPosition } from '@angular/cdk/overlay';
import { RouterLink } from '@angular/router';
import { authErrorText } from '../../core/auth/auth-errors';
import { AuthStore } from '../../core/auth/auth.store';
import { t } from '../../core/i18n/translate';
import { SessionService } from '../../core/services/session.service';
import { ToastService } from '../../core/services/toast.service';
import { AvatarComponent } from './avatar.component';
import { POPUP_PANEL } from '../../shared/forms/popup';
import { IconComponent } from '../../shared/icon/icon.component';
import { TPipe } from '../../common/pipes/translate/t.pipe';

/** Below the avatar, right edges aligned (the avatar sits at the right end of the header). */
const MENU_POSITIONS: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
];

/**
 * Round avatar in the header that opens the account menu (who is signed in, sign out; room for more entries later).
 * CDK Menu gives the keyboard handling (↑ ↓, Enter, Escape) and the overlay. Defer it: it stays out of the initial bundle.
 */
@Component({
  selector: 'app-user-menu',
  imports: [CdkMenu, CdkMenuItem, CdkMenuTrigger, RouterLink, AvatarComponent, IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.user(); as u) {
      <button
        type="button"
        class="cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        [cdkMenuTriggerFor]="menu"
        [cdkMenuPosition]="positions"
        [attr.aria-label]="'auth.accountMenu' | t"
        [title]="u.email"
      >
        <app-avatar [user]="u" />
      </button>
      <ng-template #menu>
        <div cdkMenu [class]="panel + ' min-w-[210px] max-w-[280px] p-1'" [attr.aria-label]="'auth.accountMenu' | t">
          <div class="flex items-center gap-2.5 px-2.5 py-2">
            <app-avatar [user]="u" [size]="40" />
            <div class="min-w-0">
            <div class="truncate font-semibold">{{ u.username ?? u.email }}</div>
            @if (u.username) {
              <div class="truncate text-[12px] text-muted">{{ u.email }}</div>
            }
            </div>
          </div>
          <div class="my-1 h-px bg-border-soft" role="separator"></div>
          <a
            cdkMenuItem
            routerLink="/profile"
            class="flex w-full cursor-pointer items-center gap-2 rounded-[8px] px-2.5 py-2 text-[14px] text-text no-underline outline-none hover:bg-surface focus-visible:bg-surface focus-visible:outline focus-visible:outline-accent/60"
          >
            <app-icon name="settings" size="sm" />{{ 'profile.menuProfile' | t }}
          </a>
          <button
            type="button"
            cdkMenuItem
            class="flex w-full cursor-pointer items-center gap-2 rounded-[8px] border-0 bg-transparent px-2.5 py-2 text-left text-[14px] outline-none hover:bg-surface focus-visible:bg-surface focus-visible:outline focus-visible:outline-accent/60"
            [disabled]="signingOut()"
            (cdkMenuItemTriggered)="signOut()"
          >
            <app-icon name="lock" size="sm" />{{ 'auth.signOut' | t }}
          </button>
        </div>
      </ng-template>
    }
  `,
})
export class UserMenuComponent {
  protected readonly auth = inject(AuthStore);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);

  protected readonly panel = POPUP_PANEL;
  protected readonly positions = MENU_POSITIONS;
  protected readonly signingOut = signal(false);

  protected async signOut(): Promise<void> {
    this.signingOut.set(true);
    try {
      if (await this.session.signOut()) this.toast.show(t('auth.signedOut'));
    } catch (e) {
      this.toast.show(authErrorText(e));
    } finally {
      this.signingOut.set(false);
    }
  }
}
