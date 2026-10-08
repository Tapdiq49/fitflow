import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RestTimerService } from '../../core/services/rest-timer.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { IconComponent } from '../icon/icon.component';
import { TPipe } from '../../common/pipes/translate/t.pipe';

/** Toast message and the floating rest-timer pill. */
@Component({
  selector: 'app-overlays',
  imports: [IconComponent, ConfirmDialogComponent, TPipe],
  template: `
    <div
      class="fixed right-5 bottom-5 z-60 items-center gap-2.5 rounded-full bg-accent px-3.5 py-2.5 font-extrabold text-accent-ink shadow-card"
      [class]="rest.active() ? 'flex animate-[rise_.3s_ease]' : 'hidden'"
      aria-live="polite"
    >
      <app-icon name="clock" />
      <span>{{ 'common.rest' | t }} <b>{{ rest.left() }}</b> {{ 'common.sec' | t }}</span>
      <button class="cursor-pointer rounded-full border-0 bg-shade/15 px-2 py-1 font-bold text-inherit" (click)="rest.add(30)">+30</button>
      <button class="cursor-pointer rounded-full border-0 bg-shade/15 px-2 py-1 font-bold text-inherit" (click)="rest.stop()" [attr.aria-label]="'common.stopTimer' | t">✕</button>
    </div>
    <div
      class="pointer-events-none fixed bottom-6 left-1/2 z-200 max-w-[calc(100%-32px)] rounded-[12px] border border-border bg-surface-3 px-4 py-2.5 font-semibold -translate-x-1/2 shadow-card [transition:all_.3s]"
      [class]="toast.message() ? 'opacity-100' : 'translate-y-5 opacity-0'"
      role="status"
    >{{ toast.message() }}</div>
    <app-confirm-dialog />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverlaysComponent {
  protected readonly toast = inject(ToastService);
  protected readonly rest = inject(RestTimerService);
}
