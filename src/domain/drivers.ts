import {
  MAX_POINTS,
  MAX_POSITION,
  MIN_POINTS,
  MIN_POSITION,
  type AppState,
  type Race,
  type RaceResult,
} from '../state/schema';
import { formatRaceTimestamp, toResult } from './races';
import { markSetPlayed } from './tracks';

export function isValidPosition(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_POSITION && n <= MAX_POSITION;
}

export function isValidPoints(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_POINTS && n <= MAX_POINTS;
}

/** Speichert die Entwürfe aller Fahrer als neues Rennen. Gibt null zurück, wenn nichts eingetragen ist. */
export function saveRaceFromDrafts(state: AppState, now: Date = new Date()): Race | null {
  const results: Record<string, RaceResult> = {};
  for (const driver of state.drivers) {
    const draft = state.currentDriverValues[driver];
    const position = parseInt(draft?.position ?? '', 10);
    if (!isValidPosition(position)) continue;
    const points = parseInt(draft?.points ?? '', 10);
    results[driver] = { position, points: isValidPoints(points) ? points : null };
  }
  if (Object.keys(results).length === 0) return null;
  const race: Race = {
    id: now.getTime(),
    timestamp: formatRaceTimestamp(now),
    results,
    ts: now.toISOString(),
  };
  state.raceHistory.unshift(race);
  markSetPlayed(state);
  for (const driver of state.drivers) state.currentDriverValues[driver] = { position: '', points: '' };
  return race;
}

export function updateRaceResult(
  state: AppState,
  raceId: number,
  driver: string,
  field: 'position' | 'points',
  value: number | null,
): void {
  const race = state.raceHistory.find((r) => r.id === raceId);
  if (!race || !(driver in race.results)) return;
  const result = toResult(race.results[driver]);
  if (field === 'position') {
    if (value === null) return; // Platzierung ist Pflicht
    result.position = value;
  } else {
    result.points = value;
  }
  race.results[driver] = result;
}

export function deleteRace(state: AppState, raceId: number): void {
  state.raceHistory = state.raceHistory.filter((r) => r.id !== raceId);
}

export function addDriver(state: AppState, name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Bitte einen Namen eingeben.';
  if (state.drivers.includes(trimmed)) return 'Dieser Fahrer existiert bereits.';
  state.drivers.push(trimmed);
  state.currentDriverValues[trimmed] = { position: '', points: '' };
  return null;
}

/** Entfernt Fahrer inklusive aller Ergebnisse (wie confirmDeleteDriver() in v1.8). */
export function removeDriver(state: AppState, name: string): void {
  state.drivers = state.drivers.filter((d) => d !== name);
  delete state.driverStats[name];
  delete state.currentDriverValues[name];
  delete state.legacyOrphans?.[name];
  for (const race of state.raceHistory) delete race.results[name];
  state.raceHistory = state.raceHistory.filter((r) => Object.keys(r.results).length > 0);
}

/** Löscht alle Ergebnisse der Fahrer, Fahrer bleiben bestehen (wie confirmResetStatsFromModal()). */
export function resetDriverStats(state: AppState, drivers: string[]): void {
  for (const driver of drivers) {
    delete state.legacyOrphans?.[driver];
    for (const race of state.raceHistory) delete race.results[driver];
  }
  state.raceHistory = state.raceHistory.filter((r) => Object.keys(r.results).length > 0);
}
