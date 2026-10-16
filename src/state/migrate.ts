import { computeDriverStats, multisetDiff } from '../domain/races';
import {
  createInitialState,
  DEFAULT_DRIVERS,
  INITIAL_TRACKS,
  SCHEMA_VERSION,
  type AppState,
  type DraftValues,
  type OrphanStats,
  type Race,
} from './schema';

export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const stringArray = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined;

const numberArray = (v: unknown): number[] =>
  Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)) : [];

function numberRecord(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObject(v)) return out;
  for (const [k, n] of Object.entries(v)) if (typeof n === 'number' && Number.isFinite(n)) out[k] = n;
  return out;
}

function normalizeHistory(v: unknown): Race[] {
  if (!Array.isArray(v)) return [];
  const races: Race[] = [];
  for (const raw of v) {
    if (!isObject(raw) || typeof raw.id !== 'number' || !isObject(raw.results)) continue;
    const results: Race['results'] = {};
    for (const [driver, value] of Object.entries(raw.results)) {
      if (typeof value === 'number') results[driver] = { position: value, points: null };
      else if (isObject(value) && typeof value.position === 'number') {
        results[driver] = {
          position: value.position,
          points: typeof value.points === 'number' ? value.points : null,
        };
      }
    }
    if (Object.keys(results).length === 0) continue;
    races.push({
      ...raw,
      id: raw.id,
      timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : '',
      results,
      ts: typeof raw.ts === 'string' ? raw.ts : new Date(raw.id).toISOString(),
    });
  }
  return races;
}

/**
 * Ermittelt Ergebnisse, die nur in den gespeicherten driverStats stehen, aber nicht in der
 * raceHistory (z.B. aus Versionen vor der Historie). Sie gingen sonst bei der Neuberechnung verloren.
 */
function findOrphans(drivers: string[], storedStats: unknown, history: Race[]): Record<string, OrphanStats> {
  const orphans: Record<string, OrphanStats> = {};
  if (!isObject(storedStats)) return orphans;
  const fromHistory = computeDriverStats(drivers, history);
  for (const driver of drivers) {
    const stored = storedStats[driver];
    if (!isObject(stored)) continue;
    const positions = multisetDiff(numberArray(stored.positions), fromHistory[driver].positions);
    const points = multisetDiff(numberArray(stored.points), fromHistory[driver].points);
    if (positions.length > 0 || points.length > 0) orphans[driver] = { positions, points };
  }
  return orphans;
}

function normalizeOrphans(v: unknown): Record<string, OrphanStats> {
  const out: Record<string, OrphanStats> = {};
  if (!isObject(v)) return out;
  for (const [driver, o] of Object.entries(v)) {
    if (isObject(o)) out[driver] = { positions: numberArray(o.positions), points: numberArray(o.points) };
  }
  return out;
}

/** Wandelt beliebige gespeicherte Daten (v1.x oder v2) in einen gültigen v2-State um. */
export function migrate(raw: unknown): AppState {
  if (!isObject(raw)) return finalize(createInitialState());

  // Unbekannte Felder bleiben erhalten (vorwärtskompatibel, wie loadState() in v1.8).
  const state = { ...createInitialState(), ...raw } as AppState;

  state.drivers = stringArray(raw.drivers) ?? [...DEFAULT_DRIVERS];
  state.customTracks = stringArray(raw.customTracks) ?? [];
  state.selectedTracks = stringArray(raw.selectedTracks) ?? [];
  state.probabilities = numberRecord(raw.probabilities);
  state.trackStats = numberRecord(raw.trackStats);
  state.counter = typeof raw.counter === 'number' ? raw.counter : 0;
  state.raceHistory = normalizeHistory(raw.raceHistory);
  state.currentDriverValues = {};
  if (isObject(raw.currentDriverValues)) {
    for (const [driver, d] of Object.entries(raw.currentDriverValues)) {
      if (isObject(d)) {
        state.currentDriverValues[driver] = {
          position: d.position == null ? '' : String(d.position),
          points: d.points == null ? '' : String(d.points),
        } satisfies DraftValues;
      }
    }
  }

  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1;
  if (version < 2) {
    state.legacyOrphans = findOrphans(state.drivers, raw.driverStats, state.raceHistory);
  } else {
    state.legacyOrphans = normalizeOrphans(raw.legacyOrphans);
    // Wurde die Statistik eines Fahrers in der alten Version zurückgesetzt, Altdaten verwerfen.
    if (isObject(raw.driverStats)) {
      for (const driver of Object.keys(state.legacyOrphans)) {
        const stored = raw.driverStats[driver];
        if (!isObject(stored) || stored.races === 0) delete state.legacyOrphans[driver];
      }
    }
  }

  return finalize(state);
}

/** Ergänzt fehlende Strecken/Fahrer-Einträge und berechnet driverStats neu. */
export function finalize(state: AppState): AppState {
  const allTracks = [...INITIAL_TRACKS];
  for (const t of state.customTracks) if (!allTracks.includes(t)) allTracks.push(t);
  state.tracks = allTracks;
  for (const track of allTracks) {
    if (typeof state.probabilities[track] !== 'number') state.probabilities[track] = 1.0;
    if (typeof state.trackStats[track] !== 'number') state.trackStats[track] = 0;
  }
  state.selectedTracks = state.selectedTracks.filter((t) => allTracks.includes(t));

  for (const driver of state.drivers) {
    state.currentDriverValues[driver] ??= { position: '', points: '' };
  }
  state.legacyOrphans ??= {};
  for (const driver of Object.keys(state.legacyOrphans)) {
    if (!state.drivers.includes(driver)) delete state.legacyOrphans[driver];
  }
  state.driverStats = computeDriverStats(state.drivers, state.raceHistory, state.legacyOrphans);
  state.currentSet ??= null;
  state.settings = { theme: 'dark', ...(state.settings ?? {}) };
  state.schemaVersion = SCHEMA_VERSION;
  return state;
}
