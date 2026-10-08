import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { CORNERS, DATE_FORMATS, FONT_SCALES, HEADER_MODES, NAV_LAYOUTS, NavLayout, SKINS, SkinId, TIME_FORMATS } from '../../common/interfaces';
import { TPipe } from '../../common/pipes/translate/t.pipe';
import { t } from '../../core/i18n/translate';
import { ThemeService } from '../../core/services/theme.service';
import { POPUP_PANEL } from '../../shared/forms/popup';
import { IconComponent } from '../../shared/icon/icon.component';

/** Below the button, end edges aligned (the button sits at the end of the header). */
const POSITIONS: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
];

/** One row of the panel: a caption and a few choices of which one is picked. */
interface Choice {
  id: string;
  label: string;
  value: string;
  cols: number;
  options: { value: string; label: string }[];
  set: (value: string) => void;
}

/**
 * Gear button in the header that opens the display settings: text direction, navigation layout, text size, corners,
 * contrast, clock and date format, and a button that puts them all back to the defaults. Everything is saved as a setting
 * (so it follows the account). Defer it: CDK overlay stays out of the initial bundle.
 */
@Component({
  selector: 'app-display-settings',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="btn btn-ghost btn-icon"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="'display.title' | t"
      [title]="'display.title' | t"
      (click)="open.set(!open())"
    >
      <app-icon name="settings" />
    </button>
    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions"
      [cdkConnectedOverlayViewportMargin]="8"
      cdkConnectedOverlayUsePopover="inline"
      (overlayOutsideClick)="onOutside($event, origin.elementRef.nativeElement)"
      (overlayKeydown)="onKey($event)"
      (detach)="open.set(false)"
    >
      <div role="dialog" [attr.aria-label]="'display.title' | t" [class]="panel + ' max-h-[calc(100vh-80px)] w-[19rem] p-3'">
        <div class="mb-1.5 text-[0.6875rem] font-bold tracking-[.06em] text-muted uppercase">{{ 'display.palette' | t }}</div>
        <div role="radiogroup" [attr.aria-label]="'display.palette' | t" class="mb-3 flex justify-between gap-1">
          @for (k of skins(); track k.value) {
            <button
              type="button"
              role="radio"
              class="skin-swatch grid size-7 shrink-0 cursor-pointer place-items-center rounded-full border-2 bg-accent text-accent-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              [class]="theme.skin() === k.value ? 'border-text' : 'border-transparent hover:border-border-strong'"
              [attr.data-skin]="k.value"
              [attr.aria-checked]="theme.skin() === k.value"
              [attr.aria-label]="k.label"
              [title]="k.label"
              (click)="theme.setSkin(k.value)"
            >
              @if (theme.skin() === k.value) {
                <app-icon name="check" size="sm" />
              }
            </button>
          }
        </div>

        <div class="mb-1.5 text-[0.6875rem] font-bold tracking-[.06em] text-muted uppercase">{{ 'display.layout' | t }}</div>
        <div role="radiogroup" [attr.aria-label]="'display.layout' | t" class="mb-3 grid grid-cols-4 gap-1">
          @for (l of layouts(); track l.value) {
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="theme.layout() === l.value"
              [title]="l.label"
              class="flex min-w-0 cursor-pointer flex-col gap-1 rounded-[calc(var(--r)_*_8px)] border bg-bg p-1 text-center text-[0.625rem] font-semibold text-text outline-none focus-visible:border-accent"
              [class]="theme.layout() === l.value ? 'border-accent bg-accent-soft' : 'border-border-soft hover:border-border-hover'"
              (click)="theme.setLayout(l.value)"
            >
              <!-- Miniature of the layout: the accent block is the navigation. -->
              <span class="relative block h-8 w-full overflow-hidden rounded-[calc(var(--r)_*_4px)] border border-border-soft bg-surface-2" aria-hidden="true">
                @switch (l.value) {
                  @case ('side') {
                    <span class="absolute inset-y-0 start-0 w-[24%] bg-accent/70"></span>
                  }
                  @case ('floating') {
                    <span class="absolute start-[3px] top-[3px] bottom-[3px] w-[22%] rounded-[calc(var(--r)_*_3px)] bg-accent/70"></span>
                  }
                  @case ('top') {
                    <span class="absolute inset-x-0 top-0 h-[24%] bg-accent/70"></span>
                  }
                  @case ('dock') {
                    <span class="absolute bottom-[3px] start-1/2 h-[20%] w-[56%] -translate-x-1/2 rounded-full bg-accent/70 rtl:translate-x-1/2"></span>
                  }
                }
              </span>
              <span class="truncate" [class]="theme.layout() === l.value ? 'text-accent' : 'text-text-2'">{{ l.label }}</span>
            </button>
          }
        </div>

        @for (c of choices(); track c.id) {
          <div class="mb-1.5 text-[0.6875rem] font-bold tracking-[.06em] text-muted uppercase">{{ c.label }}</div>
          <div
            role="radiogroup"
            [attr.aria-label]="c.label"
            class="mb-3 grid gap-0.5 rounded-[calc(var(--r)_*_9px)] border border-border-soft bg-bg p-0.5"
            [style.grid-template-columns]="'repeat(' + c.cols + ', minmax(0, 1fr))'"
          >
            @for (o of c.options; track o.value) {
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="c.value === o.value"
                class="min-w-0 cursor-pointer truncate rounded-[calc(var(--r)_*_7px)] border-0 px-1.5 py-1.5 text-[0.75rem] font-semibold outline-none focus-visible:outline-2 focus-visible:outline-accent"
                [class]="c.value === o.value ? 'bg-accent-soft text-accent' : 'bg-transparent text-text-2 hover:text-text'"
                (click)="c.set(o.value)"
              >
                {{ o.label }}
              </button>
            }
          </div>
        }

        <button
          type="button"
          role="switch"
          [attr.aria-checked]="theme.highContrast()"
          class="mb-3 flex w-full cursor-pointer items-center justify-between gap-3 rounded-[calc(var(--r)_*_9px)] border border-border-soft bg-bg px-2.5 py-1.5 text-start text-[0.75rem] font-semibold text-text outline-none hover:border-border-hover focus-visible:border-accent"
          (click)="theme.set('highContrast', !theme.highContrast())"
        >
          {{ 'display.contrast' | t }}
          <span class="relative h-4 w-7 shrink-0 rounded-full transition-colors" [class]="theme.highContrast() ? 'bg-accent' : 'bg-surface-3'">
            <span class="absolute top-0.5 size-3 rounded-full transition-all" [class]="theme.highContrast() ? 'start-[0.875rem] bg-accent-ink' : 'start-0.5 bg-text'"></span>
          </span>
        </button>

        <button type="button" class="btn btn-sm w-full" (click)="theme.resetDisplay()">
          <app-icon name="refresh" size="sm" />{{ 'display.reset' | t }}
        </button>
      </div>
    </ng-template>
  `,
})
export class DisplaySettingsComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly open = signal(false);
  protected readonly panel = POPUP_PANEL;
  protected readonly positions = POSITIONS;

  protected readonly choices = computed<Choice[]>(() => [
    {
      id: 'dir',
      label: t('display.direction'),
      value: this.theme.dir(),
      cols: 2,
      options: [
        { value: 'ltr', label: t('display.ltr') },
        { value: 'rtl', label: t('display.rtl') },
      ],
      set: (v) => this.theme.setDir(v as 'ltr' | 'rtl'),
    },
    {
      id: 'header',
      label: t('display.header'),
      value: this.theme.headerMode(),
      cols: 3,
      options: HEADER_MODES.map((value) => ({ value, label: t('header.' + value) })),
      set: (v) => this.theme.set('headerMode', v as (typeof HEADER_MODES)[number]),
    },
    {
      id: 'font',
      label: t('display.fontSize'),
      value: this.theme.fontScale(),
      cols: 3,
      options: FONT_SCALES.map((value) => ({ value, label: t('font.' + value) })),
      set: (v) => this.theme.set('fontScale', v as (typeof FONT_SCALES)[number]),
    },
    {
      id: 'corners',
      label: t('display.corners'),
      value: this.theme.corners(),
      cols: 3,
      options: CORNERS.map((value) => ({ value, label: t('corners.' + value) })),
      set: (v) => this.theme.set('corners', v as (typeof CORNERS)[number]),
    },
    {
      id: 'time',
      label: t('display.timeFormat'),
      value: this.theme.timeFormat(),
      cols: 2,
      options: TIME_FORMATS.map((value) => ({ value, label: t('timeFormat.' + value) })),
      set: (v) => this.theme.set('timeFormat', v as (typeof TIME_FORMATS)[number]),
    },
    {
      id: 'date',
      label: t('display.dateFormat'),
      value: this.theme.dateFormat(),
      cols: 3,
      options: DATE_FORMATS.map((value) => ({ value, label: t('dateFormat.' + value) })),
      set: (v) => this.theme.set('dateFormat', v as (typeof DATE_FORMATS)[number]),
    },
  ]);

  protected readonly skins = computed<{ value: SkinId; label: string }[]>(() => SKINS.map((value) => ({ value, label: t('skin.' + value) })));
  protected readonly layouts = computed<{ value: NavLayout; label: string }[]>(() => NAV_LAYOUTS.map((value) => ({ value, label: t('layout.' + value) })));

  /** A click on the gear itself is handled by the button (it toggles); any other click outside closes the panel. */
  protected onOutside(e: MouseEvent, button: HTMLElement): void {
    if (!button.contains(e.target as Node)) this.open.set(false);
  }

  protected onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') this.open.set(false);
  }
}
