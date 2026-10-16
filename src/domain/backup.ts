import { isObject, migrate } from '../state/migrate';
import type { AppState } from '../state/schema';
import { normalizeRaces } from './races';

export interface BackupSummary {
  drivers: string[];
  races: number;
  sets: number;
  firstRace: Date | null;
  lastRace: Date | null;
}

export type BackupResult =
  { ok: true; state: AppState; summary: BackupSummary } | { ok: false; error: string };

export function exportFilename(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `mk-strecken-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.json`;
}

/** Export im selben JSON-Format wie v1.8 – auch in der alten Version importierbar. */
export function serializeBackup(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function summarize(state: AppState): BackupSummary {
  const races = normalizeRaces(state.raceHistory);
  return {
    drivers: state.drivers,
    races: races.length,
    sets: state.counter,
    firstRace: races[0]?.date ?? null,
    lastRace: races.at(-1)?.date ?? null,
  };
}

export function parseBackup(text: string): BackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Die Datei ist kein gültiges JSON.' };
  }
  if (!isObject(raw)) return { ok: false, error: 'Das scheint kein Backup dieser App zu sein.' };
  if (!Array.isArray(raw.drivers) || !raw.drivers.every((d) => typeof d === 'string')) {
    return { ok: false, error: 'Im Backup fehlt die Fahrerliste.' };
  }
  if (!isObject(raw.trackStats)) {
    return { ok: false, error: 'Im Backup fehlt die Strecken-Statistik.' };
  }
  if (raw.raceHistory !== undefined && !Array.isArray(raw.raceHistory)) {
    return { ok: false, error: 'Die Renn-Historie im Backup ist beschädigt.' };
  }
  const state = migrate(raw);
  return { ok: true, state, summary: summarize(state) };
}
