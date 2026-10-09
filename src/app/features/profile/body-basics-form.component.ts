import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Sex } from '../../common/interfaces';
import { BodyBasicsSyncService } from '../../core/services/body-basics-sync.service';
import { BodyService } from '../../core/services/body.service';
import { StoreService } from '../../core/services/store.service';
import { parseNum } from '../../core/utils';
import { IconComponent } from '../../shared/icon/icon.component';
import { TPipe } from '../../common/pipes/translate/t.pipe';
import { NumberFieldComponent } from '../../shared/forms/number-field/number-field.component';

/**
 * Height, starting weight, age and sex with a save button; used by the sign-in dialog and in place of the numbers that depend on them.
 * Starts with whatever is already known (an older account has height and weight but no age or sex).
 * The sex is a radio group of buttons, not a select: this form sits in the app shell and must not pull the dropdown code into the first bundle.
 */
@Component({
  selector: 'app-body-basics-form',
  imports: [NumberFieldComponent, IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] items-end gap-3 [&_input]:h-[2.625rem]">
      <label class="field">{{ 'settings.heightCm' | t }}<app-number-field #h [value]="known.height ?? ''" (keydown.enter)="save(h.value, w.value, a.value)" /></label>
      <label class="field">{{ 'common.weightKg' | t }}<app-number-field #w decimal [value]="known.startWeight ?? ''" (keydown.enter)="save(h.value, w.value, a.value)" /></label>
      <label class="field">{{ 'settings.age' | t }}<app-number-field #a [value]="known.age ?? ''" (keydown.enter)="save(h.value, w.value, a.value)" /></label>
      <div class="field" role="radiogroup" [attr.aria-label]="'settings.sex' | t">
        {{ 'settings.sex' | t }}
        <div class="flex gap-2">
          @for (o of sexes; track o.value) {
            <button type="button" role="radio" class="btn h-[2.625rem] flex-1" [class.btn-primary]="sex() === o.value" [attr.aria-checked]="sex() === o.value" (click)="sex.set(o.value)">{{ o.label | t }}</button>
          }
        </div>
      </div>
    </div>
    <div class="mt-3"><button class="btn btn-primary" (click)="save(h.value, w.value, a.value)"><app-icon name="save" size="sm" />{{ 'common.save' | t }}</button></div>
  `,
})
export class BodyBasicsFormComponent {
  private readonly body = inject(BodyService);
  private readonly sync = inject(BodyBasicsSyncService);
  protected readonly known = inject(StoreService).settings();
  protected readonly sex = signal<Sex | null>(this.known.sex);
  protected readonly sexes: { value: Sex; label: string }[] = [
    { value: 'male', label: 'settings.sexMale' },
    { value: 'female', label: 'settings.sexFemale' },
  ];

  protected async save(height: string, weight: string, age: string): Promise<void> {
    await this.body.saveBasics(parseNum(height), parseNum(weight), parseNum(age), this.sex(), (b) => this.sync.persist(b));
  }
}
