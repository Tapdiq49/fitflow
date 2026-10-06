import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-modal',
  imports: [IconComponent],
  template: `
    <div class="fixed inset-0 z-100 grid place-items-center bg-backdrop/70 p-4 backdrop-blur-[4px]" role="dialog" aria-modal="true" (click)="onBackdrop($event)">
      <div class="modal-box">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h3 class="text-[18px]">{{ heading() }}</h3>
          <button class="btn btn-ghost btn-icon" (click)="closed.emit()" aria-label="Bağla"><app-icon name="x" /></button>
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

  protected onBackdrop(e: MouseEvent): void {
    if (e.target === e.currentTarget) this.closed.emit();
  }
}
