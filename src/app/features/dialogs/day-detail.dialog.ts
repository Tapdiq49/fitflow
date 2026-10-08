import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { SLOTS } from '../../core/data/meals';
import { Meal } from '../../common/interfaces';
import { mealMacros, menuTotals, sleepMinutes } from '../../core/nutrition';
import { DayService } from '../../core/services/day.service';
import { ProgramService } from '../../core/services/program.service';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { WorkoutService } from '../../core/services/workout.service';
import { F } from '../../core/utils';
import { ModalComponent } from '../../shared/modal/modal.component';
import { TypeBadgeComponent } from '../../shared/type-badge/type-badge.component';
import { TPipe, TdPipe } from '../../common/pipes/translate/t.pipe';
import { t, td } from '../../core/i18n/translate';

/** Calendar day details: meals, workout, cardio, water, weight, sleep. */
@Component({
  selector: 'app-day-detail-dialog',
  imports: [ModalComponent, TypeBadgeComponent, TPipe, TdPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [heading]="F.long(date())" (closed)="close()">
      <div class="flex flex-wrap items-center gap-2" style="margin-bottom: 12px">
        <app-type-badge [date]="date()" />
        @if (score() != null) {
          <span class="badge">{{ 'dayDetail.scoreN' | t: { a: score() } }}</span>
        }
      </div>

      <div class="section-title">{{ 'dayDetail.meals' | t }}</div>
      @if (record()?.menu; as menu) {
        @for (m of menu; track m.id) {
          @let mm = macros(m);
          <div class="kv">
            <span>{{ m.done ? '✅' : '⬜' }} {{ m.time }} · {{ slotLabel(m) }} — {{ m.name | td }}</span>
            <b>{{ 'dayDetail.nKcalNG' | t: { a: F.round(mm.k), b: F.round(mm.p) } }}</b>
          </div>
        }
        <div class="kv">
          <span>{{ 'dayDetail.eatenPerPlan' | t }}</span>
          <b>{{ 'dayDetail.nPerNKcal' | t: { a: F.round(eaten().k), b: F.round(plan().k), c: F.round(eaten().p), d: F.round(plan().p) } }}</b>
        </div>
      } @else {
        <div class="kv"><span>{{ 'dayDetail.meals' | t }}</span><b>{{ date() >= ui.today() ? ('dayDetail.menuWillCreatedWhen' | t) : ('common.noData' | t) }}</b></div>
      }

      <div class="section-title" style="margin-top: 14px">{{ 'dayDetail.workout' | t }}</div>
      @if (type() === 'training') {
        @for (x of logged(); track x.id) {
          <div class="kv"><span>{{ x.name }}</span><b>{{ x.sets }}</b></div>
        } @empty {
          <div class="kv"><span>{{ 'dayDetail.plan' | t }}</span><b>{{ 'dayDetail.nNoEntry' | t: { a: workout.title(date()) } }}</b></div>
        }
      } @else {
        <div class="kv"><span>{{ 'common.gym' | t }}</span><b>{{ 'dayDetail.none' | t }}</b></div>
      }
      <div class="kv"><span>{{ 'common.cardio' | t }}</span><b>{{ cardioText() }}</b></div>

      <div class="section-title" style="margin-top: 14px">{{ 'dayDetail.metrics' | t }}</div>
      <div class="kv"><span>{{ 'dayDetail.water' | t }}</span><b>{{ 'dayDetail.nPerNL' | t: { a: F.liters(record()?.water ?? 0), b: F.liters(waterTarget()) } }}</b></div>
      <div class="kv"><span>{{ 'common.weight' | t }}</span><b>{{ weightText() }}</b></div>
      <div class="kv"><span>{{ 'common.sleep' | t }}</span><b>{{ F.dur(sleep()) }}</b></div>
      @if (store.settings().showCreatine) {
        <div class="kv"><span>{{ 'dayDetail.creatine' | t }}</span><b>{{ record()?.creatine ? '✓' : '—' }}</b></div>
      }

      <div class="mt-[18px] flex justify-end gap-2">
        <button class="btn" (click)="close()">{{ 'common.close' | t }}</button>
        <button class="btn btn-primary" (click)="open()">{{ 'dayDetail.openThisDay' | t }}</button>
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
  protected readonly workout = inject(WorkoutService);
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
    return Object.keys(h)
      .map((id) => ({ id, e: h[id].find((x) => x.date === this.date()) }))
      .filter((x) => x.e)
      .map((x) => ({ id: x.id, name: this.workout.defOf(x.id).name, sets: this.workout.lastStr(x.e ?? null, this.workout.defOf(x.id)) }));
  });

  protected readonly cardioText = computed(() => {
    if (this.type() !== 'cardio') return '—';
    const c = this.record()?.cardio;
    if (!c?.done) return t('dayDetail.plan2030Min');
    return `✓ ${c.type === 'jog' ? t('dayDetail.easyJog') : t('dayDetail.briskWalk')}${c.minutes ? ` · ${c.minutes} ${t('dayDetail.min')}` : ''}`;
  });

  protected readonly weightText = computed(() => {
    const w = this.store.state().weights.find((x) => x.date === this.date());
    return w ? `${F.kg(w.kg)} ${t('common.kg')}${w.waist ? ` · ${t('common.waist').toLowerCase()} ${F.kg(w.waist)} ${t('common.cm')}` : ''}` : '—';
  });

  protected slotLabel(m: Meal): string {
    return td(SLOTS[m.slot]?.label ?? '');
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

