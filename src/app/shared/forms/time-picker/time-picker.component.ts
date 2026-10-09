import { ChangeDetectionStrategy, Component, computed, effect, input, model, signal, untracked, viewChild, viewChildren } from '@angular/core';
import { Combobox, ComboboxPopup, ComboboxWidget } from '@angular/aria/combobox';
import { Grid, GridCell, GridRow } from '@angular/aria/grid';
import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { activeTimeFormat, fmtTime, fromMin, toMin } from '../../../core/utils';
import { IconComponent } from '../../icon/icon.component';
import { TPipe } from '../../../common/pipes/translate/t.pipe';
import { POPUP_PANEL, POPUP_POSITIONS } from '../popup/popup';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const COLS = 6;

const CELL =
  'cursor-pointer rounded-[calc(var(--r)_*_8px)] border py-1.5 text-center text-[0.8125rem] font-semibold tabular-nums hover:border-accent data-[active=true]:outline-2 data-[active=true]:outline-offset-1 data-[active=true]:outline-accent';
const CELL_OFF = `${CELL} border-border-soft bg-bg`;
const CELL_ON = `${CELL} border-accent bg-accent text-accent-ink`;

let nextId = 0;

const rows = (list: number[]): number[][] => Array.from({ length: Math.ceil(list.length / COLS) }, (_, i) => list.slice(i * COLS, i * COLS + COLS));

/**
 * Time field ("HH:MM" stored; shown as 24 h or AM/PM by the settings) on Angular Aria: an `ngCombobox` trigger with one `ngGrid` popup holding the hours,
 * then the minutes (5-minute steps). Arrow keys move in 2D across both, Enter / Space / click picks; picking a
 * minute closes the popup.
 *
 * The grid's own selection only mirrors the value (`aria-selected`): a plain click in a multi-select grid clears the
 * other cells, so picks come from the click / Enter on a cell, and an effect re-selects the hour and minute that are set.
 */
@Component({
  selector: 'app-time-picker',
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
      class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-[calc(var(--r)_*_9px)] border bg-bg px-2.5 py-2 text-left text-[0.875rem] font-medium text-text tabular-nums outline-none [transition:border-color_.2s] focus-visible:border-accent"
      [class]="open() ? 'border-accent' : 'border-border'"
    >
      <span>{{ value() ? fmt(value()) : '--:--' }}</span><app-icon name="clock" size="sm" />
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
          [class]="panel + ' max-h-[18.75rem] w-[16.5rem] p-3'"
        >
          <div role="rowgroup" [attr.aria-label]="'common.time' | t">
            <div class="eyebrow mb-1.5" aria-hidden="true">{{ 'common.time' | t }}</div>
            @for (row of hourRows; track $index) {
              <div ngGridRow class="mb-1 grid grid-cols-6 gap-1">
                @for (h of row; track h) {
                  <div ngGridCell [id]="cellId('h', h)" (click)="pick('h', h)" [class]="h === hour() ? cellOn : cellOff"><span [class]="twelveHour() ? 'text-[0.6875rem]' : ''">{{ hourLabel(h) }}</span></div>
                }
              </div>
            }
          </div>
          <div role="rowgroup" [attr.aria-label]="'common.minutes' | t">
            <div class="eyebrow mt-3 mb-1.5" aria-hidden="true">{{ 'common.minutes' | t }}</div>
            @for (row of minuteRows(); track $index) {
              <div ngGridRow class="mb-1 grid grid-cols-6 gap-1">
                @for (m of row; track m) {
                  <div ngGridCell [id]="cellId('m', m)" (click)="pick('m', m)" [class]="m === minute() ? cellOn : cellOff">{{ pad(m) }}</div>
                }
              </div>
            }
          </div>
        </div>
      </ng-template>
    </ng-template>
  `,
})
export class TimePickerComponent {
  readonly value = model('');
  /** Accessible name; the visible caption usually sits above the field. */
  readonly label = input.required<string>();

  protected readonly open = signal(false);
  protected readonly panel = POPUP_PANEL;
  protected readonly positions = POPUP_POSITIONS;
  protected readonly hourRows = rows(HOURS);
  protected readonly cellOn = CELL_ON;
  protected readonly cellOff = CELL_OFF;
  protected readonly pad = (n: number): string => String(n).padStart(2, '0');
  protected readonly fmt = fmtTime;
  protected readonly twelveHour = computed(() => activeTimeFormat() === '12h');
  /** Hour cell text: 07 in 24 h, 7 AM in 12 h. */
  protected hourLabel(h: number): string {
    return this.twelveHour() ? `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}` : this.pad(h);
  }
  private readonly combobox = viewChild.required<Combobox>('combobox');
  private readonly cells = viewChildren(GridCell);
  private readonly uid = `tp${nextId++}`;

  protected readonly hour = computed(() => (this.value() ? Math.floor(toMin(this.value()) / 60) : -1));
  protected readonly minute = computed(() => (this.value() ? toMin(this.value()) % 60 : -1));
  /** 5-minute steps, plus the current minute when it isn't one of them. */
  protected readonly minuteRows = computed(() => {
    const steps = Array.from({ length: 12 }, (_, i) => i * 5);
    const m = this.minute();
    return rows(m >= 0 && !steps.includes(m) ? [...steps, m].sort((a, b) => a - b) : steps);
  });

  constructor() {
    // Mirror the value into the grid selection, undoing the grid's own toggling.
    effect(() => {
      const want = new Set([this.cellId('h', this.hour()), this.cellId('m', this.minute())]);
      for (const cell of this.cells()) {
        const on = want.has(cell.id());
        if (cell.selected() !== on) untracked(() => cell.selected.set(on));
      }
    });
  }

  protected cellId(kind: 'h' | 'm', n: number): string {
    return `${this.uid}-${kind}${n}`;
  }

  /** An hour keeps the popup open; a minute completes the time and closes it. */
  protected pick(kind: 'h' | 'm', n: number): void {
    if (kind === 'h') {
      this.value.set(fromMin(n * 60 + Math.max(0, this.minute())));
      return;
    }
    this.value.set(fromMin(Math.max(0, this.hour()) * 60 + n));
    this.open.set(false);
    this.combobox().element.focus();
  }

  /** Enter / Space (relayed from the combobox) pick the active cell. */
  protected onGridKeydown(e: KeyboardEvent, grid: Grid): void {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const m = grid.activeDescendant()?.match(/-(h|m)(\d+)$/);
    if (m) this.pick(m[1] as 'h' | 'm', Number(m[2]));
  }
}
