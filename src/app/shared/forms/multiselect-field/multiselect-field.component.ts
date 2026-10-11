import { ChangeDetectionStrategy, Component, effect, input, model, signal, untracked, viewChild } from '@angular/core';
import { Combobox, ComboboxPopup, ComboboxWidget } from '@angular/aria/combobox';
import { Listbox, Option } from '@angular/aria/listbox';
import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { IconComponent } from '../../icon/icon.component';
import { POPUP_PANEL, POPUP_POSITIONS } from '../popup/popup';
import { SelectOption } from '../select-field/select-field.component';

/**
 * Multi-choice dropdown on Angular Aria: the same `ngCombobox` trigger and CDK overlay as `<app-select-field>`, with a
 * multi-select `ngListbox` popup that stays open while options are ticked. The field shows the chosen labels in option order
 * (cut with an ellipsis, in full as a tooltip). Keyboard: Enter / Space / ↓ open, ↑ ↓ Home End move, Space or Enter toggles, Escape closes.
 *
 * ```html
 * <app-multiselect-field [label]="'settings.walkDays' | t" [options]="days()" [(value)]="walkDays" />
 * ```
 */
@Component({
  selector: 'app-multiselect-field',
  imports: [Combobox, ComboboxPopup, ComboboxWidget, Listbox, Option, CdkConnectedOverlay, CdkOverlayOrigin, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: `
    <div
      ngCombobox
      #combobox="ngCombobox"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
      [(expanded)]="open"
      [disabled]="disabled()"
      [attr.aria-label]="label()"
      class="flex h-full w-full cursor-pointer items-center justify-between gap-2 rounded-[calc(var(--r)_*_9px)] border bg-bg px-2.5 py-2 text-left text-[0.875rem] font-medium text-text outline-none [transition:border-color_.2s] focus-visible:border-accent aria-disabled:cursor-not-allowed aria-disabled:border-border-soft aria-disabled:bg-surface-2 aria-disabled:text-muted aria-disabled:opacity-70"
      [class]="open() ? 'border-accent' : 'border-border'"
    >
      <span class="min-w-0 truncate" [class.text-muted]="!selectedLabel()" [attr.title]="selectedLabel() || null">{{ selectedLabel() || placeholder() }}</span><app-icon name="down" size="sm" class="shrink-0" />
    </div>
    <ng-template ngComboboxPopup [combobox]="combobox" popupType="listbox">
      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="origin"
        [cdkConnectedOverlayOpen]="true"
        [cdkConnectedOverlayPositions]="positions"
        [cdkConnectedOverlayMatchWidth]="true"
        [cdkConnectedOverlayViewportMargin]="8"
        cdkConnectedOverlayUsePopover="inline"
      >
        <div
          ngComboboxWidget
          ngListbox
          #listbox="ngListbox"
          [multi]="true"
          focusMode="activedescendant"
          selectionMode="explicit"
          [activeDescendant]="listbox.activeDescendant()"
          [attr.aria-label]="label()"
          [value]="value()"
          (valueChange)="pick($event)"
          [class]="panel + ' max-h-[17.5rem] p-1'"
        >
          @for (o of options(); track o.value) {
            <div
              ngOption
              [value]="o.value"
              [label]="o.label"
              class="flex cursor-pointer items-center justify-between gap-2 rounded-[calc(var(--r)_*_8px)] px-2.5 py-2 text-[0.875rem] hover:bg-surface data-[active=true]:bg-surface data-[active=true]:outline data-[active=true]:outline-accent/60 aria-selected:font-semibold aria-selected:text-accent"
            >
              <span class="min-w-0 truncate" [attr.title]="o.label">{{ o.label }}</span>
              @if (value().includes(o.value)) {
                <app-icon name="check" size="sm" class="shrink-0" />
              }
            </div>
          }
        </div>
      </ng-template>
    </ng-template>
  `,
})
export class MultiselectFieldComponent<T> {
  readonly value = model.required<T[]>();
  readonly options = input.required<readonly SelectOption<T>[]>();
  /** Accessible name; the visible caption usually sits above the field. */
  readonly label = input.required<string>();
  readonly disabled = input(false);
  /** Shown (muted) while nothing is chosen. */
  readonly placeholder = input('');

  protected readonly open = signal(false);
  protected readonly panel = POPUP_PANEL;
  protected readonly positions = POPUP_POSITIONS;
  private readonly listbox = viewChild<Listbox<T>>('listbox');

  /** The chosen labels, in the order of the options. */
  protected selectedLabel(): string {
    const chosen = this.value();
    return this.options()
      .filter((o) => chosen.includes(o.value))
      .map((o) => o.label)
      .join(', ');
  }

  constructor() {
    // Keep the highlighted option visible while moving through a long list.
    effect(() => {
      const box = this.listbox();
      box?.activeDescendant();
      untracked(() => box?.scrollActiveItemIntoView({ block: 'nearest' }));
    });
  }

  protected pick(values: T[]): void {
    const order = this.options().map((o) => o.value);
    this.value.set([...values].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  }
}
