import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, numberAttribute } from '@angular/core';
import { parseNum } from '../../../core/utils';
import { FIELD_ATTRS, FieldBase } from '../field-base/field-base';

/**
 * What may stay in a number field: digits, and when decimals are allowed one decimal mark (a point or a comma, `parseNum` reads both).
 * Letters, signs and spaces are dropped as they are typed or pasted.
 */
export function cleanNumberText(text: string, decimal: boolean): string {
  let mark = false;
  let out = '';
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') out += ch;
    else if (decimal && (ch === '.' || ch === ',') && !mark) {
      mark = true;
      out += ch;
    }
  }
  return out;
}

/**
 * A field for a number: amounts, weights, calories, repetitions. It is a text input with the numeric keyboard (a comma or a point as the
 * decimal mark is read by `parseNum`, which a native `type="number"` would refuse). Only digits (and one decimal mark with `decimal`) can be
 * typed or pasted. The two small buttons on the right (shown while the pointer is over the field or it has the focus), and the arrow keys,
 * count down and up by `step` (1, or 0.5 with `decimal`) between `min` (0) and `max`.
 *
 * ```html
 * <label class="field">{{ 'common.weightKg' | t }}<app-number-field #kg decimal /></label>
 * <app-number-field width="4.5rem" [value]="amount()" [label]="'common.amount' | t" decimal [step]="5" [max]="500" />
 * ```
 */
@Component({
  selector: 'app-number-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0', '[style.width]': 'width() || null' },
  template: `
    <div class="group relative">
      <input
        ${FIELD_ATTRS}
        [class]="'w-full pr-6 ' + inputClass()"
        (input)="clean()"
        (keydown.arrowUp)="bump(1); $event.preventDefault()"
        (keydown.arrowDown)="bump(-1); $event.preventDefault()"
      />
      @if (stepper() && !disabled()) {
        <!-- Keeps the focus in the input (mousedown is not let through), and is out of the way until the field is used. -->
        <div
          class="pointer-events-none absolute inset-y-[3px] right-[3px] flex w-[1.125rem] flex-col opacity-0 [transition:opacity_.15s] group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
        >
          <button type="button" tabindex="-1" class="stepper-btn" (mousedown)="$event.preventDefault()" (click)="bump(1)" [attr.aria-label]="'+'">
            <svg viewBox="0 0 10 6" class="h-[0.4rem] w-[0.625rem]" fill="currentColor" aria-hidden="true"><path d="M0 6l5-6 5 6z" /></svg>
          </button>
          <button type="button" tabindex="-1" class="stepper-btn" (mousedown)="$event.preventDefault()" (click)="bump(-1)" [attr.aria-label]="'-'">
            <svg viewBox="0 0 10 6" class="h-[0.4rem] w-[0.625rem]" fill="currentColor" aria-hidden="true"><path d="M0 0l5 6 5-6z" /></svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .stepper-btn {
      display: grid;
      flex: 1;
      place-items: center;
      padding: 0;
      border: 0;
      border-radius: 4px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
    }
    .stepper-btn:hover {
      background: var(--surface-2);
      color: var(--text);
    }
  `,
})
export class NumberFieldComponent extends FieldBase {
  readonly decimal = input(false, { transform: booleanAttribute });
  /** How much a button or an arrow key changes the number by; 1, or 0.5 with `decimal`. */
  readonly step = input<number | null, unknown>(null, { transform: (v) => (v == null || v === '' ? null : numberAttribute(v)) });
  readonly min = input(0, { transform: numberAttribute });
  readonly max = input<number | null, unknown>(null, { transform: (v) => (v == null || v === '' ? null : numberAttribute(v)) });
  /** Show the buttons that count down and up (and answer the arrow keys). */
  readonly stepper = input(true, { transform: booleanAttribute });

  readonly type = computed(() => 'text');
  readonly mode = computed(() => (this.decimal() ? 'decimal' : 'numeric'));

  /** Drops what is not a number from the text, keeping the caret where it was as far as the change allows. */
  protected clean(): void {
    const el = this.field().nativeElement;
    const cleaned = cleanNumberText(el.value, this.decimal());
    if (cleaned === el.value) return;
    const caret = el.selectionStart ?? cleaned.length;
    const removed = el.value.length - cleaned.length;
    el.value = cleaned;
    el.setSelectionRange(Math.max(0, caret - removed), Math.max(0, caret - removed));
  }

  /** One step down (-1) or up (1) from the number in the field (0 while it is empty), kept between the smallest and the largest allowed. */
  protected bump(direction: 1 | -1): void {
    if (this.disabled()) return;
    const el = this.field().nativeElement;
    const step = this.step() ?? (this.decimal() ? 0.5 : 1);
    const current = parseNum(el.value);
    let next = (Number.isFinite(current) ? current : 0) + direction * step;
    const max = this.max();
    next = Math.max(this.min(), max == null ? next : Math.min(max, next));
    const decimals = (String(step).split('.')[1] ?? '').length;
    el.value = String(Number(next.toFixed(decimals)));
    // The same events typing would send, so whoever listens to the field (input, change) hears the new number.
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
