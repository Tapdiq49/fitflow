import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FIELD_ATTRS, FieldBase } from '../field-base/field-base';

/**
 * A one-line text field: names, search boxes, e-mail addresses and passwords. Numbers use `app-number-field`; a dropdown
 * `app-select-field`. The native `<input>` stays (Aria has no text input); this only gives every text input the same attributes,
 * sizes and error mark.
 *
 * ```html
 * <label class="field">{{ 'roles.name' | t }}<app-text-field [value]="name()" (input)="name.set(val($event))" maxlength="60" /></label>
 * <app-text-field type="password" name="password" autocomplete="current-password" [value]="password()" (input)="password.set(val($event))" />
 * <app-text-field class="w-full" width="14rem" [label]="'admin.search' | t" [placeholder]="'admin.search' | t" />
 * ```
 */
@Component({
  selector: 'app-text-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0', '[style.width]': 'width() || null' },
  template: `<input ${FIELD_ATTRS} [class]="'w-full ' + inputClass()" />`,
})
export class TextFieldComponent extends FieldBase {
  readonly kind = input<'text' | 'email' | 'password' | 'search'>('text', { alias: 'type' });
  /** The keyboard a phone shows, when it is not the usual one (`email`). */
  readonly inputmode = input('');

  readonly type = computed(() => this.kind());
  readonly mode = computed(() => this.inputmode() || null);
}
