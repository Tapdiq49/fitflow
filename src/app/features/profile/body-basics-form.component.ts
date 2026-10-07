import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BodyService } from '../../core/services/body.service';
import { parseNum } from '../../core/utils';
import { IconComponent } from '../../shared/icon.component';
import { TPipe } from '../../shared/t.pipe';

/** Height and starting weight inputs with a save button; used by the sign-in dialog and in place of the numbers that depend on them. */
@Component({
  selector: 'app-body-basics-form',
  imports: [IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] items-end gap-3 [&_input]:h-[42px]">
      <label class="field">{{ 'settings.heightCm' | t }}<input #h type="text" inputmode="numeric" (keydown.enter)="save(h.value, w.value)" /></label>
      <label class="field">{{ 'common.weightKg' | t }}<input #w type="text" inputmode="decimal" (keydown.enter)="save(h.value, w.value)" /></label>
      <button class="btn btn-primary" (click)="save(h.value, w.value)"><app-icon name="save" size="sm" />{{ 'common.save' | t }}</button>
    </div>
  `,
})
export class BodyBasicsFormComponent {
  private readonly body = inject(BodyService);

  protected save(height: string, weight: string): void {
    this.body.saveBasics(parseNum(height), parseNum(weight));
  }
}
