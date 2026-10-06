import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { SLOTS } from '../../core/data/meals';
import { TRAINER_SLOTS } from '../../core/data/trainer-plan';
import { MealItem, SlotId, WeekPlan } from '../../core/models';
import { DayService } from '../../core/services/day.service';
import { ToastService } from '../../core/services/toast.service';
import { TrainerPlanService } from '../../core/services/trainer-plan.service';
import { AZ_DAYS, DateU, inputValue } from '../../core/utils';
import { IconComponent } from '../../shared/icon.component';
import { TimePickerComponent } from '../../shared/time-picker.component';

interface Row {
  slot: SlotId;
  time: string;
  text: string;
  /** Meal as it was when the editor opened — kept when the text is untouched, so its macros survive. */
  name0: string;
  items0: MealItem[];
}

@Component({
  selector: 'app-week-plan-page',
  imports: [IconComponent, TimePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-[18px]">
      <div class="card">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-1.5 rounded-[12px] border border-border-soft bg-surface p-1">
            <button class="btn btn-ghost btn-icon" (click)="shift(-1)" aria-label="Əvvəlki həftə"><app-icon name="left" /></button>
            <span class="px-2.5 font-semibold whitespace-nowrap">{{ label() }}</span>
            <button class="btn btn-ghost btn-icon" (click)="shift(1)" aria-label="Növbəti həftə"><app-icon name="right" /></button>
          </div>
          <span class="badge" [class.badge-training]="own()">{{ own() ? 'Bu həftə üçün yazılmış plan' : 'Əvvəlki həftənin planı istifadə olunur' }}</span>
        </div>
        <p class="text-muted" style="font-size: 12px; margin: 10px 0 0">
          Yemək xanasını boş qoysan, o yemək planda olmur. Mətnini dəyişmədiyin yeməklərin kalori və proteini saxlanılır; yeni yazdığın yeməklər 0 kcal sayılır.
        </p>
      </div>

      @for (day of days; track day) {
        <div class="card">
          <div class="card-head"><h3>{{ dayLabel(day) }}</h3></div>
          @for (r of draft()[day]; track r.slot; let i = $index) {
            <div class="mb-2 grid grid-cols-[110px_112px_1fr] items-center gap-2 phone:grid-cols-[90px_1fr]">
              <span class="text-[13px] text-text-2">{{ slotLabel(r.slot) }}</span>
              <app-time-picker label="Saat" [value]="r.time" (valueChange)="setTime(day, i, $event)" />
              <input type="text" [value]="r.text" (input)="setText(day, i, $event)" placeholder="məs. Qreçka (4 X/Q) + 2 xiyar" class="phone:col-span-2" />
            </div>
          }
        </div>
      }

      <div class="flex flex-wrap items-center gap-2">
        <button class="btn btn-primary" (click)="save()"><app-icon name="save" size="sm" />Planı yadda saxla</button>
        @if (own()) {
          <button class="btn btn-danger" (click)="clear()"><app-icon name="trash" size="sm" />Əvvəlki həftənin planına qaytar</button>
        }
      </div>
    </div>
  `,
})
export class WeekPlanPage {
  private readonly plans = inject(TrainerPlanService);
  private readonly day = inject(DayService);
  private readonly toast = inject(ToastService);

  protected readonly days = [1, 2, 3, 4, 5, 6, 7];
  protected readonly week = signal(DateU.monday(DateU.today()));
  protected readonly own = computed(() => this.plans.hasOwn(this.week()));
  protected readonly label = computed(() => `${DateU.short(this.week())} – ${DateU.short(DateU.add(this.week(), 6))}`);

  /** Editable copy of the plan in effect for the selected week; re-synced when the week or stored plans change. */
  protected readonly draft = linkedSignal<Record<number, Row[]>>(() => this.toRows(this.plans.planFor(this.week())));

  protected dayLabel(d: number): string {
    return `${d}-ci gün · ${AZ_DAYS[d - 1]} · ${DateU.short(DateU.add(this.week(), d - 1))}`;
  }

  protected slotLabel(s: SlotId): string {
    return SLOTS[s].label;
  }

  protected shift(n: number): void {
    this.week.update((w) => DateU.add(w, n * 7));
  }

  protected setText(day: number, i: number, e: Event): void {
    this.patch(day, i, { text: inputValue(e) });
  }

  protected setTime(day: number, i: number, time: string): void {
    if (time) this.patch(day, i, { time });
  }

  protected save(): void {
    const plan: WeekPlan = {};
    for (const d of this.days) {
      plan[d] = this.draft()[d]
        .filter((r) => r.text.trim())
        .map((r) => {
          const name = r.text.trim();
          const items = name === r.name0 ? r.items0 : [{ amt: 1, name, amtLabel: '', k: 0, p: 0, c: 0, f: 0 }];
          return { slot: r.slot, time: r.time, name, items };
        })
        .sort((a, b) => a.time.localeCompare(b.time));
    }
    this.day.setWeekPlan(this.week(), plan);
    this.toast.show('Həftə planı saxlanıldı ✓');
  }

  protected clear(): void {
    this.day.setWeekPlan(this.week(), null);
    this.toast.show('Əvvəlki həftənin planı bərpa edildi');
  }

  private patch(day: number, i: number, change: Partial<Row>): void {
    this.draft.update((d) => ({ ...d, [day]: d[day].map((r, j) => (j === i ? { ...r, ...change } : r)) }));
  }

  private toRows(plan: WeekPlan): Record<number, Row[]> {
    const rows: Record<number, Row[]> = {};
    for (const d of this.days) {
      rows[d] = TRAINER_SLOTS.map(({ slot, time }) => {
        const m = (plan[d] ?? []).find((x) => x.slot === slot);
        return { slot, time: m?.time ?? time, text: m?.name ?? '', name0: m?.name ?? '', items0: m?.items ?? [] };
      });
    }
    return rows;
  }
}
