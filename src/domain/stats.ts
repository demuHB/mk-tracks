import { MAX_POSITION, type OrphanStats } from '../state/schema';
import type { NormalizedRace } from './races';

export type Period = { kind: 'all' } | { kind: 'days'; days: number } | { kind: 'session'; key: string };

export interface DriverSummary {
  driver: string;
  races: number;
  wins: number;
  podiums: number;
  avgPosition: number | null;
  avgPoints: number | null;
  bestPosition: number | null;
  worstPosition: number | null;
  bestPoints: number | null;
  worstPoints: number | null;
  winRate: number | null;
  podiumRate: number | null;
}

export const winsLabel = (n: number) => (n === 1 ? '1 Sieg' : `${n} Siege`);

const avg = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Ein Spieleabend reicht bis 5 Uhr morgens des Folgetags. */
const SESSION_DAY_OFFSET_MS = 5 * 60 * 60 * 1000;

export function sessionKey(date: Date): string {
  const d = new Date(date.getTime() - SESSION_DAY_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatSessionKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function filterRaces(
  races: NormalizedRace[],
  period: Period,
  now: Date = new Date(),
): NormalizedRace[] {
  switch (period.kind) {
    case 'all':
      return races;
    case 'days': {
      const from = now.getTime() - period.days * 24 * 60 * 60 * 1000;
      return races.filter((r) => r.date.getTime() >= from);
    }
    case 'session':
      return races.filter((r) => sessionKey(r.date) === period.key);
  }
}

function collect(driver: string, races: NormalizedRace[], orphan?: OrphanStats) {
  const positions: number[] = [];
  const points: number[] = [];
  for (const race of races) {
    const r = race.results.find((x) => x.driver === driver);
    if (!r) continue;
    positions.push(r.position);
    if (r.points !== null) points.push(r.points);
  }
  if (orphan) {
    positions.push(...orphan.positions);
    points.push(...orphan.points);
  }
  return { positions, points };
}

export function summarizeDriver(
  driver: string,
  races: NormalizedRace[],
  orphan?: OrphanStats,
): DriverSummary {
  const { positions, points } = collect(driver, races, orphan);
  const n = positions.length;
  const wins = positions.filter((p) => p === 1).length;
  const podiums = positions.filter((p) => p <= 3).length;
  return {
    driver,
    races: n,
    wins,
    podiums,
    avgPosition: avg(positions),
    avgPoints: avg(points),
    bestPosition: n ? Math.min(...positions) : null,
    worstPosition: n ? Math.max(...positions) : null,
    bestPoints: points.length ? Math.max(...points) : null,
    worstPoints: points.length ? Math.min(...points) : null,
    winRate: n ? wins / n : null,
    podiumRate: n ? podiums / n : null,
  };
}

/** Rangliste wie in v1.8: zuerst Siege, dann bessere Ø-Platzierung. */
export function rankings(
  drivers: string[],
  races: NormalizedRace[],
  orphans: Record<string, OrphanStats> = {},
): DriverSummary[] {
  return drivers
    .map((d) => summarizeDriver(d, races, orphans[d]))
    .sort((a, b) => b.wins - a.wins || (a.avgPosition ?? 999) - (b.avgPosition ?? 999));
}

export interface FormPoint {
  /** Index des Rennens in `races` (gemeinsame x-Achse aller Fahrer). */
  index: number;
  raceNo: number;
  date: Date;
  position: number;
  rollingAvg: number;
}

/** Gleitender Durchschnitt der Platzierung über die letzten `window` Rennen des Fahrers. */
export function formCurve(races: NormalizedRace[], driver: string, window = 10): FormPoint[] {
  const out: FormPoint[] = [];
  const recent: number[] = [];
  races.forEach((race, index) => {
    const r = race.results.find((x) => x.driver === driver);
    if (!r) return;
    recent.push(r.position);
    if (recent.length > window) recent.shift();
    out.push({
      index,
      raceNo: out.length + 1,
      date: race.date,
      position: r.position,
      rollingAvg: avg(recent)!,
    });
  });
  return out;
}

/** Anzahl je Platzierung, Index 0 = Platz 1. */
export function positionDistribution(
  races: NormalizedRace[],
  driver: string,
  orphan?: OrphanStats,
): number[] {
  const counts = new Array<number>(MAX_POSITION).fill(0);
  for (const p of collect(driver, races, orphan).positions) {
    if (p >= 1 && p <= MAX_POSITION) counts[p - 1]++;
  }
  return counts;
}

export interface HeadToHead {
  wins: number;
  losses: number;
  ties: number;
}

/** h2h[a][b]: wie oft a vor b lag – nur Rennen, in denen beide gefahren sind. */
export function headToHead(
  races: NormalizedRace[],
  drivers: string[],
): Record<string, Record<string, HeadToHead>> {
  const out: Record<string, Record<string, HeadToHead>> = {};
  for (const a of drivers) {
    out[a] = {};
    for (const b of drivers) if (a !== b) out[a][b] = { wins: 0, losses: 0, ties: 0 };
  }
  for (const race of races) {
    for (const ra of race.results) {
      for (const rb of race.results) {
        if (ra.driver === rb.driver || !out[ra.driver]?.[rb.driver]) continue;
        const cell = out[ra.driver][rb.driver];
        if (ra.position < rb.position) cell.wins++;
        else if (ra.position > rb.position) cell.losses++;
        else cell.ties++;
      }
    }
  }
  return out;
}

export interface Session {
  key: string;
  races: NormalizedRace[];
  standings: DriverSummary[];
}

/** Rennen nach Spieleabend gruppiert, neuester Abend zuerst. */
export function sessions(races: NormalizedRace[], drivers: string[]): Session[] {
  const groups = new Map<string, NormalizedRace[]>();
  for (const race of races) {
    const key = sessionKey(race.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(race);
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, rs]) => {
      const participants = drivers.filter((d) => rs.some((r) => r.results.some((x) => x.driver === d)));
      return { key, races: rs, standings: rankings(participants, rs) };
    });
}

export interface RecordEntry {
  label: string;
  driver: string;
  value: string;
  detail?: string;
}

export function longestWinStreak(races: NormalizedRace[], driver: string): number {
  let best = 0;
  let current = 0;
  for (const race of races) {
    const r = race.results.find((x) => x.driver === driver);
    if (!r) continue;
    current = r.position === 1 ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

export function currentWinStreak(races: NormalizedRace[], driver: string): number {
  let streak = 0;
  for (let i = races.length - 1; i >= 0; i--) {
    const r = races[i].results.find((x) => x.driver === driver);
    if (!r) continue;
    if (r.position !== 1) break;
    streak++;
  }
  return streak;
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });

export function records(races: NormalizedRace[], drivers: string[]): RecordEntry[] {
  const out: RecordEntry[] = [];
  if (races.length === 0) return out;

  let streak = { driver: '', value: 0 };
  for (const d of drivers) {
    const s = longestWinStreak(races, d);
    if (s > streak.value) streak = { driver: d, value: s };
  }
  if (streak.value > 1) {
    out.push({ label: 'Längste Siegesserie', driver: streak.driver, value: `${streak.value} Siege` });
  }

  let topPoints: { driver: string; value: number; date: Date } | null = null;
  for (const race of races) {
    for (const r of race.results) {
      if (r.points !== null && (!topPoints || r.points > topPoints.value)) {
        topPoints = { driver: r.driver, value: r.points, date: race.date };
      }
    }
  }
  if (topPoints) {
    out.push({
      label: 'Meiste Punkte',
      driver: topPoints.driver,
      value: `${topPoints.value} Pkt.`,
      detail: fmtDate(topPoints.date),
    });
  }

  let bestSession: { driver: string; avg: number; key: string } | null = null;
  let mostWins: { driver: string; wins: number; key: string } | null = null;
  for (const s of sessions(races, drivers)) {
    for (const st of s.standings) {
      if (st.races >= 3 && st.avgPosition !== null && (!bestSession || st.avgPosition < bestSession.avg)) {
        bestSession = { driver: st.driver, avg: st.avgPosition, key: s.key };
      }
      if (st.wins > 0 && (!mostWins || st.wins > mostWins.wins)) {
        mostWins = { driver: st.driver, wins: st.wins, key: s.key };
      }
    }
  }
  if (mostWins) {
    out.push({
      label: 'Meiste Siege an einem Abend',
      driver: mostWins.driver,
      value: winsLabel(mostWins.wins),
      detail: formatSessionKey(mostWins.key),
    });
  }
  if (bestSession) {
    out.push({
      label: 'Bester Abend (Ø-Platz, ab 3 Rennen)',
      driver: bestSession.driver,
      value: `Ø ${bestSession.avg.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      detail: formatSessionKey(bestSession.key),
    });
  }
  return out;
}
