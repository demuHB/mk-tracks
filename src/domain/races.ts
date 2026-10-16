import {
  emptyDriverStats,
  type DriverStats,
  type OrphanStats,
  type Race,
  type RaceResult,
} from '../state/schema';

export interface NormalizedResult {
  driver: string;
  position: number;
  points: number | null;
}

export interface NormalizedRace {
  id: number;
  date: Date;
  results: NormalizedResult[];
}

export function toResult(value: RaceResult | number): RaceResult {
  if (typeof value === 'number') return { position: value, points: null };
  return { position: value.position, points: value.points ?? null };
}

export function raceDate(race: Race): Date {
  if (race.ts) {
    const d = new Date(race.ts);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(race.id);
}

export function formatRaceTimestamp(date: Date): string {
  return date.toLocaleString('de-DE', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Alle Rennen chronologisch aufsteigend (raceHistory selbst ist neueste zuerst). */
export function normalizeRaces(history: Race[]): NormalizedRace[] {
  return history
    .map((race) => ({
      id: race.id,
      date: raceDate(race),
      results: Object.entries(race.results).map(([driver, value]) => ({ driver, ...toResult(value) })),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id);
}

function addResult(stats: DriverStats, position: number, points: number | null): void {
  stats.races++;
  stats.positions.push(position);
  if (position === 1) stats.wins++;
  if (stats.bestPosition === null || position < stats.bestPosition) stats.bestPosition = position;
  if (stats.worstPosition === null || position > stats.worstPosition) stats.worstPosition = position;
  if (points !== null) addPoints(stats, points);
}

function addPoints(stats: DriverStats, points: number): void {
  stats.points.push(points);
  if (stats.bestPoints === null || points > stats.bestPoints) stats.bestPoints = points;
  if (stats.worstPoints === null || points < stats.worstPoints) stats.worstPoints = points;
}

/**
 * Berechnet driverStats im v1.8-Format. Reihenfolge wie recalculateAllDriverStats() der alten App:
 * Historie in gespeicherter Reihenfolge (neueste zuerst), danach Altdaten ohne Datum.
 */
export function computeDriverStats(
  drivers: string[],
  history: Race[],
  orphans: Record<string, OrphanStats> = {},
): Record<string, DriverStats> {
  const result: Record<string, DriverStats> = {};
  for (const driver of drivers) result[driver] = emptyDriverStats();
  for (const race of history) {
    for (const [driver, value] of Object.entries(race.results)) {
      result[driver] ??= emptyDriverStats();
      const { position, points } = toResult(value);
      addResult(result[driver], position, points);
    }
  }
  for (const [driver, orphan] of Object.entries(orphans)) {
    result[driver] ??= emptyDriverStats();
    const stats = result[driver];
    for (const position of orphan.positions) addResult(stats, position, null);
    for (const points of orphan.points) addPoints(stats, points);
  }
  return result;
}

/** Multimengen-Differenz: Werte aus `all`, die in `subset` nicht vorkommen. */
export function multisetDiff(all: number[], subset: number[]): number[] {
  const counts = new Map<number, number>();
  for (const v of subset) counts.set(v, (counts.get(v) ?? 0) + 1);
  const rest: number[] = [];
  for (const v of all) {
    const c = counts.get(v) ?? 0;
    if (c > 0) counts.set(v, c - 1);
    else rest.push(v);
  }
  return rest;
}
