import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { IconComponent } from '../../icon/icon.component';

/**
 * A checkbox in the colours of the app: a rounded box that fills with the accent colour and shows a tick when it is on. The label
 * goes inside the tags. A native `<input type="checkbox">` stays inside (hidden, but focusable and read by screen readers and the
 * keyboard), so Space toggles it and the browser tells assistive technology its state.
 *
 * ```html
 * <app-checkbox [(checked)]="useWhey">{{ 'settings.addWheyToMenu' | t }}</app-checkbox>
 * <app-checkbox [checked]="has(p)" [disabled]="locked()" (checkedChange)="toggle(p)" labelClass="rounded-lg border px-3 py-2">…</app-checkbox>
 * ```
 */
@Component({
  selector: 'app-checkbox',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <label [class]="'flex items-start gap-2.5 ' + (disabled() ? 'cursor-not-allowed opacity-60 ' : 'cursor-pointer ') + labelClass()">
      <input type="checkbox" class="peer sr-only" [checked]="checked()" [disabled]="disabled()" [attr.aria-label]="ariaLabel() || null" (change)="checked.set($any($event.target).checked)" />
      <span
        class="mt-px grid h-[1.125rem] w-[1.125rem] shrink-0 place-items-center rounded-[calc(var(--r)_*_5px)] border [transition:background_.15s,border-color_.15s] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
        [class]="checked() ? 'border-accent bg-accent text-accent-ink' : 'border-border-strong bg-surface-2 text-transparent'"
        aria-hidden="true"
      >
        @if (checked()) {
          <app-icon name="check" size="sm" />
        }
      </span>
      <span class="min-w-0"><ng-content /></span>
    </label>
  `,
})
export class CheckboxComponent {
  readonly checked = model(false);
  readonly disabled = input(false);
  /** Extra classes of the clickable row (e.g. a bordered tile), so the whole tile toggles. */
  readonly labelClass = input('');
  /** Name for a checkbox that has no text inside (already translated). */
  readonly ariaLabel = input('');
}
