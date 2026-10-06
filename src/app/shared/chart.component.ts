import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterRenderEffect, inject, input, viewChild } from '@angular/core';
import { Chart, ChartConfiguration } from 'chart.js';
import { AnyChartConfig, applyChartTheme, resolveChartColors } from '../core/charts';
import { ThemeService } from '../core/services/theme.service';
import { TPipe } from './t.pipe';

/** Renders a Chart.js chart and rebuilds it whenever the config signal changes. */
@Component({
  selector: 'app-chart',
  imports: [TPipe],
  template: `
    <div class="relative" [class]="small() ? 'h-[160px]' : 'h-[220px]'">
      @if (config()) {
        <canvas #canvas></canvas>
      } @else {
        <div class="grid h-full place-items-center text-[13px] text-muted">{{ empty() ?? ('common.noData' | t) }}</div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartComponent {
  readonly config = input<AnyChartConfig | null>(null);
  readonly small = input(false);
  readonly empty = input<string | null>(null);

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly theme = inject(ThemeService);
  private chart: Chart | null = null;

  constructor() {
    afterRenderEffect(() => {
      const cfg = this.config();
      this.theme.resolved(); // rebuild with the new colors when the theme changes
      const el = this.canvas()?.nativeElement;
      this.chart?.destroy();
      if (cfg && el) applyChartTheme();
      this.chart = cfg && el ? new Chart(el, resolveChartColors(cfg) as ChartConfiguration) : null;
    });
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }
}
