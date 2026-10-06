import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { SLOTS } from '../../core/data/meals';
import { EXERCISES, PROGRAM } from '../../core/data/program';
import { Meal } from '../../core/models';
import { mealMacros, menuTotals, sleepMinutes } from '../../core/nutrition';
import { DayService } from '../../core/services/day.service';
import { ProgramService } from '../../core/services/program.service';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { WorkoutService } from '../../core/services/workout.service';
import { F } from '../../core/utils';
import { ModalComponent } from '../../shared/modal.component';
import { TypeBadgeComponent } from '../../shared/type-badge.component';

/** Calendar day details: meals, workout, cardio, water, weight, sleep, bloating. */
@Component({
  selector: 'app-day-detail-dialog',
  imports: [ModalComponent, TypeBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [heading]="F.long(date())" (closed)="close()">
      <div class="flex flex-wrap items-center gap-2" style="margin-bottom: 12px">
        <app-type-badge [date]="date()" />
        @if (score() != null) {
          <span class="badge">Skor: {{ score() }}%</span>
        }
      </div>

      <div class="section-title">Yeməklər</div>
      @if (record()?.menu; as menu) {
        @for (m of menu; track m.id) {
          @let mm = macros(m);
          <div class="kv">
            <span>{{ m.done ? '✅' : '⬜' }} {{ m.time }} · {{ slotLabel(m) }} — {{ m.name }}</span>
            <b>{{ F.round(mm.k) }} kcal · {{ F.round(mm.p) }} q</b>
          </div>
        }
        <div class="kv">
          <span>Yeyilib / plan</span>
          <b>{{ F.round(eaten().k) }} / {{ F.round(plan().k) }} kcal · {{ F.round(eaten().p) }} / {{ F.round(plan().p) }} q P</b>
        </div>
      } @else {
        <div class="kv"><span>Yeməklər</span><b>{{ date() >= ui.today() ? 'Gün açılanda menyu yaradılacaq' : 'Məlumat yoxdur' }}</b></div>
      }

      <div class="section-title" style="margin-top: 14px">Məşq</div>
      @if (type() === 'training') {
        @for (x of logged(); track x.id) {
          <div class="kv"><span>{{ x.name }}</span><b>{{ x.sets }}</b></div>
        } @empty {
          <div class="kv"><span>Plan</span><b>FULL BODY {{ program.variant(date()) }} — qeyd yoxdur</b></div>
        }
      } @else {
        <div class="kv"><span>Zal</span><b>Yoxdur</b></div>
      }
      <div class="kv"><span>Kardio</span><b>{{ cardioText() }}</b></div>

      <div class="section-title" style="margin-top: 14px">Göstəricilər</div>
      <div class="kv"><span>Su</span><b>{{ F.liters(record()?.water ?? 0) }} / {{ F.liters(waterTarget()) }} L</b></div>
      <div class="kv"><span>Çəki</span><b>{{ weightText() }}</b></div>
      <div class="kv"><span>Yuxu</span><b>{{ F.dur(sleep()) }}</b></div>
      @if (store.settings().showCreatine) {
        <div class="kv"><span>Kreatin</span><b>{{ record()?.creatine ? '✓' : '—' }}</b></div>
      }
      <div class="kv"><span>Köp</span><b>{{ bloatText() }}</b></div>

      <div class="mt-[18px] flex justify-end gap-2">
        <button class="btn" (click)="close()">Bağla</button>
        <button class="btn btn-primary" (click)="open()">Bu günü aç</button>
      </div>
    </app-modal>
  `,
})
export class DayDetailDialog {
  readonly date = input.required<string>();

  protected readonly F = F;
  protected readonly macros = mealMacros;
  protected readonly ui = inject(UiService);
  protected readonly program = inject(ProgramService);
  protected readonly store = inject(StoreService);
  private readonly day = inject(DayService);
  private readonly workout = inject(WorkoutService);
  private readonly router = inject(Router);

  protected readonly record = computed(() => this.store.state().days[this.date()] ?? null);
  protected readonly type = computed(() => this.program.dayType(this.date()));
  protected readonly score = computed(() => this.day.score(this.date()));
  protected readonly plan = computed(() => menuTotals(this.record()?.menu));
  protected readonly eaten = computed(() => menuTotals(this.record()?.menu, true));
  protected readonly waterTarget = computed(() => this.day.waterTarget(this.date()));
  protected readonly sleep = computed(() => sleepMinutes(this.record()?.sleep));

  protected readonly logged = computed(() => {
    const h = this.store.state().history;
    return [...PROGRAM.A, ...PROGRAM.B]
      .map((id) => ({ id, e: (h[id] ?? []).find((x) => x.date === this.date()) }))
      .filter((x) => x.e)
      .map((x) => ({ id: x.id, name: EXERCISES[x.id].name, sets: this.workout.lastStr(x.e ?? null, EXERCISES[x.id]) }));
  });

  protected readonly cardioText = computed(() => {
    if (this.type() !== 'cardio') return '—';
    const c = this.record()?.cardio;
    if (!c?.done) return 'Plan: 20–30 dəq';
    return `✓ ${c.type === 'jog' ? 'Yüngül qaçış' : 'Sürətli yerimə'}${c.minutes ? ` · ${c.minutes} dəq` : ''}`;
  });

  protected readonly weightText = computed(() => {
    const w = this.store.state().weights.find((x) => x.date === this.date());
    return w ? `${F.kg(w.kg)} kq${w.waist ? ` · bel ${F.kg(w.waist)} sm` : ''}` : '—';
  });

  protected readonly bloatText = computed(
    () =>
      this.store
        .state()
        .bloat.filter((e) => e.date === this.date())
        .map((e) => `${e.level}/10`)
        .join(', ') || '—',
  );

  protected slotLabel(m: Meal): string {
    return SLOTS[m.slot]?.label ?? '';
  }

  protected close(): void {
    this.ui.detailDate.set(null);
  }

  protected open(): void {
    this.ui.viewDate.set(this.date());
    this.close();
    void this.router.navigateByUrl('/');
  }
}

