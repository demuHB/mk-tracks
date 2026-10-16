import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js';

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
);

const SERIES_COUNT = 8;
const instances = new Set<Chart>();

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Feste Farbe je Fahrer (nach Position in der Fahrerliste, nicht nach Rang). */
export function driverColor(drivers: string[], driver: string): string {
  const i = drivers.indexOf(driver);
  if (i < 0 || i >= SERIES_COUNT) return cssVar('--muted');
  return cssVar(`--series-${i + 1}`);
}

const pendingMounts: (() => void)[] = [];

/** Callback, der nach dem Einhängen der View ins DOM läuft (Charts brauchen Größe). */
export function afterMount(fn: () => void): void {
  pendingMounts.push(fn);
}

export function runMounts(): void {
  for (const fn of pendingMounts.splice(0)) fn();
}

export function destroyCharts(): void {
  for (const c of instances) c.destroy();
  instances.clear();
}

export function createChart(canvas: HTMLCanvasElement, config: ChartConfiguration): Chart {
  const ink = cssVar('--text-2');
  const grid = cssVar('--grid');
  Chart.defaults.color = ink;
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.font.size = 12;
  Chart.defaults.borderColor = grid;
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.legend.labels.boxHeight = 10;
  Chart.defaults.plugins.legend.labels.useBorderRadius = true;
  Chart.defaults.plugins.legend.labels.borderRadius = 5;
  Chart.defaults.plugins.tooltip.backgroundColor = cssVar('--surface-3');
  Chart.defaults.plugins.tooltip.titleColor = cssVar('--text');
  Chart.defaults.plugins.tooltip.bodyColor = cssVar('--text');
  Chart.defaults.plugins.tooltip.borderColor = cssVar('--border');
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.boxPadding = 4;
  Chart.defaults.plugins.tooltip.usePointStyle = true;
  Chart.defaults.maintainAspectRatio = false;
  const chart = new Chart(canvas, config);
  instances.add(chart);
  return chart;
}
