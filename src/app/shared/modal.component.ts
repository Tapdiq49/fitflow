import { ChangeDetectionStrategy, Component, DOCUMENT, DestroyRef, inject, input, output } from '@angular/core';
import { IconComponent } from './icon.component';
import { TPipe } from './t.pipe';

/** Modals open right now; the page scrollbar comes back when the last one closes (confirm can stack on a dialog). */
let openModals = 0;

@Component({
  selector: 'app-modal',
  imports: [IconComponent, TPipe],
  template: `
    <div class="fixed inset-0 z-100 grid place-items-center bg-backdrop/70 p-4 backdrop-blur-[4px]" role="dialog" aria-modal="true" (click)="onBackdrop($event)">
      <div class="modal-box">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h3 class="text-[18px]">{{ heading() }}</h3>
          <button class="btn btn-ghost btn-icon" (click)="closed.emit()" [attr.aria-label]="'common.close' | t"><app-icon name="x" /></button>
        </div>
        <ng-content />
      </div>
    </div>
  `,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalComponent {
  readonly heading = input.required<string>();
  readonly closed = output<void>();

  constructor() {
    // Hide the page scrollbar behind the modal; pad by its width so the page does not shift.
    // Set on <body>, not <html>: body's overflow then still applies to the viewport, so the sticky sidebar keeps
    // sticking to the screen (overflow on <html> turns <body> into its own scroll container and the sidebar scrolls away).
    const doc = inject(DOCUMENT);
    const body = doc.body;
    if (openModals++ === 0) {
      const bar = window.innerWidth - doc.documentElement.clientWidth;
      body.style.overflow = 'hidden';
      if (bar > 0) body.style.paddingRight = `${bar}px`;
    }
    inject(DestroyRef).onDestroy(() => {
      if (--openModals === 0) {
        body.style.overflow = '';
        body.style.paddingRight = '';
      }
    });
  }

  protected onBackdrop(e: MouseEvent): void {
    if (e.target === e.currentTarget) this.closed.emit();
  }
}
