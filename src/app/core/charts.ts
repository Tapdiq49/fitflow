import { Chart, ChartConfiguration, ChartDataset, registerables } from 'chart.js';
import { WeekDay, WeightEntry } from './models';
import { AZ_DAYS_SHORT, DateU, rnd } from './utils';

Chart.register(...registerables);
Chart.defaults.color = '#8b98a8';
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.plugins.tooltip.backgroundColor = '#212c39';
Chart.defaults.plugins.tooltip.borderColor = '#33465c';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.legend.labels.boxWidth = 10;
Chart.defaults.plugins.legend.labels.boxHeight = 10;

export type AnyChartConfig = ChartConfiguration<'line'> | ChartConfiguration<'bar'>;

export const ACCENT = '#b6f23f';
export const MUTED = '#8b98a8';
export const WATER = '#38bdf8';

export function lineSeries(label: string, data: (number | null)[], color: string, dashed = false): ChartDataset<'line'> {
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: color,
    borderWidth: 2,
    borderDash: dashed ? [5, 4] : [],
    pointRadius: dashed ? 0 : 4,
    pointHoverRadius: 6,
    tension: 0.3,
  };
}

export function lineChart(labels: string[], datasets: ChartDataset<'line'>[], unit = ''): ChartConfiguration<'line'> {
  return {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: datasets.length > 1, position: 'top', align: 'end' } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { callback: (v) => `${v}${unit}` } },
      },
    },
  };
}

/** Weight line plus a dashed 7-day rolling average. */
export function weightChart(ws: WeightEntry[]): ChartConfiguration<'line'> | null {
  if (!ws.length) return null;
  const avg = ws.map((w) => {
    const r = ws.filter((x) => {
      const d = DateU.diffDays(x.date, w.date);
      return d >= 0 && d < 7;
    });
    return rnd(r.reduce((a, x) => a + x.kg, 0) / r.length, 2);
  });
  return lineChart(
    ws.map((w) => DateU.short(w.date)),
    [lineSeries('Çəki', ws.map((w) => w.kg), ACCENT), lineSeries('7 günlük orta', avg, MUTED, true)],
    ' kq',
  );
}

export function weekScoreChart(week: WeekDay[], selected: string): ChartConfiguration<'bar'> {
  return {
    type: 'bar',
    data: {
      labels: AZ_DAYS_SHORT,
      datasets: [
        {
          label: 'Günün skoru',
          data: week.map((x) => x.score),
          backgroundColor: week.map((x) => (x.k === selected ? ACCENT : 'rgba(182,242,63,.45)')),
          borderRadius: 4,
          maxBarThickness: 28,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => (c.raw == null ? 'Məlumat yoxdur' : `Skor: ${c.raw}%`) } },
      },
      scales: {
        y: { min: 0, max: 100, ticks: { callback: (v) => `${v}%` }, grid: { color: 'rgba(255,255,255,0.05)' } },
        x: { grid: { display: false } },
      },
    },
  };
}
