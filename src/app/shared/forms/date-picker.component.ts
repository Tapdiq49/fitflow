import { ChangeDetectionStrategy, Component, computed, effect, input, model, signal, untracked, viewChild, viewChildren } from '@angular/core';
import { Combobox, ComboboxPopup, ComboboxWidget } from '@angular/aria/combobox';
import { Grid, GridCell, GridRow } from '@angular/aria/grid';
import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { DateU, dayShort, monthName } from '../../core/utils';
import { IconComponent } from '../icon/icon.component';
import { TPipe } from '../../common/pipes/translate/t.pipe';
import { POPUP_PANEL, POPUP_POSITIONS } from './popup';

const CELL =
  'cursor-pointer rounded-[8px] border py-1.5 text-center text-[13px] font-semibold tabular-nums hover:border-accent data-[active=true]:outline-2 data-[active=true]:outline-offset-1 data-[active=true]:outline-accent aria-disabled:cursor-not-allowed aria-disabled:opacity-35 aria-disabled:hover:border-border-soft';
const CELL_DAY = `${CELL} border-border-soft bg-bg`;
const CELL_OUTSIDE = `${CELL} border-transparent bg-transparent text-muted`;
const CELL_TODAY = `${CELL} border-accent/60 bg-bg`;
const CELL_ON = `${CELL} border-accent bg-accent text-accent-ink`;

let nextId = 0;

const display = (k: string): string => {
  const [y, m, d] = k.split('-');
  return `${d}.${m}.${y}`;
};

interface Day {
  key: string;
  day: number;
  outside: boolean;
}

/**
 * Date field ("YYYY-MM-DD") on Angular Aria: an `ngCombobox` trigger with one `ngGrid` month calendar in the popup.
 * Month and weekday names follow the app language; the date itself is shown as DD.MM.YYYY whatever the language.
 * Arrow keys move over the days, PageUp / PageDown change the month, Enter / Space / click pick, and days after
 * `max` (or before `min`) cannot be picked.
 *
 * Like the time picker, the grid's own selection only mirrors the value; picks come from the click / Enter on a cell.
 */
@Component({
  selector: 'app-date-picker',
  imports: [Combobox, ComboboxPopup, ComboboxWidget, Grid, GridRow, GridCell, CdkConnectedOverlay, CdkOverlayOrigin, IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      ngCombobox
      #combobox="ngCombobox"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
      [(expanded)]="open"
      [attr.aria-label]="label()"
      class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-[9px] border bg-bg px-2.5 py-2 text-left text-[14px] font-medium text-text tabular-nums outline-none [transition:border-color_.2s] focus-visible:border-accent"
      [class]="open() ? 'border-accent' : 'border-border'"
    >
      <span>{{ value() ? shown() : '--.--.----' }}</span><app-icon name="calendar" size="sm" />
    </div>
    <ng-template ngComboboxPopup [combobox]="combobox" popupType="grid">
      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="origin"
        [cdkConnectedOverlayOpen]="true"
        [cdkConnectedOverlayPositions]="positions"
        [cdkConnectedOverlayViewportMargin]="8"
        cdkConnectedOverlayUsePopover="inline"
      >
        <div
          ngComboboxWidget
          ngGrid
          #grid="ngGrid"
          focusMode="activedescendant"
          [activeDescendant]="grid.activeDescendant()"
          [enableSelection]="true"
          [multi]="true"
          [attr.aria-label]="label()"
          (keydown)="onGridKeydown($event, grid)"
          [class]="panel + ' w-[296px] p-3'"
        >
          <div class="mb-2 flex items-center justify-between gap-2">
            <button type="button" class="btn btn-ghost btn-icon btn-sm" tabindex="-1" [disabled]="!canGo(-1)" (click)="shiftMonth(-1)" [attr.aria-label]="'common.previousMonth' | t"><app-icon name="left" size="sm" /></button>
            <span class="text-[14px] font-bold" aria-live="polite">{{ title() }}</span>
            <button type="button" class="btn btn-ghost btn-icon btn-sm" tabindex="-1" [disabled]="!canGo(1)" (click)="shiftMonth(1)" [attr.aria-label]="'common.nextMonth' | t"><app-icon name="right" size="sm" /></button>
          </div>
          <div class="mb-1 grid grid-cols-7 gap-1 text-center" aria-hidden="true">
            @for (d of weekdays(); track $index) {
              <span class="eyebrow">{{ d }}</span>
            }
          </div>
          <div role="rowgroup" [attr.aria-label]="title()">
            @for (week of weeks(); track $index) {
              <div ngGridRow class="mb-1 grid grid-cols-7 gap-1">
                @for (d of week; track d.key) {
                  <div ngGridCell [id]="cellId(d.key)" [disabled]="isDisabled(d.key)" (click)="pick(d.key)" [class]="cellClass(d)" [attr.aria-label]="long(d.key)">{{ d.day }}</div>
                }
              </div>
            }
          </div>
        </div>
      </ng-template>
    </ng-template>
  `,
})
export class DatePickerComponent {
  /** "YYYY-MM-DD", or '' while no date is chosen. */
  readonly value = model('');
  /** Accessible name; the visible caption usually sits above the field. */
  readonly label = input.required<string>();
  /** Latest / earliest day that can be picked ("YYYY-MM-DD"). */
  readonly max = input<string | undefined>(undefined);
  readonly min = input<string | undefined>(undefined);

  protected readonly open = signal(false);
  protected readonly panel = POPUP_PANEL;
  protected readonly positions = POPUP_POSITIONS;
  private readonly combobox = viewChild.required<Combobox>('combobox');
  private readonly cells = viewChildren(GridCell);
  private readonly uid = `dp${nextId++}`;

  /** First day of the month the calendar shows. */
  private readonly viewMonth = signal(DatePickerComponent.firstOf(DateU.today()));

  protected readonly long = DateU.long;
  protected readonly shown = computed(() => display(this.value()));
  protected readonly title = computed(() => {
    const d = DateU.parse(this.viewMonth());
    return `${monthName(d.getMonth())} ${d.getFullYear()}`;
  });
  protected readonly weekdays = computed(() => Array.from({ length: 7 }, (_, i) => dayShort(i)));
  /** Six weeks, Monday first, always the same size. */
  protected readonly weeks = computed<Day[][]>(() => {
    const first = this.viewMonth();
    const month = DateU.parse(first).getMonth();
    const start = DateU.monday(first);
    return Array.from({ length: 6 }, (_, w) =>
      Array.from({ length: 7 }, (_, i) => {
        const key = DateU.add(start, w * 7 + i);
        return { key, day: DateU.parse(key).getDate(), outside: DateU.parse(key).getMonth() !== month };
      }),
    );
  });

  constructor() {
    // The calendar opens on the month of the chosen date (or today's).
    effect(() => {
      if (this.open()) untracked(() => this.viewMonth.set(DatePickerComponent.firstOf(this.value() || DateU.today())));
    });
    // Mirror the value into the grid selection, undoing the grid's own toggling.
    effect(() => {
      const want = this.value() ? this.cellId(this.value()) : '';
      for (const cell of this.cells()) {
        const on = cell.id() === want;
        if (cell.selected() !== on) untracked(() => cell.selected.set(on));
      }
    });
  }

  private static firstOf(k: string): string {
    return `${k.slice(0, 7)}-01`;
  }

  protected cellId(key: string): string {
    return `${this.uid}-${key}`;
  }

  protected isDisabled(key: string): boolean {
    const max = this.max();
    const min = this.min();
    return (!!max && key > max) || (!!min && key < min);
  }

  protected cellClass(d: Day): string {
    if (d.key === this.value()) return CELL_ON;
    if (d.outside) return CELL_OUTSIDE;
    return d.key === DateU.today() ? CELL_TODAY : CELL_DAY;
  }

  /** Whether the month before / after the shown one holds a day that can be picked. */
  protected canGo(step: -1 | 1): boolean {
    const first = this.viewMonth();
    if (step === 1) {
      const next = DatePickerComponent.firstOf(DateU.add(first, 32));
      return !this.max() || next <= (this.max() as string);
    }
    const prevLast = DateU.add(first, -1);
    return !this.min() || prevLast >= (this.min() as string);
  }

  protected shiftMonth(step: -1 | 1): void {
    if (!this.canGo(step)) return;
    this.viewMonth.set(DatePickerComponent.firstOf(step === 1 ? DateU.add(this.viewMonth(), 32) : DateU.add(this.viewMonth(), -1)));
  }

  protected pick(key: string): void {
    if (this.isDisabled(key)) return;
    this.value.set(key);
    this.open.set(false);
    this.combobox().element.focus();
  }

  /** Enter / Space (relayed from the combobox) pick the active day; PageUp / PageDown change the month. */
  protected onGridKeydown(e: KeyboardEvent, grid: Grid): void {
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      this.shiftMonth(e.key === 'PageUp' ? -1 : 1);
      return;
    }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const m = grid.activeDescendant()?.match(/-(\d{4}-\d{2}-\d{2})$/);
    if (m) this.pick(m[1]);
  }
}
