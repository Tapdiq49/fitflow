import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ModalComponent } from '../../shared/modal.component';
import { TPipe } from '../../shared/t.pipe';
import { BodyBasicsFormComponent } from './body-basics-form.component';

/** Asks a signed-in user for height and weight (they differ per person); shown until both are entered and cannot be closed. */
@Component({
  selector: 'app-body-basics-dialog',
  imports: [ModalComponent, BodyBasicsFormComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [heading]="'bodyBasics.title' | t" [dismissible]="false">
      <p class="text-text-2" style="margin: 0 0 14px">{{ 'bodyBasics.why' | t }}</p>
      <app-body-basics-form />
    </app-modal>
  `,
})
export class BodyBasicsDialog {}
