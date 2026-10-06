import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { weekScoreChart } from '../../core/charts';
import { DayService } from '../../core/services/day.service';
import { UiService } from '../../core/services/ui.service';
import { F } from '../../core/utils';
import { ChartComponent } from '../../shared/chart.component';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-weekly-card',
  imports: [IconComponent, ChartComponent],
  host: { class: 'card' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card-head">
      <h3><app-icon name="trend" /> Weekly Progress</h3>
      <span class="text-muted">{{ F.short(week()[0].k) }} – {{ F.short(week()[6].k) }}</span>
    </div>
    <div class="mb-3.5 grid grid-cols-3 gap-2.5 phone:grid-cols-2">
      <div class="sum-box"><span class="eyebrow">Zal</span><b>{{ summary().workouts }} / 3</b><small>məşq</small></div>
      <div class="sum-box"><span class="eyebrow">Kardio</span><b>{{ summary().cardio }} / 2</b><small>sessiya</small></div>
      <div class="sum-box">
        <span class="eyebrow">Ort. protein</span>
        <b>{{ summary().protein != null ? F.round(summary().protein!) + ' q' : '—' }}</b>
        <small>
          su {{ summary().water != null ? F.r1(summary().water! / 1000) + ' L' : '—' }} · yuxu
          {{ summary().sleep != null ? F.dur(F.round(summary().sleep!)) : '—' }}
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
