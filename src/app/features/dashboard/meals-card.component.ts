import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { foodShort } from '../../core/data/foods';
import { SLOTS } from '../../core/data/meals';
import { Meal } from '../../core/models';
import { itemAmount, itemMacros, itemName, mealMacros, menuTotals } from '../../core/nutrition';
import { DayService } from '../../core/services/day.service';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { F } from '../../core/utils';
import { IconComponent } from '../../shared/icon.component';

/** Today's meals as macro tables, with daily totals. */
@Component({
  selector: 'app-meals-card',
  imports: [IconComponent],
  host: { class: 'card' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card-head">
      <h3><app-icon name="utensils" /> Today's Meals</h3>
      <div class="flex flex-wrap items-center gap-2">
        <button class="btn btn-primary btn-sm" (click)="day.regenerateMenu(k())"><app-icon name="refresh" size="sm" />Yeni Günlük Menyu Yarat</button>
        <button class="btn btn-sm" (click)="ui.addMealOpen.set(true)"><app-icon name="plus" size="sm" />Add meal</button>
        <button class="btn btn-sm btn-ghost" (click)="newDay()">Yeni gün yarat</button>
      </div>
    </div>

    @if (outOfRange()) {
      <div class="alert alert-warn" style="margin-bottom: 12px">
        <app-icon name="alert" />
        <div>
          Plan hədəfdən bir qədər kənardadır ({{ F.round(plan().k) }} kcal, {{ F.round(plan().p) }} q protein). Porsiyalar köpün qarşısını
          almaq üçün məhdudlaşdırılıb. Yeni menyu yaratmağı və ya Ayarlarda yemək sayını dəyişməyi yoxla.
        </div>
      </div>
    }

    @for (m of meals(); track m.id) {
      @let mm = macros(m);
      <div
        class="mb-3 overflow-hidden rounded-[14px] border bg-surface-2 [transition:border-color_.2s,opacity_.2s]"
        [class]="m.done ? 'border-good/35' : 'border-border-soft'"
      >
        <div class="flex flex-wrap items-center gap-3.5 px-3.5 py-3">
          <span class="rounded-[8px] border border-border bg-bg px-2 py-1 text-[13px] font-extrabold tabular-nums">{{ m.time }}</span>
          <div class="min-w-[160px] flex-1">
            <span class="eyebrow">{{ slotLabel(m) }}</span><b class="block text-[15px]">{{ m.name }}</b>
          </div>
          <span class="text-[13px] text-text-2 tabular-nums">{{ F.round(mm.k) }} kcal · {{ F.round(mm.p) }} q P</span>
          <div class="flex gap-1.5">
            @if (!m.custom && !m.done) {
              <button class="btn btn-sm btn-icon" title="Alternativ yemək" (click)="day.swapMeal(k(), m.id)"><app-icon name="shuffle" size="sm" /></button>
            }
            @if (m.custom) {
              <button class="btn btn-sm btn-icon btn-danger" title="Sil" (click)="day.removeMeal(k(), m.id)"><app-icon name="trash" size="sm" /></button>
            }
            <button class="btn btn-sm" [class.btn-done]="m.done" (click)="day.toggleMeal(k(), m.id)">
              <app-icon name="check" size="sm" />{{ m.done ? 'Yeyildi' : 'Complete' }}
            </button>
          </div>
        </div>
        <div class="overflow-x-auto border-t border-border-soft">
          <table class="tbl">
            <thead>
              <tr>
                <th>Yemək</th><th>Qida</th><th class="tbl-num">Miqdar</th><th class="tbl-num">Kalori</th>
                <th class="tbl-num">Protein</th><th class="tbl-num">Karbohidrat</th><th class="tbl-num">Yağ</th>
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
                    @if (it.swapped) {
                      <span class="ml-1.5 text-[11px] text-warn" title="Köp qeydlərinə görə əvəz edildi">↺ {{ foodShort(it.swapped) }} əvəzinə</span>
                    }
                    @if (it.note) {
                      <div class="text-muted" style="font-size: 11px">{{ it.note }}</div>
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
                <td colspan="3">Cəmi</td>
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
      <div class="sum-box"><span class="eyebrow">Total Calories</span><b>{{ F.round(eaten().k) }}</b><small>plan {{ F.round(plan().k) }} kcal</small></div>
      <div class="sum-box"><span class="eyebrow">Total Protein</span><b>{{ F.round(eaten().p) }} q</b><small>plan {{ F.round(plan().p) }} q</small></div>
      <div class="sum-box"><span class="eyebrow">Total Carbs</span><b>{{ F.round(eaten().c) }} q</b><small>plan {{ F.round(plan().c) }} q</small></div>
      <div class="sum-box"><span class="eyebrow">Total Fat</span><b>{{ F.round(eaten().f) }} q</b><small>plan {{ F.round(plan().f) }} q</small></div>
      <div class="sum-box"><span class="eyebrow">Water</span><b>{{ F.liters(water()) }} L</b><small>hədəf {{ F.liters(waterTarget()) }} L</small></div>
      <div class="sum-box">
        <span class="eyebrow">Meals completed</span><b>{{ doneCount() }} / {{ meals().length }}</b><small>{{ F.pct(doneCount(), meals().length) }}%</small>
      </div>
    </div>
  `,
})
export class MealsCardComponent {
  protected readonly F = F;
  protected readonly itemMacros = itemMacros;
  protected readonly itemName = itemName;
  protected readonly itemAmount = itemAmount;
  protected readonly foodShort = foodShort;
  protected readonly macros = mealMacros;

  protected readonly day = inject(DayService);
  protected readonly ui = inject(UiService);
  private readonly store = inject(StoreService);

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
    return SLOTS[m.slot]?.label ?? 'Yemək';
  }

  protected newDay(): void {
    if (confirm('Bu günün bütün qeydləri (yeməklər, su, checklist, məşq qaralaması) sıfırlansın və yeni plan yaradılsın?')) {
      this.day.resetDay(this.k());
    }
  }
}
