import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GuestNoticeService } from '../../core/services/guest-notice.service';
import { IconComponent } from '../../shared/icon.component';
import { TPipe } from '../../shared/t.pipe';

/** Shown to guests only: their data is kept in this browser and can be lost. */
@Component({
  selector: 'app-guest-notice',
  imports: [RouterLink, IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (notice.visible()) {
      <div class="alert alert-warn mt-4 !items-center" role="status">
        <app-icon name="alert" />
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
          <div class="min-w-[220px] flex-1">
            <b>{{ 'auth.guestNoticeTitle' | t }}</b> {{ 'auth.guestNoticeText' | t }}
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <a class="btn btn-sm btn-primary" routerLink="/auth/sign-in">{{ 'auth.signIn' | t }}</a>
            <a class="btn btn-sm" routerLink="/auth/sign-up">{{ 'auth.signUp' | t }}</a>
            <a class="btn btn-sm btn-ghost" routerLink="/settings">{{ 'auth.guestNoticeBackup' | t }}</a>
          </div>
        </div>
        <button class="btn btn-ghost btn-icon" (click)="notice.dismiss()" [attr.aria-label]="'auth.guestNoticeClose' | t"><app-icon name="x" size="sm" /></button>
      </div>
    }
  `,
})
export class GuestNoticeComponent {
  protected readonly notice = inject(GuestNoticeService);
}
