import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, model, signal, viewChild } from '@angular/core';
import { fromMin, toMin } from '../core/utils';
import { IconComponent } from './icon.component';
import { TPipe } from './t.pipe';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const POPOVER_W = 264;
const POPOVER_H = 250;
const GAP = 6;
const MARGIN = 8;

const CELL = 'cursor-pointer rounded-[8px] border py-1.5 text-center text-[13px] font-semibold tabular-nums hover:border-accent';
const CELL_OFF = `${CELL} border-border-soft bg-bg`;
const CELL_ON = `${CELL} border-accent bg-accent text-accent-ink`;

/** The picker whose popover was opened last; only one is open at a time. */
let openPicker: TimePickerComponent | null = null;

/** Click-to-open time picker ("HH:MM", 24 h): pick the hour, then the minute (5-minute steps). */
@Component({
  selector: 'app-time-picker',
  imports: [IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
    '(document:click)': 'onDocClick($event)',
    '(document:scroll)': 'open.set(false)',
    '(window:resize)': 'open.set(false)',
    '(keydown.escape)': 'onEscape($event)',
  },
  template: `
    <button
      type="button"
      class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-[9px] border bg-bg px-2.5 py-2 text-left text-[14px] font-medium text-text tabular-nums [transition:border-color_.2s]"
      [class]="open() ? 'border-accent' : 'border-border'"
      [attr.aria-label]="label()"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open()"
      (click)="toggle($event)"
    >
      <span>{{ value() || '--:--' }}</span><app-icon name="clock" size="sm" />
    </button>
    @if (open()) {
      <!-- Top-layer popover: unaffected by transformed/clipping ancestors (cards, modal). -->
      <div
        #pop
        popover="manual"
        class="m-0 overflow-y-auto rounded-[12px] border border-border bg-surface-2 p-3 text-text shadow-[0_12px_32px_rgba(0,0,0,.45)]"
        role="dialog"
        [attr.aria-label]="label()"
        [style.top.px]="pos().top"
        [style.left.px]="pos().left"
        [style.width.px]="popoverW"
        [style.max-height.px]="pos().maxH"
      >
        <div class="eyebrow mb-1.5">{{ 'common.time' | t }}</div>
        <div class="grid grid-cols-6 gap-1">
          @for (h of hours; track h) {
            <button type="button" [class]="h === hour() ? cellOn : cellOff" (click)="pickHour(h)">{{ pad(h) }}</button>
          }
        </div>
        <div class="eyebrow mt-3 mb-1.5">{{ 'common.minutes' | t }}</div>
        <div class="grid grid-cols-6 gap-1">
          @for (m of minutes(); track m) {
            <button type="button" [class]="m === minute() ? cellOn : cellOff" (click)="pickMinute(m)">{{ pad(m) }}</button>
          }
        </div>
      </div>
    }
  `,
})
export class TimePickerComponent {
  readonly value = model('');
  readonly label = input('Saat');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly pop = viewChild<ElementRef<HTMLElement>>('pop');
  protected readonly open = signal(false);
  protected readonly pos = signal({ top: 0, left: 0, maxH: POPOVER_H });
  protected readonly hours = HOURS;
  protected readonly popoverW = POPOVER_W;
  protected readonly cellOn = CELL_ON;
  protected readonly cellOff = CELL_OFF;
  protected readonly pad = (n: number): string => String(n).padStart(2, '0');

  protected readonly hour = computed(() => (this.value() ? Math.floor(toMin(this.value()) / 60) : -1));
  protected readonly minute = computed(() => (this.value() ? toMin(this.value()) % 60 : -1));
  /** 5-minute steps, plus the current minute when it isn't one of them. */
  protected readonly minutes = computed(() => {
    const steps = Array.from({ length: 12 }, (_, i) => i * 5);
    const m = this.minute();
    return m >= 0 && !steps.includes(m) ? [...steps, m].sort((a, b) => a - b) : steps;
  });

  constructor() {
    effect(() => this.pop()?.nativeElement.showPopover());
  }

  /** Opens right under the field, or above it when there is more room there; scrolls when neither fits. */
  protected toggle(e: Event): void {
    e.stopPropagation();
    if (this.open()) return this.open.set(false);
    const r = this.host.nativeElement.getBoundingClientRect();
    const roomBelow = innerHeight - r.bottom - GAP - MARGIN;
    const roomAbove = r.top - GAP - MARGIN;
    const up = roomBelow < POPOVER_H && roomAbove > roomBelow;
    const maxH = Math.max(120, Math.min(POPOVER_H, up ? roomAbove : roomBelow));
    this.pos.set({
      top: up ? Math.max(MARGIN, r.top - GAP - Math.min(maxH, POPOVER_H)) : r.bottom + GAP,
      left: Math.max(MARGIN, Math.min(r.left, innerWidth - POPOVER_W - MARGIN)),
      maxH,
    });
    // The click is not propagated, so other pickers never see it: close the one that is open.
    if (openPicker !== this) openPicker?.open.set(false);
    openPicker = this;
    this.open.set(true);
  }

  protected pickHour(h: number): void {
    this.value.set(fromMin(h * 60 + Math.max(0, this.minute())));
  }

  protected pickMinute(m: number): void {
    this.value.set(fromMin(Math.max(0, this.hour()) * 60 + m));
    this.open.set(false);
  }

  protected onDocClick(e: Event): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  /** Closes the popover without also closing a modal the picker sits in. */
  protected onEscape(e: Event): void {
    if (!this.open()) return;
    e.stopPropagation();
    this.open.set(false);
  }
}
