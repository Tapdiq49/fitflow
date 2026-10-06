import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DayService } from '../../core/services/day.service';
import { ProgramService } from '../../core/services/program.service';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { WorkoutService } from '../../core/services/workout.service';
import { AZ_DAYS_SHORT, AZ_MONTHS, DateU } from '../../core/utils';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-calendar-page',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="card-head">
        <h3><app-icon name="calendar" /> {{ title() }}</h3>
        <div class="flex flex-wrap items-center gap-2">
          <button class="btn btn-sm btn-icon" (click)="shiftMonth(-1)" aria-label="Əvvəlki ay"><app-icon name="left" size="sm" /></button>
          <button class="btn btn-sm" (click)="month.set(ui.today().slice(0, 7))">Bu ay</button>
          <button class="btn btn-sm btn-icon" (click)="shiftMonth(1)" aria-label="Növbəti ay"><app-icon name="right" size="sm" /></button>
        </div>
      </div>
      <div class="grid grid-cols-7 gap-1.5">
        @for (d of dows; track d) {
          <div class="py-1 text-center text-[11px] font-bold tracking-[.06em] text-muted">{{ d }}</div>
        }
        @for (c of cells(); track c.k) {
          <button
            class="flex min-h-[84px] cursor-pointer flex-col gap-1 rounded-[12px] border bg-surface-2 p-2 text-left text-text [transition:border-color_.15s,transform_.15s] hover:[transform:translateY(-1px)] phone:min-h-[58px] phone:p-[5px]"
            [class]="(c.today ? 'border-accent' : 'border-border-soft hover:border-border-hover') + (c.out ? ' opacity-35' : '')"
            (click)="ui.detailDate.set(c.k)"
          >
            <span class="font-extrabold">{{ c.day }}</span>
            <span class="self-start rounded-[6px] px-1.5 py-0.5 text-[11px] font-semibold phone:px-1 phone:py-px phone:text-[9px]" [class]="tagClass[c.type]">{{ c.tag }}</span>
            <span class="mt-auto flex flex-wrap gap-1 [&>i]:size-[7px] [&>i]:rounded-full">
              @if (c.meals) {
                <i style="background: var(--kcal)" title="Yemək qeydi"></i>
              }
              @if (c.trained) {
                <i style="background: var(--accent)" title="Məşq/kardio edildi"></i>
              }
              @if (c.water) {
                <i style="background: var(--water)" title="Su hədəfi"></i>
              }
              @if (c.weight) {
                <i style="background: var(--protein)" title="Çəki qeydi"></i>
              }
            </span>
          </button>
        }
      </div>
      <div class="mt-3 flex flex-wrap gap-3.5 text-[12px] text-muted [&_i]:size-2 [&_i]:rounded-full [&>span]:flex [&>span]:items-center [&>span]:gap-1.5">
        <span><i style="background: var(--kcal)"></i>Yemək qeydi</span>
        <span><i style="background: var(--accent)"></i>Məşq/kardio edildi</span>
        <span><i style="background: var(--water)"></i>Su hədəfi</span>
        <span><i style="background: var(--protein)"></i>Çəki qeydi</span>
      </div>
    </div>
  `,
})
export class CalendarPage {
  protected readonly dows = AZ_DAYS_SHORT;
  protected readonly tagClass = { training: 'bg-accent/12 text-accent', cardio: 'bg-water/12 text-water', rest: 'bg-sleep/12 text-sleep' };
  protected readonly ui = inject(UiService);
  private readonly program = inject(ProgramService);
  private readonly store = inject(StoreService);
  private readonly day = inject(DayService);
  private readonly workout = inject(WorkoutService);

  protected readonly month = signal(this.ui.viewDate().slice(0, 7));
  protected readonly title = computed(() => {
    const [y, m] = this.month().split('-').map(Number);
    return `${AZ_MONTHS[m - 1]} ${y}`;
  });

  protected readonly cells = computed(() => {
    const first = `${this.month()}-01`;
    const m = DateU.parse(first).getMonth();
    const start = DateU.monday(first);
    const s = this.store.state();
    const weighed = new Set(s.weights.map((w) => w.date));
    return Array.from({ length: 42 }, (_, i) => {
      const k = DateU.add(start, i);
      const d = s.days[k];
      const type = this.program.dayType(k);
      return {
        k,
        type,
        day: DateU.parse(k).getDate(),
        out: DateU.parse(k).getMonth() !== m,
        today: k === this.ui.today(),
        tag: type === 'training' ? this.workout.tag(k) : type === 'cardio' ? 'Kardio' : 'Bərpa',
        meals: !!d?.menu?.some((x) => x.done),
        trained: !!(d && (d.workout?.savedAt || d.checks['workout'] || d.cardio.done)),
        water: !!d && d.water >= this.day.waterTarget(k),
        weight: weighed.has(k),
      };
    });
  });

  protected shiftMonth(n: number): void {
    const d = DateU.parse(`${this.month()}-01`);
    d.setMonth(d.getMonth() + n);
    this.month.set(DateU.key(d).slice(0, 7));
  }
}
