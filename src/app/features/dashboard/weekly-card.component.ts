import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { weekScoreChart } from '../../core/charts';
import { DayService } from '../../core/services/day.service';
import { UiService } from '../../core/services/ui.service';
import { F } from '../../core/utils';
import { ChartComponent } from '../../shared/chart.component';
import { IconComponent } from '../../shared/icon.component';
import { TPipe } from '../../shared/t.pipe';

@Component({
  selector: 'app-weekly-card',
  imports: [IconComponent, ChartComponent, TPipe],
  host: { class: 'card' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card-head">
      <h3><app-icon name="trend" /> {{ 'dash.weeklyProgress' | t }}</h3>
      <span class="text-muted">{{ F.short(week()[0].k) }} – {{ F.short(week()[6].k) }}</span>
    </div>
    <div class="mb-3.5 grid grid-cols-3 gap-2.5 phone:grid-cols-2">
      <div class="sum-box"><span class="eyebrow">{{ 'common.gym' | t }}</span><b>{{ summary().workouts }} / 3</b><small>{{ 'dash.workout' | t }}</small></div>
      <div class="sum-box"><span class="eyebrow">{{ 'common.cardio' | t }}</span><b>{{ summary().cardio }} / 2</b><small>{{ 'dash.session' | t }}</small></div>
      <div class="sum-box">
        <span class="eyebrow">{{ 'dash.avgProtein' | t }}</span>
        <b>{{ summary().protein != null ? F.round(summary().protein!) + ' q' : '—' }}</b>
        <small>
          {{ 'dash.waterNSleepN' | t: { a: summary().water != null ? F.r1(summary().water! / 1000) + ' L' : '—', b: summary().sleep != null ? F.dur(F.round(summary().sleep!)) : '—' } }}
        </small>
      </div>
    </div>
    <app-chart [config]="chart()" [small]="true" />
  `,
})
export class WeeklyCardComponent {
  protected readonly F = F;
  private readonly day = inject(DayService);
  private readonly ui = inject(UiService);

  protected readonly week = computed(() => this.day.weekData(this.ui.viewDate()));
  protected readonly chart = computed(() => weekScoreChart(this.week(), this.ui.viewDate()));
  protected readonly summary = computed(() => {
    const w = this.week();
    const avg = (arr: (number | null)[]): number | null => {
      const v = arr.filter((x): x is number => x != null && x > 0);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    return {
      workouts: w.filter((x) => x.type === 'training' && x.workout).length,
      cardio: w.filter((x) => x.type === 'cardio' && x.cardio).length,
      protein: avg(w.map((x) => x.p)),
      water: avg(w.map((x) => x.water)),
      sleep: avg(w.map((x) => x.sleep)),
    };
  });
}
