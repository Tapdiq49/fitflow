import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { menuTotals, sleepMinutes } from '../../core/nutrition';
import { DayService } from '../../core/services/day.service';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { F, inputValue } from '../../core/utils';
import { IconComponent } from '../../shared/icon.component';
import { TimePickerComponent } from '../../shared/time-picker.component';
import { TPipe } from '../../shared/t.pipe';
import { t } from '../../core/i18n/translate';

/** The four headline cards: Calories, Protein, Water, Sleep. */
@Component({
  selector: 'app-stat-cards',
  imports: [IconComponent, TimePickerComponent, TPipe],
  host: { class: 'grid grid-cols-4 gap-4 laptop:grid-cols-2 phone:gap-2.5' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card flex flex-col gap-3">
      <div class="flex items-center justify-between"><span class="eyebrow">{{ 'dash.calories' | t }}</span><span class="grid size-9 place-items-center rounded-[10px] bg-kcal/14 text-kcal"><app-icon name="flame" /></span></div>
      <div class="text-[28px] font-extrabold tracking-[-.02em] tabular-nums phone:text-[22px]">{{ F.round(eaten().k) }} <small class="text-[14px] font-semibold text-muted">{{ 'dash.perNKcal' | t: { a: s().kcalTarget } }}</small></div>
      <div class="bar bar-kcal"><i [style.width.%]="F.pct(eaten().k, s().kcalTarget)"></i></div>
      <small class="text-muted">{{ 'dash.planNKcalN' | t: { a: F.round(plan().k), b: F.round(max0(s().kcalTarget - eaten().k)) } }}</small>
    </div>

    <div class="card flex flex-col gap-3">
      <div class="flex items-center justify-between"><span class="eyebrow">{{ 'dash.protein' | t }}</span><span class="grid size-9 place-items-center rounded-[10px] bg-protein/14 text-protein"><app-icon name="zap" /></span></div>
      <div class="text-[28px] font-extrabold tracking-[-.02em] tabular-nums phone:text-[22px]">{{ F.round(eaten().p) }} <small class="text-[14px] font-semibold text-muted">{{ 'dash.perNG' | t: { a: s().proteinTarget } }}</small></div>
      <div class="bar bar-protein"><i [style.width.%]="F.pct(eaten().p, s().proteinTarget)"></i></div>
      <small class="text-muted">{{ 'dash.planNGN' | t: { a: F.round(plan().p), b: F.round(max0(s().proteinTarget - eaten().p)) } }}</small>
    </div>

    <div class="card flex flex-col gap-3">
      <div class="flex items-center justify-between"><span class="eyebrow">{{ 'dash.water' | t }}</span><span class="grid size-9 place-items-center rounded-[10px] bg-water/14 text-water"><app-icon name="droplet" /></span></div>
      <div class="text-[28px] font-extrabold tracking-[-.02em] tabular-nums phone:text-[22px]">{{ F.liters(water()) }} <small class="text-[14px] font-semibold text-muted">{{ 'dash.perNL' | t: { a: F.liters(waterTarget()) } }}</small></div>
      <div class="bar bar-water"><i [style.width.%]="F.pct(water(), waterTarget())"></i></div>
      <div class="grid grid-cols-[repeat(4,1fr)] gap-1.5 phone:grid-cols-[1fr_1fr]">
        @for (ml of waterSteps; track ml) {
          <button class="btn btn-sm px-1! py-1.5! text-[12px]!" (click)="day.addWater(k(), ml)">+{{ ml }}</button>
        }
      </div>
      <button class="btn btn-ghost btn-sm" [disabled]="!canUndo()" (click)="day.undoWater(k())">{{ 'dash.undoLast' | t }}</button>
    </div>

    <div class="card flex flex-col gap-3">
      <div class="flex items-center justify-between"><span class="eyebrow">{{ 'dash.sleep' | t }}</span><span class="grid size-9 place-items-center rounded-[10px] bg-sleep/14 text-sleep"><app-icon name="moon" /></span></div>
      <div class="text-[28px] font-extrabold tracking-[-.02em] tabular-nums phone:text-[22px]">{{ F.dur(sleep()) }} <small class="text-[14px] font-semibold text-muted">{{ 'dash.per79H' | t }}</small></div>
      <div class="bar bar-sleep"><i [style.width.%]="sleep() ? F.pct(sleep()!, 480) : 0"></i></div>
      <div class="grid grid-cols-[1fr_1fr] gap-2">
        <div class="field">{{ 'dash.wentToBed' | t }}<app-time-picker [label]="'dash.wentToBed' | t" [value]="bed()" (valueChange)="day.setSleep(k(), 'bed', $event)" /></div>
        <div class="field">{{ 'dash.wokeUp' | t }}<app-time-picker [label]="'dash.wokeUp' | t" [value]="wake()" (valueChange)="day.setSleep(k(), 'wake', $event)" /></div>
      </div>
      <small class="text-muted">{{ sleepNote() }}</small>
    </div>
  `,
})
export class StatCardsComponent {
  protected readonly F = F;
  protected readonly val = inputValue;
  protected readonly waterSteps = [250, 500, 750, 1000];
  protected readonly day = inject(DayService);
  private readonly store = inject(StoreService);
  private readonly ui = inject(UiService);

  protected readonly k = this.ui.viewDate;
  protected readonly s = this.store.settings;
  private readonly record = computed(() => this.store.state().days[this.k()] ?? null);
  protected readonly eaten = computed(() => menuTotals(this.record()?.menu, true));
  protected readonly plan = computed(() => menuTotals(this.record()?.menu));
  protected readonly water = computed(() => this.record()?.water ?? 0);
  protected readonly waterTarget = computed(() => this.day.waterTarget(this.k()));
  protected readonly canUndo = computed(() => !!this.record()?.waterLog.length);
  protected readonly bed = computed(() => this.record()?.sleep.bed ?? '');
  protected readonly wake = computed(() => this.record()?.sleep.wake ?? '');
  protected readonly sleep = computed(() => sleepMinutes(this.record()?.sleep));
  protected readonly sleepNote = computed(() => {
    const m = this.sleep();
    if (m == null) return t('dash.enterLastNightsSleep');
    if (m < 420) return t('dash.under7HoursRecovery');
    if (m > 540) return t('dash.over9Hours');
    return t('dash.withinTargetRange');
  });

  protected max0(n: number): number {
    return Math.max(0, n);
  }
}
