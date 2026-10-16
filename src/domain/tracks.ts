import { SET_SIZE, type AppState, type CurrentSet } from '../state/schema';

export type RandomFn = () => number;

export function weightedRandomSelect<T>(items: T[], weights: number[], random: RandomFn = Math.random): T {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let r = random() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function shuffle<T>(items: T[], random: RandomFn = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Übernimmt ein Set: Wahrscheinlichkeit halbieren, Häufigkeit zählen, Set-Zähler erhöhen. */
function applySet(state: AppState, tracks: string[], random: RandomFn): CurrentSet {
  const before: Record<string, number> = {};
  for (const t of tracks) before[t] = state.probabilities[t] ?? 1;
  for (const t of tracks) {
    state.probabilities[t] = (state.probabilities[t] ?? 1) * 0.5;
    state.trackStats[t] = (state.trackStats[t] ?? 0) + 1;
  }
  state.counter++;
  const set: CurrentSet = {
    tracks: shuffle(tracks, random),
    probabilities: before,
    createdAt: new Date().toISOString(),
  };
  state.currentSet = set;
  return set;
}

/** Lost 8 verschiedene Strecken gewichtet nach Wahrscheinlichkeit aus (wie generateRaces() in v1.8). */
export function generateSet(state: AppState, random: RandomFn = Math.random): CurrentSet {
  const picked: string[] = [];
  let available = [...state.tracks];
  while (picked.length < SET_SIZE && available.length > 0) {
    const weights = available.map((t) => Math.max(0.001, state.probabilities[t] ?? 1));
    const track = weightedRandomSelect(available, weights, random);
    picked.push(track);
    available = available.filter((t) => t !== track);
  }
  return applySet(state, picked, random);
}

/** Übernimmt die manuell gewählten Strecken als Set. */
export function applyManualSelection(state: AppState, random: RandomFn = Math.random): CurrentSet {
  const set = applySet(state, [...state.selectedTracks], random);
  state.selectedTracks = [];
  return set;
}

export function toggleSelection(state: AppState, track: string): void {
  const i = state.selectedTracks.indexOf(track);
  if (i > -1) state.selectedTracks.splice(i, 1);
  else if (state.selectedTracks.length < SET_SIZE) state.selectedTracks.push(track);
}

export function resetProbabilities(state: AppState): void {
  for (const t of state.tracks) state.probabilities[t] = 1.0;
  state.counter = 0;
  state.currentSet = null;
}

export function resetTrackStats(state: AppState): void {
  for (const t of state.tracks) {
    state.trackStats[t] = 0;
    state.probabilities[t] = 1.0;
  }
  state.counter = 0;
  state.currentSet = null;
}

export function addTrack(state: AppState, name: string): string | null {
  const trackName = name.trim();
  if (!trackName) return 'Bitte einen Streckennamen eingeben.';
  if (state.tracks.includes(trackName)) return 'Diese Strecke existiert bereits.';
  state.customTracks.push(trackName);
  state.tracks.push(trackName);
  state.probabilities[trackName] = 1.0;
  state.trackStats[trackName] = 0;
  return null;
}

export function removeTrack(state: AppState, name: string): void {
  state.customTracks = state.customTracks.filter((t) => t !== name);
  state.tracks = state.tracks.filter((t) => t !== name);
  state.selectedTracks = state.selectedTracks.filter((t) => t !== name);
  delete state.probabilities[name];
  delete state.trackStats[name];
}

export function formatProbability(prob: number): string {
  return Math.round(prob * 100) + '%';
}

/** Strecken sortiert nach Häufigkeit (absteigend), wie die Liste in v1.8. */
export function tracksByFrequency(state: AppState): { track: string; count: number; probability: number }[] {
  return state.tracks
    .map((track) => ({
      track,
      count: state.trackStats[track] ?? 0,
      probability: state.probabilities[track] ?? 1,
    }))
    .sort((a, b) => b.count - a.count);
}
