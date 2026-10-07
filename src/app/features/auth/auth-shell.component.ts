import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { IconComponent } from '../../shared/icon.component';
import { TPipe } from '../../shared/t.pipe';

/** Full-screen frame shared by the auth pages (they are shown without the app shell). */
@Component({
  selector: 'app-auth-shell',
  imports: [RouterLink, IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid min-h-screen place-items-center px-4 py-8">
      <div class="w-full max-w-[420px]">
        <a routerLink="/" class="mb-5 flex items-center justify-center gap-2.5 text-[18px] font-extrabold tracking-[-.02em] text-inherit no-underline" [attr.aria-label]="'app.fitflowHomePage' | t">
          <div class="grid size-[34px] place-items-center rounded-[10px] bg-accent text-accent-ink"><app-icon name="dumbbell" /></div>
          {{ 'app.fitflow' | t }}
        </a>
        <div class="card">
          <h1 class="text-[22px] font-extrabold tracking-[-.02em]">{{ heading() }}</h1>
          @if (subtitle()) {
            <p class="text-text-2" style="margin: 6px 0 0">{{ subtitle() }}</p>
          }
          <div class="mt-5 flex flex-col gap-3.5">
            <ng-content />
          </div>
        </div>
        @if (!auth.isAuthenticated()) {
          <div class="mt-4 text-center text-[13px]">
            <a routerLink="/" class="text-muted">{{ 'auth.continueAsGuest' | t }}</a>
          </div>
        }
      </div>
    </div>
  `,
})
export class AuthShellComponent {
  protected readonly auth = inject(AuthStore);
  readonly heading = input.required<string>();
  readonly subtitle = input('');
}
