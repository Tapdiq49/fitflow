import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterRenderEffect, inject, input, viewChild } from '@angular/core';
import { Chart, ChartConfiguration } from 'chart.js';
import { AnyChartConfig } from '../core/charts';

/** Renders a Chart.js chart and rebuilds it whenever the config signal changes. */
@Component({
  selector: 'app-chart',
  template: `
    <div class="relative" [class]="small() ? 'h-[160px]' : 'h-[220px]'">
      @if (config()) {
        <canvas #canvas></canvas>
      } @else {
        <div class="grid h-full place-items-center text-[13px] text-muted">{{ empty() }}</div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartComponent {
  readonly config = input<AnyChartConfig | null>(null);
  readonly small = input(false);
  readonly empty = input('Məlumat yoxdur');

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private chart: Chart | null = null;

  constructor() {
    afterRenderEffect(() => {
      const cfg = this.config();
      const el = this.canvas()?.nativeElement;
      this.chart?.destroy();
      this.chart = cfg && el ? new Chart(el, cfg as ChartConfiguration) : null;
    });
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }
}
