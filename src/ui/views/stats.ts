import { normalizeRaces, type NormalizedRace } from '../../domain/races';
import {
  filterRaces,
  formatSessionKey,
  formCurve,
  headToHead,
  positionDistribution,
  rankings,
  records,
  sessions,
  type DriverSummary,
  type Period,
  winsLabel,
} from '../../domain/stats';
import { tracksByFrequency } from '../../domain/tracks';
import type { AppState } from '../../state/schema';
import { refresh } from '../../state/store';
import { afterMount, createChart, driverColor } from '../charts';
import { h, icon } from '../dom';

let period: Period = { kind: 'all' };

const fmt = (n: number | null, digits = 0) =>
  n === null
    ? '–'
    : n.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)} %`);
const shortDate = (d: Date) => d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });

function setPeriod(p: Period) {
  period = p;
  refresh();
}

function periodFilter(allSessions: string[]): HTMLElement {
  const chip = (label: string, p: Period, active: boolean) =>
    h(
      'button',
      {
        class: ['filter-chip', active && 'is-active'],
        'aria-pressed': String(active),
        onclick: () => setPeriod(p),
      },
      label,
    );
  const select = h(
    'select',
    {
      class: ['filter-select', period.kind === 'session' && 'is-active'],
      'aria-label': 'Spieleabend wählen',
      onchange: (e: Event) => {
        const key = (e.target as HTMLSelectElement).value;
        setPeriod(key ? { kind: 'session', key } : { kind: 'all' });
      },
    },
    h('option', { value: '' }, 'Abend…'),
    allSessions.map((key) =>
      h(
        'option',
        { value: key, selected: period.kind === 'session' && period.key === key },
        formatSessionKey(key),
      ),
    ),
  );
  return h(
    'div',
    { class: 'filter-row' },
    chip('Alle', { kind: 'all' }, period.kind === 'all'),
    chip('30 Tage', { kind: 'days', days: 30 }, period.kind === 'days'),
    allSessions.length > 0 && select,
  );
}

function rankingCard(state: AppState, s: DriverSummary, rank: number): HTMLElement {
  const kpi = (label: string, value: string) =>
    h(
      'div',
      { class: 'kpi' },
      h('div', { class: 'kpi-value' }, value),
      h('div', { class: 'kpi-label' }, label),
    );
  return h(
    'li',
    { class: ['card rank-card', rank === 1 && s.races > 0 && 'is-leader'] },
    h(
      'div',
      { class: 'card-head' },
      h(
        'span',
        { class: 'driver-title' },
        h('span', { class: 'rank-badge' }, `${rank}.`),
        h('span', { class: 'dot', style: { background: driverColor(state.drivers, s.driver) } }),
        s.driver,
      ),
      h('span', { class: 'muted small' }, `${s.races} Rennen`),
    ),
    h(
      'div',
      { class: 'kpi-grid' },
      kpi('Siege', String(s.wins)),
      kpi('Ø Platz', fmt(s.avgPosition, 2)),
      kpi('Ø Punkte', fmt(s.avgPoints, 1)),
      kpi('Siegquote', pct(s.winRate)),
    ),
    h(
      'div',
      { class: 'kpi-line' },
      h('span', null, `Podium ${pct(s.podiumRate)}`),
      h('span', null, `Platz ${s.bestPosition ?? '–'} – ${s.worstPosition ?? '–'}`),
      h('span', null, `Punkte ${s.worstPoints ?? '–'} – ${s.bestPoints ?? '–'}`),
    ),
  );
}

function chartCard(title: string, subtitle: string, height: number, build: (c: HTMLCanvasElement) => void) {
  const canvas = h('canvas', { role: 'img', 'aria-label': title });
  afterMount(() => build(canvas));
  return h(
    'section',
    { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', null, title)),
    h('p', { class: 'muted small chart-sub' }, subtitle),
    h('div', { class: 'chart-box', style: { height: `${height}px` } }, canvas),
  );
}

function formChart(state: AppState, races: NormalizedRace[], drivers: string[]) {
  const window = races.length >= 30 ? 10 : 5;
  return chartCard(
    'Formkurve',
    `Gleitender Ø-Platz der letzten ${window} Rennen – oben ist besser.`,
    260,
    (canvas) =>
      createChart(canvas, {
        type: 'line',
        data: {
          datasets: drivers.map((d) => ({
            label: d,
            data: formCurve(races, d, window).map((p) => ({ x: p.index + 1, y: p.rollingAvg })),
            borderColor: driverColor(state.drivers, d),
            backgroundColor: driverColor(state.drivers, d),
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.3,
          })),
        },
        options: {
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: {
              type: 'linear',
              min: 1,
              max: races.length,
              ticks: { precision: 0 },
              grid: { display: false },
              title: { display: true, text: 'Rennen' },
            },
            y: { reverse: true, min: 1, ticks: { precision: 0 }, title: { display: true, text: 'Ø Platz' } },
          },
          plugins: {
            tooltip: {
              callbacks: {
                title: (items) => {
                  const r = races[(items[0]?.parsed.x ?? 1) - 1];
                  return r ? `Rennen ${items[0].parsed.x} · ${shortDate(r.date)}` : '';
                },
                label: (item) => ` ${item.dataset.label}: Ø ${fmt(item.parsed.y, 2)}`,
              },
            },
          },
        },
      }),
  );
}

function distributionChart(state: AppState, races: NormalizedRace[], drivers: string[], useOrphans: boolean) {
  const dists = drivers.map((d) =>
    positionDistribution(races, d, useOrphans ? state.legacyOrphans?.[d] : undefined),
  );
  const maxPos = Math.max(12, ...dists.map((dist) => dist.findLastIndex((c) => c > 0) + 1));
  const labels = Array.from({ length: maxPos }, (_, i) => String(i + 1));
  return chartCard('Platzierungen', 'Anteil der Rennen je Platzierung.', 240, (canvas) =>
    createChart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: drivers.map((d, i) => {
          const total = dists[i].reduce((a, b) => a + b, 0) || 1;
          return {
            label: d,
            data: dists[i].slice(0, maxPos).map((c) => (c / total) * 100),
            backgroundColor: driverColor(state.drivers, d),
            borderRadius: { topLeft: 4, topRight: 4 },
            borderSkipped: 'bottom',
            categoryPercentage: 0.8,
            barPercentage: 0.9,
          };
        }),
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { display: false }, title: { display: true, text: 'Platz' } },
          y: { beginAtZero: true, ticks: { callback: (v) => `${v} %` } },
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) => `Platz ${items[0]?.label}`,
              label: (item) => {
                const count = dists[item.datasetIndex][item.dataIndex];
                return ` ${item.dataset.label}: ${Math.round(item.parsed.y ?? 0)} % (${count}×)`;
              },
            },
          },
        },
      },
    }),
  );
}

function headToHeadTable(races: NormalizedRace[], drivers: string[]): HTMLElement | null {
  if (drivers.length < 2) return null;
  const h2h = headToHead(races, drivers);
  return h(
    'section',
    { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', null, 'Head-to-Head')),
    h(
      'p',
      { class: 'muted small chart-sub' },
      'Zeile vor Spalte – nur Rennen, in denen beide gefahren sind.',
    ),
    h(
      'div',
      { class: 'table-scroll' },
      h(
        'table',
        { class: 'h2h' },
        h(
          'thead',
          null,
          h(
            'tr',
            null,
            h('th', null, ''),
            drivers.map((d) => h('th', { scope: 'col' }, d)),
          ),
        ),
        h(
          'tbody',
          null,
          drivers.map((a) =>
            h(
              'tr',
              null,
              h('th', { scope: 'row' }, a),
              drivers.map((b) => {
                if (a === b) return h('td', { class: 'h2h-self' }, '');
                const c = h2h[a][b];
                const total = c.wins + c.losses + c.ties;
                const lead = c.wins > c.losses ? 'is-ahead' : c.wins < c.losses ? 'is-behind' : '';
                return h(
                  'td',
                  { class: lead, title: `${a} vor ${b}: ${c.wins} von ${total}` },
                  total ? `${c.wins}–${c.losses}` : '–',
                  total ? h('span', { class: 'h2h-pct' }, `${Math.round((c.wins / total) * 100)} %`) : null,
                );
              }),
            ),
          ),
        ),
      ),
    ),
  );
}

function sessionsSection(state: AppState, races: NormalizedRace[], drivers: string[]): HTMLElement[] {
  const all = sessions(races, drivers);
  if (all.length === 0) return [];
  const out: HTMLElement[] = [];

  if (all.length >= 2) {
    const chrono = [...all].reverse().slice(-20);
    out.push(
      chartCard('Ø-Platz pro Abend', 'Die letzten Spieleabende – oben ist besser.', 240, (canvas) =>
        createChart(canvas, {
          type: 'line',
          data: {
            labels: chrono.map((s) => formatSessionKey(s.key)),
            datasets: drivers.map((d) => ({
              label: d,
              data: chrono.map((s) => s.standings.find((x) => x.driver === d)?.avgPosition ?? null),
              borderColor: driverColor(state.drivers, d),
              backgroundColor: driverColor(state.drivers, d),
              borderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
              spanGaps: true,
            })),
          },
          options: {
            interaction: { mode: 'index', intersect: false },
            scales: {
              x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 5 } },
              y: { reverse: true, min: 1, ticks: { precision: 0 } },
            },
            plugins: {
              tooltip: { callbacks: { label: (i) => ` ${i.dataset.label}: Ø ${fmt(i.parsed.y, 2)}` } },
            },
          },
        }),
      ),
    );
  }

  out.push(
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', null, 'Spieleabende')),
      h(
        'ul',
        { class: 'session-list' },
        all.slice(0, 10).map((s) => {
          const winner = s.standings[0];
          return h(
            'li',
            null,
            h(
              'button',
              { class: 'session-row', onclick: () => setPeriod({ kind: 'session', key: s.key }) },
              h(
                'span',
                { class: 'session-main' },
                h('span', { class: 'session-date' }, formatSessionKey(s.key)),
                h('span', { class: 'muted small' }, `${s.races.length} Rennen`),
              ),
              winner &&
                h(
                  'span',
                  { class: 'session-winner' },
                  icon('trophy'),
                  h('span', {
                    class: 'dot',
                    style: { background: driverColor(state.drivers, winner.driver) },
                  }),
                  winner.driver,
                  h(
                    'span',
                    { class: 'muted small' },
                    `${winsLabel(winner.wins)} · Ø ${fmt(winner.avgPosition, 1)}`,
                  ),
                ),
            ),
          );
        }),
      ),
    ),
  );
  return out;
}

function recordsSection(races: NormalizedRace[], drivers: string[]): HTMLElement | null {
  const list = records(races, drivers);
  if (list.length === 0) return null;
  return h(
    'section',
    { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', null, 'Rekorde')),
    h(
      'ul',
      { class: 'record-list' },
      list.map((r) =>
        h(
          'li',
          null,
          h('span', { class: 'record-label' }, r.label),
          h('span', { class: 'record-value' }, r.value),
          h('span', { class: 'muted small' }, r.detail ? `${r.driver} · ${r.detail}` : r.driver),
        ),
      ),
    ),
  );
}

function tracksChart(state: AppState): HTMLElement | null {
  const rows = tracksByFrequency(state).filter((r) => r.count > 0);
  if (rows.length === 0) return null;
  return chartCard(
    'Strecken-Häufigkeit',
    'Wie oft jede Strecke in einem Set war (alle Zeiträume).',
    Math.max(160, rows.length * 22 + 40),
    (canvas) =>
      createChart(canvas, {
        type: 'bar',
        data: {
          labels: rows.map((r) => r.track),
          datasets: [
            {
              label: 'Sets',
              data: rows.map((r) => r.count),
              backgroundColor: getComputedStyle(document.documentElement)
                .getPropertyValue('--series-1')
                .trim(),
              borderRadius: { topRight: 4, bottomRight: 4 },
              borderSkipped: 'left',
              barPercentage: 0.75,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          scales: {
            x: { beginAtZero: true, ticks: { precision: 0 }, position: 'top' },
            y: { grid: { display: false }, ticks: { autoSkip: false } },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (i) =>
                  ` ${i.parsed.x}× · Wahrscheinlichkeit ${Math.round(rows[i.dataIndex].probability * 100)} %`,
              },
            },
          },
        },
      }),
  );
}

export function renderStats(state: AppState): HTMLElement {
  const allRaces = normalizeRaces(state.raceHistory);
  const allSessionKeys = sessions(allRaces, state.drivers).map((s) => s.key);
  if (period.kind === 'session' && !allSessionKeys.includes(period.key)) period = { kind: 'all' };

  const races = filterRaces(allRaces, period);
  const useOrphans = period.kind === 'all';
  const orphans = useOrphans ? (state.legacyOrphans ?? {}) : {};
  const orphanCount = Object.values(orphans).reduce((a, o) => a + o.positions.length, 0);
  const ranking = rankings(state.drivers, races, orphans);
  const active = ranking.filter((r) => r.races > 0).map((r) => r.driver);
  // Reihenfolge der Fahrerliste für Charts/Tabellen (Farbe & Position bleiben stabil)
  const chartDrivers = state.drivers.filter((d) => active.includes(d));

  const content: (HTMLElement | null | false)[] = [];
  if (active.length === 0) {
    content.push(h('p', { class: 'empty' }, 'Für diesen Zeitraum gibt es noch keine Ergebnisse.'));
  } else {
    content.push(
      h(
        'ol',
        { class: 'rank-list' },
        ranking.filter((r) => r.races > 0).map((r, i) => rankingCard(state, r, i + 1)),
      ),
      orphanCount > 0 &&
        h(
          'p',
          { class: 'muted small note' },
          `Enthält ${orphanCount} ältere Ergebnisse ohne Datum aus früheren Versionen.`,
        ),
      races.length >= 2 && formChart(state, races, chartDrivers),
      distributionChart(state, races, chartDrivers, useOrphans),
      headToHeadTable(races, chartDrivers),
      ...(period.kind === 'session' ? [] : sessionsSection(state, races, chartDrivers)),
      recordsSection(races, chartDrivers),
    );
  }
  content.push(tracksChart(state));

  return h(
    'div',
    { class: 'view' },
    periodFilter(allSessionKeys),
    period.kind === 'session' &&
      h(
        'div',
        { class: 'section-head' },
        h('h2', null, formatSessionKey(period.key)),
        h(
          'button',
          { class: 'btn btn-sm btn-ghost', onclick: () => setPeriod({ kind: 'all' }) },
          'Alle anzeigen',
        ),
      ),
    content.filter((x): x is HTMLElement => Boolean(x)),
  );
}
