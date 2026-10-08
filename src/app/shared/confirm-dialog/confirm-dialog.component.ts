import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConfirmService } from '../../core/services/confirm.service';
import { ModalComponent } from '../modal/modal.component';
import { TPipe } from '../../common/pipes/translate/t.pipe';

@Component({
  selector: 'app-confirm-dialog',
  imports: [ModalComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (confirm.request(); as r) {
      <app-modal [heading]="'common.confirm' | t" (closed)="confirm.answer(false)">
        <p class="m-0 mb-5 text-[0.875rem] leading-relaxed whitespace-pre-line text-text-2">{{ r.message }}</p>
        <div class="flex justify-end gap-2">
          <button class="btn" (click)="confirm.answer(false)">{{ 'common.cancel' | t }}</button>
          <button class="btn" [class]="r.danger ? 'btn btn-danger' : 'btn btn-primary'" (click)="confirm.answer(true)">{{ r.confirmLabel }}</button>
        </div>
      </app-modal>
    }
  `,
})
export class ConfirmDialogComponent {
  protected readonly confirm = inject(ConfirmService);
}
