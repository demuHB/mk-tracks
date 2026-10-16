import { computeDriverStats } from '../domain/races';
import { finalize } from './migrate';
import type { AppState } from './schema';
import { loadState, saveState } from './storage';

type Listener = (state: AppState) => void;

let state: AppState;
const listeners = new Set<Listener>();

export function initStore(initial: AppState = loadState()): AppState {
  state = initial;
  return state;
}

export function getState(): AppState {
  return state;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Führt eine Änderung aus, berechnet abgeleitete Daten neu (driverStats bleiben für die alte
 * Version aktuell), speichert und benachrichtigt die Views.
 */
export function update(mutate: (s: AppState) => void): boolean {
  mutate(state);
  state.driverStats = computeDriverStats(state.drivers, state.raceHistory, state.legacyOrphans);
  const ok = saveState(state);
  for (const l of listeners) l(state);
  return ok;
}

/** Rendert neu, ohne Daten zu ändern (z.B. reine Ansichts-Zustände). */
export function refresh(): void {
  for (const l of listeners) l(state);
}

/** Ersetzt den kompletten State (Import). */
export function replaceState(next: AppState): boolean {
  state = finalize(next);
  const ok = saveState(state);
  for (const l of listeners) l(state);
  return ok;
}
