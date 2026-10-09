import { Directive, ElementRef, booleanAttribute, input, numberAttribute, viewChild } from '@angular/core';

/**
 * What a template reference to a field (`#amount` on `<app-number-field>`) gives to the code: the text in it, which can also be set
 * (to clear the field after it was used). Handlers that took an `HTMLInputElement` for this take a `FieldValue` now.
 */
export interface FieldValue {
  value: string;
}

/** The attributes of the `<input>` every text and number field wraps; each field adds its own class and handlers. */
export const FIELD_ATTRS = `
    #field
    [attr.type]="type()"
    [attr.inputmode]="mode()"
    [value]="shown() ?? ''"
    [placeholder]="'' + placeholder()"
    [disabled]="disabled()"
    [attr.name]="name() || null"
    [attr.autocomplete]="autocomplete() || null"
    [attr.autocapitalize]="autocapitalize() || null"
    [attr.spellcheck]="spellcheck()"
    [attr.maxlength]="maxlength()"
    [attr.aria-label]="label() || null"
    [attr.aria-invalid]="invalid() ? 'true' : null"
  `;

/**
 * Shared by `app-text-field` and `app-number-field`. The events of the input (`input`, `change`, `keydown`, `focusout`, ...) reach the
 * host element, so `(input)="save($event)"` and `$event.target.value` work on the field as on a plain input; `blur` does not bubble,
 * use `focusout`. The host element takes the layout classes (`flex-1`, `col-span-3`, `min-w-[7.5rem]`), `width` the size.
 */
@Directive()
export abstract class FieldBase implements FieldValue {
  /** The text shown; follows the binding whenever its value changes (like `[value]` on an input). */
  readonly shown = input<string | number | null>('', { alias: 'value' });
  readonly placeholder = input<string | number>('');
  readonly disabled = input(false, { transform: booleanAttribute });
  /** The accessible name when no visible label is attached. */
  readonly label = input('');
  /** Marks the field as having a wrong value (red frame, `aria-invalid`). */
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly name = input('');
  readonly autocomplete = input('');
  readonly autocapitalize = input('');
  readonly spellcheck = input<'true' | 'false' | null>(null);
  readonly maxlength = input<number | null, unknown>(null, { transform: (v) => (v == null || v === '' ? null : numberAttribute(v)) });
  /** The width of the field, any CSS length ("5.625rem", "90px"); empty = as wide as the place it sits in. */
  readonly width = input('');
  /** Extra classes of the input itself (alignment, weight): `text-center font-semibold`. */
  readonly inputClass = input('');

  abstract readonly type: () => string;
  abstract readonly mode: () => string | null;

  protected readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  get value(): string {
    return this.field().nativeElement.value;
  }
  set value(v: string) {
    this.field().nativeElement.value = v;
  }

  focus(): void {
    this.field().nativeElement.focus();
  }
}
