import { ChangeDetectionStrategy, Component, effect, input, model, signal, untracked, viewChild } from '@angular/core';
import { Combobox, ComboboxPopup, ComboboxWidget } from '@angular/aria/combobox';
import { Listbox, Option } from '@angular/aria/listbox';
import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { IconComponent } from '../icon.component';
import { POPUP_PANEL, POPUP_POSITIONS } from './popup';

export interface SelectOption<T> {
  value: T;
  /** Already translated text. */
  label: string;
}

/**
 * Single-choice dropdown on Angular Aria: an `ngCombobox` trigger with an `ngListbox` popup,
 * positioned by a CDK connected overlay in the top layer (works inside modals and clipped cards).
 * Keyboard: Enter / Space / ↓ open, ↑ ↓ Home End move, typing jumps, Enter selects, Escape closes.
 *
 * ```html
 * <app-select [label]="'settings.appearance' | t" [options]="themes()" [(value)]="theme" />
 * ```
 */
@Component({
  selector: 'app-select',
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
      class="flex h-full w-full cursor-pointer items-center justify-between gap-2 rounded-[9px] border bg-bg px-2.5 py-2 text-left text-[14px] font-medium text-text outline-none [transition:border-color_.2s] focus-visible:border-accent aria-disabled:cursor-default aria-disabled:opacity-55"
      [class]="open() ? 'border-accent' : 'border-border'"
    >
      <span class="truncate">{{ selectedLabel() }}</span><app-icon name="down" size="sm" />
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
          focusMode="activedescendant"
          selectionMode="explicit"
          [activeDescendant]="listbox.activeDescendant()"
          [attr.aria-label]="label()"
          [value]="[value()]"
          (valueChange)="pick($event)"
          [class]="panel + ' max-h-[280px] p-1'"
        >
          @for (o of options(); track o.value) {
            <div
              ngOption
              [value]="o.value"
              [label]="o.label"
              class="flex cursor-pointer items-center justify-between gap-2 rounded-[8px] px-2.5 py-2 text-[14px] hover:bg-surface data-[active=true]:bg-surface data-[active=true]:outline data-[active=true]:outline-accent/60 aria-selected:font-semibold aria-selected:text-accent"
            >
              <span>{{ o.label }}</span>
              @if (o.value === value()) {
                <app-icon name="check" size="sm" />
              }
            </div>
          }
        </div>
      </ng-template>
    </ng-template>
  `,
})
export class SelectComponent<T> {
  readonly value = model.required<T>();
  readonly options = input.required<readonly SelectOption<T>[]>();
  /** Accessible name; the visible caption usually sits above the field. */
  readonly label = input.required<string>();
  readonly disabled = input(false);

  protected readonly open = signal(false);
  protected readonly panel = POPUP_PANEL;
  protected readonly positions = POPUP_POSITIONS;
  private readonly combobox = viewChild.required<Combobox>('combobox');
  private readonly listbox = viewChild<Listbox<T>>('listbox');

  protected selectedLabel(): string {
    return this.options().find((o) => o.value === this.value())?.label ?? '';
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
    const v = values[0];
    if (v !== undefined && v !== this.value()) this.value.set(v);
    this.open.set(false);
    this.combobox().element.focus();
  }
}
