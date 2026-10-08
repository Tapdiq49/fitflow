import { Chart, ChartConfiguration, ChartDataset, registerables } from 'chart.js';
import { WeekDay, WeightEntry } from '../common/interfaces';
import { DateU, rnd, weekdaysShort } from './utils';
import { t } from './i18n/translate';

Chart.register(...registerables);
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.legend.labels.boxWidth = 10;
Chart.defaults.plugins.legend.labels.boxHeight = 10;

export type AnyChartConfig = ChartConfiguration<'line'> | ChartConfiguration<'bar'>;

/** Series colors are CSS variables; ChartComponent resolves them for the active theme (canvas can't read var()). */
export const ACCENT = 'var(--accent)';
export const MUTED = 'var(--muted)';
export const WATER = 'var(--water)';

const cssVar = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Points Chart.js defaults at the active theme's colors; call before creating a chart. */
export function applyChartTheme(): void {
  Chart.defaults.color = cssVar('--muted');
  Chart.defaults.borderColor = cssVar('--chart-grid');
  Chart.defaults.plugins.tooltip.backgroundColor = cssVar('--surface-3');
  Chart.defaults.plugins.tooltip.borderColor = cssVar('--border-strong');
  Chart.defaults.plugins.tooltip.titleColor = cssVar('--text');
  Chart.defaults.plugins.tooltip.bodyColor = cssVar('--text-2');
}

/** Deep copy of a chart config with every "var(--x)" string replaced by its current value. */
export function resolveChartColors<T>(value: T): T {
  if (typeof value === 'string') return (/^var\((--[\w-]+)\)$/.exec(value) ? cssVar(value.slice(4, -1)) : value) as T;
  if (Array.isArray(value)) return value.map((v) => resolveChartColors(v)) as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveChartColors(v)])) as T;
  }
  return value;
}

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
        y: { grid: { color: 'var(--chart-grid)' }, ticks: { callback: (v) => `${v}${unit}` } },
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
    [lineSeries(t('common.weight'), ws.map((w) => w.kg), ACCENT), lineSeries(t('chart.7DayAverage'), avg, MUTED, true)],
    ` ${t('common.kg')}`,
  );
}

export function weekScoreChart(week: WeekDay[], selected: string): ChartConfiguration<'bar'> {
  return {
    type: 'bar',
    data: {
      labels: weekdaysShort(),
      datasets: [
        {
          label: t('chart.dailyScore'),
          data: week.map((x) => x.score),
          backgroundColor: week.map((x) => (x.k === selected ? ACCENT : 'var(--chart-accent-dim)')),
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
        tooltip: { callbacks: { label: (c) => (c.raw == null ? t('common.noData') : t('chart.scoreN', { v: c.raw as number })) } },
      },
      scales: {
        y: { min: 0, max: 100, ticks: { callback: (v) => `${v}%` }, grid: { color: 'var(--chart-grid)' } },
        x: { grid: { display: false } },
      },
    },
  };
}
