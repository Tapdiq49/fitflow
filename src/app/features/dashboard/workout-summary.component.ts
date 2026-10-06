import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { EXERCISES, PROGRAM } from '../../core/data/program';
import { ProgramService } from '../../core/services/program.service';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { WorkoutService } from '../../core/services/workout.service';
import { AZ_DAYS, DateU, F } from '../../core/utils';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-workout-summary',
  imports: [IconComponent],
  host: { class: 'card' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variant(); as v) {
      <div class="card-head">
        <h3><app-icon name="dumbbell" /> Today's Workout — FULL BODY {{ v }}</h3>
        @if (log().savedAt) {
          <span class="badge badge-training"><app-icon name="check" size="sm" />Tamamlandı</span>
        } @else {
          <button class="btn btn-primary btn-sm" (click)="start()">
            <app-icon name="play" size="sm" />{{ log().startedAt ? 'Davam et' : 'Start workout' }}
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
      <p class="text-muted" style="margin: 12px 0 0; font-size: 12px">Sağdakı rəqəm — progressive overload-a görə tövsiyə olunan çəki.</p>
    } @else {
      <div class="card-head"><h3><app-icon name="dumbbell" /> Today's Workout</h3></div>
      <div class="empty">
        Bu gün zal günü deyil.<br />Növbəti məşq: <b>{{ nextLabel() }}</b>
      </div>
    }
  `,
})
export class WorkoutSummaryComponent {
  private readonly ui = inject(UiService);
  private readonly program = inject(ProgramService);
  private readonly workout = inject(WorkoutService);
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
    return PROGRAM[v].map((id) => {
      const ex = EXERCISES[id];
      const rec = this.workout.recommend(id, k);
      return {
        id,
        name: ex.name,
        done: this.log().ex[id]?.done ?? false,
        target: `${ex.sets}×${ex.min}–${ex.max}${ex.kind === 'time' ? 's' : ''}`,
        rec: rec.w != null ? `${F.kg(rec.w)} kq` : ex.kind === 'time' ? '—' : 'yeni',
      };
    });
  });
  protected readonly nextLabel = computed(() => {
    const nt = this.program.nextTraining(this.ui.viewDate());
    return nt ? `${AZ_DAYS[DateU.dow(nt) - 1]} — FULL BODY ${this.program.variant(nt)}` : '—';
  });

  protected start(): void {
    this.workout.start(this.ui.viewDate());
    void this.router.navigateByUrl('/workout');
  }
}
