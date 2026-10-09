import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, linkedSignal } from '@angular/core';
import { TPipe } from '../../../common/pipes/translate/t.pipe';
import { IconComponent } from '../../icon/icon.component';
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
 * <app-text-field clearable [value]="q.searchInput()" (input)="q.setSearch(val($event))" />   <!-- an × inside the field empties it -->
 * ```
 */
@Component({
  selector: 'app-text-field',
  imports: [IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0', '[style.width]': 'width() || null' },
  template: `
    <div class="relative">
      <input ${FIELD_ATTRS} [class]="'w-full ' + (clearable() ? '!pr-8 ' : '') + inputClass()" (input)="typed.set(value)" />
      @if (clearable() && typed() && !disabled()) {
        <button type="button" class="absolute top-1/2 right-1.5 grid -translate-y-1/2 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-1 text-muted hover:bg-surface-2 hover:text-text" (click)="clear()" [attr.aria-label]="'common.clear' | t" [title]="'common.clear' | t">
          <app-icon name="x" size="sm" />
        </button>
      }
    </div>
  `,
})
export class TextFieldComponent extends FieldBase {
  readonly kind = input<'text' | 'email' | 'password' | 'search'>('text', { alias: 'type' });
  /** The keyboard a phone shows, when it is not the usual one (`email`). */
  readonly inputmode = input('');

  /** Shows an × inside the field, at the right, while it holds text; it empties the field and keeps the focus there. */
  readonly clearable = input(false, { transform: booleanAttribute });
  /** The text as far as the × is concerned: follows the binding, and every key the user types. */
  protected readonly typed = linkedSignal(() => String(this.shown() ?? ''));

  readonly type = computed(() => this.kind());
  readonly mode = computed(() => this.inputmode() || null);

  protected clear(): void {
    const el = this.field().nativeElement;
    el.value = '';
    // The owner listens to (input) like on a plain input, so it is told the text is gone.
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
  }
}
