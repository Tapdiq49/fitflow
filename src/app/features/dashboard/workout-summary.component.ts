import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ProgramService } from '../../core/services/program.service';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { WorkoutService } from '../../core/services/workout.service';
import { DateU, F, dayName } from '../../core/utils';
import { IconComponent } from '../../shared/icon.component';
import { TPipe } from '../../shared/t.pipe';
import { t } from '../../core/i18n/translate';

@Component({
  selector: 'app-workout-summary',
  imports: [IconComponent, TPipe],
  host: { class: 'card' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variant()) {
      <div class="card-head">
        <h3><app-icon name="dumbbell" /> {{ 'dash.todaysWorkoutN' | t: { a: workout.title(ui.viewDate()) } }}</h3>
        @if (log().savedAt) {
          <span class="badge badge-training"><app-icon name="check" size="sm" />{{ 'common.completed' | t }}</span>
        } @else {
          <button class="btn btn-primary btn-sm" (click)="start()">
            <app-icon name="play" size="sm" />{{ log().startedAt ? ('dash.continue' | t) : ('common.startWorkout' | t) }}
          </button>
        }
      </div>
      <div class="flex flex-col gap-2">
        @for (row of rows(); track row.id) {
          <div class="flex justify-between gap-2.5 rounded-[10px] bg-surface-2 px-3 py-[9px] text-[13px] [&_span:last-child]:text-right [&_span:last-child]:text-text-2">
            <span>{{ row.done ? '✓ ' : '' }}{{ row.name }} <span class="text-muted">{{ row.target }}</span></span>
            <span>{{ row.rec }}</span>
          </div>
        }
      </div>
      <p class="text-muted" style="margin: 12px 0 0; font-size: 12px">
        {{ workout.isTrainer() ? ('dash.numberOnRightLast' | t) : ('dash.numberOnRightWeight' | t) }}
      </p>
    } @else {
      <div class="card-head"><h3><app-icon name="dumbbell" /> {{ 'dash.todaysWorkout' | t }}</h3></div>
      <div class="empty">
        {{ 'dash.todayIsntGymDay' | t }}<br />{{ 'dash.nextWorkout' | t }} <b>{{ nextLabel() }}</b>
      </div>
    }
  `,
})
export class WorkoutSummaryComponent {
  protected readonly ui = inject(UiService);
  private readonly program = inject(ProgramService);
  protected readonly workout = inject(WorkoutService);
  private readonly store = inject(StoreService);
  private readonly router = inject(Router);

  protected readonly variant = computed(() => this.program.variant(this.ui.viewDate()));
  protected readonly log = computed(() => {
    this.store.state();
    return this.workout.get(this.ui.viewDate());
  });
  protected readonly rows = computed(() => {
    const v = this.variant();
    const k = this.ui.viewDate();
    if (!v) return [];
    return this.workout.exercises(k).map(({ id, ex }) => {
      const rec = this.workout.recommend(id, k);
      const trainer = this.workout.isTrainer();
      return {
        id,
        name: ex.name,
        done: this.log().ex[id]?.done ?? false,
        target: `${ex.sets}×${ex.min}–${ex.max}${ex.kind === 'time' ? t('common.s') : ''}`,
        rec: trainer ? this.workout.lastStr(rec.last, ex) : rec.w != null ? `${F.kg(rec.w)} kq` : ex.kind === 'time' ? '—' : 'yeni',
      };
    });
  });
  protected readonly nextLabel = computed(() => {
    const nt = this.program.nextTraining(this.ui.viewDate());
    return nt ? `${dayName(DateU.dow(nt) - 1)} — ${this.workout.title(nt)}` : '—';
  });

  protected start(): void {
    this.workout.start(this.ui.viewDate());
    void this.router.navigateByUrl('/workout');
  }
}
