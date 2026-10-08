import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SLOTS } from '../../core/data/meals';
import { Meal } from '../../common/interfaces';
import { itemAmount, itemMacros, itemName, mealMacros, menuTotals } from '../../core/nutrition';
import { ConfirmService } from '../../core/services/confirm.service';
import { DayService } from '../../core/services/day.service';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { F } from '../../core/utils';
import { IconComponent } from '../../shared/icon/icon.component';
import { TPipe, TdPipe } from '../../common/pipes/translate/t.pipe';
import { TimePipe } from '../../common/pipes/format/time.pipe';
import { t, td } from '../../core/i18n/translate';

/** Today's meals as macro tables, with daily totals. */
@Component({
  selector: 'app-meals-card',
  imports: [IconComponent, TPipe, TdPipe, TimePipe],
  host: { class: 'card' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card-head">
      <h3><app-icon name="utensils" /> {{ 'dash.todaysMeals' | t }}</h3>
      <div class="flex flex-wrap items-center gap-2">
        <!-- The trainer's menu is fixed by the week plan, so a new one would be identical. -->
        @if (store.effectiveMenuMode() !== 'trainer') {
          <button class="btn btn-primary btn-sm" (click)="day.regenerateMenu(k())"><app-icon name="refresh" size="sm" />{{ 'dash.createNewDailyMenu' | t }}</button>
        }
        <button class="btn btn-sm" (click)="ui.addMealOpen.set(true)"><app-icon name="plus" size="sm" />{{ 'dash.addMeal' | t }}</button>
        <button class="btn btn-sm btn-ghost" (click)="newDay()">{{ 'dash.resetDay' | t }}</button>
      </div>
    </div>

    @if (outOfRange()) {
      <div class="alert alert-warn" style="margin-bottom: 12px">
        <app-icon name="alert" />
        <div>
          {{ 'dash.planLittleOffTarget' | t: { a: F.round(plan().k), b: F.round(plan().p) } }}
        </div>
      </div>
    }

    @for (m of meals(); track m.id) {
      @let mm = macros(m);
      <div
        class="mb-3 overflow-hidden rounded-[calc(var(--r)_*_14px)] border bg-surface-2 [transition:border-color_.2s,opacity_.2s]"
        [class]="m.done ? 'border-good/35' : 'border-border-soft'"
      >
        <div class="flex flex-wrap items-center gap-3.5 px-3.5 py-3">
          <span class="rounded-[calc(var(--r)_*_8px)] border border-border bg-bg px-2 py-1 text-[0.8125rem] font-extrabold tabular-nums">{{ m.time | time }}</span>
          <div class="min-w-[10rem] flex-1">
            <span class="eyebrow">{{ slotLabel(m) }}</span><b class="block text-[0.9375rem]">{{ m.name | td }}</b>
          </div>
          <span class="text-[0.8125rem] text-text-2 tabular-nums">{{ 'dash.nKcalNG' | t: { a: F.round(mm.k), b: F.round(mm.p) } }}</span>
          <div class="flex gap-1.5">
            @if (!m.custom && !m.done) {
              <button class="btn btn-sm btn-icon" [title]="'dash.alternativeMeal' | t" (click)="day.swapMeal(k(), m.id)"><app-icon name="shuffle" size="sm" /></button>
            }
            @if (m.custom) {
              <button class="btn btn-sm btn-icon btn-danger" [title]="'common.delete' | t" (click)="day.removeMeal(k(), m.id)"><app-icon name="trash" size="sm" /></button>
            }
            <button class="btn btn-sm" [class.btn-done]="m.done" (click)="day.toggleMeal(k(), m.id)">
              <app-icon name="check" size="sm" />{{ m.done ? ('dash.eaten' | t) : ('dash.complete' | t) }}
            </button>
          </div>
        </div>
        <div class="overflow-x-auto border-t border-border-soft">
          <table class="tbl">
            <thead>
              <tr>
                <th>{{ 'dash.meal' | t }}</th><th>{{ 'common.food' | t }}</th><th class="tbl-num">{{ 'common.amount' | t }}</th><th class="tbl-num">{{ 'dash.calories2' | t }}</th>
                <th class="tbl-num">{{ 'dash.protein' | t }}</th><th class="tbl-num">{{ 'dash.carbs' | t }}</th><th class="tbl-num">{{ 'dash.fat' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (it of m.items; track $index; let first = $first) {
                @let x = itemMacros(it);
                <tr>
                  @if (first) {
                    <td [attr.rowspan]="m.items.length" class="tbl-text"><b>{{ slotLabel(m) }}</b></td>
                  }
                  <td class="tbl-text">
                    {{ itemName(it) }}
                    @if (it.note) {
                      <div class="text-muted" style="font-size: 0.6875rem">{{ it.note | td }}</div>
                    }
                  </td>
                  <td class="tbl-num">{{ itemAmount(it) }}</td>
                  <td class="tbl-num">{{ F.round(x.k) }}</td>
                  <td class="tbl-num">{{ F.r1(x.p) }}</td>
                  <td class="tbl-num">{{ F.r1(x.c) }}</td>
                  <td class="tbl-num">{{ F.r1(x.f) }}</td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3">{{ 'common.total' | t }}</td>
                <td class="tbl-num">{{ F.round(mm.k) }}</td>
                <td class="tbl-num">{{ F.r1(mm.p) }}</td>
                <td class="tbl-num">{{ F.r1(mm.c) }}</td>
                <td class="tbl-num">{{ F.r1(mm.f) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    }

    <div class="mt-4 grid grid-cols-6 gap-2.5 laptop:grid-cols-3 phone:grid-cols-2">
      <div class="sum-box"><span class="eyebrow">{{ 'dash.totalCalories' | t }}</span><b>{{ F.round(eaten().k) }}</b><small>{{ 'dash.planNKcal' | t: { a: F.round(plan().k) } }}</small></div>
      <div class="sum-box"><span class="eyebrow">{{ 'dash.totalProtein' | t }}</span><b>{{ 'dash.nG' | t: { a: F.round(eaten().p) } }}</b><small>{{ 'dash.planNG' | t: { a: F.round(plan().p) } }}</small></div>
      <div class="sum-box"><span class="eyebrow">{{ 'dash.totalCarbs' | t }}</span><b>{{ 'dash.nG' | t: { a: F.round(eaten().c) } }}</b><small>{{ 'dash.planNG' | t: { a: F.round(plan().c) } }}</small></div>
      <div class="sum-box"><span class="eyebrow">{{ 'dash.totalFat' | t }}</span><b>{{ 'dash.nG' | t: { a: F.round(eaten().f) } }}</b><small>{{ 'dash.planNG' | t: { a: F.round(plan().f) } }}</small></div>
      <div class="sum-box"><span class="eyebrow">{{ 'dash.water' | t }}</span><b>{{ 'dash.nL' | t: { a: F.liters(water()) } }}</b><small>{{ 'dash.targetNL' | t: { a: F.liters(waterTarget()) } }}</small></div>
      <div class="sum-box">
        <span class="eyebrow">{{ 'dash.mealsCompleted' | t }}</span><b>{{ doneCount() }} / {{ meals().length }}</b><small>{{ F.pct(doneCount(), meals().length) }}%</small>
      </div>
    </div>
  `,
})
export class MealsCardComponent {
  protected readonly F = F;
  protected readonly itemMacros = itemMacros;
  protected readonly itemName = itemName;
  protected readonly itemAmount = itemAmount;
  protected readonly macros = mealMacros;

  protected readonly day = inject(DayService);
  protected readonly ui = inject(UiService);
  protected readonly store = inject(StoreService);
  private readonly confirm = inject(ConfirmService);

  protected readonly k = this.ui.viewDate;
  private readonly record = computed(() => this.store.state().days[this.k()] ?? null);
  protected readonly meals = computed(() => this.record()?.menu ?? []);
  protected readonly plan = computed(() => menuTotals(this.meals()));
  protected readonly eaten = computed(() => menuTotals(this.meals(), true));
  protected readonly doneCount = computed(() => this.meals().filter((m) => m.done).length);
  protected readonly water = computed(() => this.record()?.water ?? 0);
  protected readonly waterTarget = computed(() => this.day.waterTarget(this.k()));
  protected readonly outOfRange = computed(() => {
    const s = this.store.settings();
    const p = this.plan();
    return this.meals().length > 0 && (Math.abs(p.k - s.kcalTarget) > 100 || Math.abs(p.p - s.proteinTarget) > 10);
  });

  protected slotLabel(m: Meal): string {
    return SLOTS[m.slot] ? td(SLOTS[m.slot].label) : t('dash.meal');
  }

  protected async newDay(): Promise<void> {
    if (await this.confirm.ask(t('dash.resetAllOfTodays'), { confirmLabel: t('dash.reset'), danger: true })) {
      this.day.resetDay(this.k());
    }
  }
}
