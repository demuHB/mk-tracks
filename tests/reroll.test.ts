import { describe, expect, it } from 'vitest';
import { saveRaceFromDrafts } from '../src/domain/drivers';
import {
  applyManualSelection,
  generateSet,
  isSetUndoable,
  toggleSelection,
  undoCurrentSet,
} from '../src/domain/tracks';
import { migrate } from '../src/state/migrate';
import { legacyState } from './fixtures';

const state = () => migrate(legacyState());
const snapshot = (s: ReturnType<typeof state>) => ({
  probabilities: { ...s.probabilities },
  trackStats: { ...s.trackStats },
  counter: s.counter,
});

describe('Neu würfeln', () => {
  it('ersetzt ein ungespieltes Set ohne es mitzuzählen', () => {
    const s = state();
    const before = snapshot(s);
    generateSet(s);
    expect(isSetUndoable(s)).toBe(true);
    generateSet(s);
    const after = snapshot(s);
    // genau ein Set (8 Strecken) gezählt
    expect(after.counter).toBe(before.counter + 1);
    const added = Object.keys(after.trackStats).reduce(
      (n, t) => n + after.trackStats[t] - before.trackStats[t],
      0,
    );
    expect(added).toBe(8);
    for (const t of s.currentSet!.tracks) expect(after.probabilities[t]).toBe(before.probabilities[t] * 0.5);
  });

  it('stellt nach dem Rückgängigmachen den alten Stand exakt wieder her', () => {
    const s = state();
    const before = snapshot(s);
    generateSet(s);
    expect(undoCurrentSet(s)).toBe(true);
    expect(snapshot(s)).toEqual(before);
    expect(s.currentSet).toBeNull();
  });

  it('zählt ein Set, sobald ein Ergebnis gespeichert wurde', () => {
    const s = state();
    generateSet(s);
    s.currentDriverValues.Dennis = { position: '1', points: '120' };
    saveRaceFromDrafts(s, new Date(Date.now() + 1000));
    expect(s.currentSet?.played).toBe(true);
    const counter = s.counter;
    generateSet(s);
    expect(s.counter).toBe(counter + 1);
  });

  it('zählt ein Set, wenn die alte Version danach ein Rennen gespeichert hat', () => {
    const s = state();
    generateSet(s);
    s.raceHistory.unshift({
      id: Date.now() + 1000,
      timestamp: '',
      results: { Dennis: { position: 1, points: null } },
    });
    expect(isSetUndoable(s)).toBe(false);
  });

  it('macht nichts rückgängig, wenn inzwischen anders gelost wurde', () => {
    const s = state();
    generateSet(s);
    s.counter++; // z.B. Auslosung in der alten Version
    expect(isSetUndoable(s)).toBe(false);
  });

  it('manuelle Auswahl ersetzt ebenfalls ein ungespieltes Set', () => {
    const s = state();
    const before = snapshot(s);
    generateSet(s);
    s.selectedTracks = [];
    for (const t of s.tracks.slice(0, 8)) toggleSelection(s, t);
    applyManualSelection(s);
    expect(s.counter).toBe(before.counter + 1);
    for (const t of s.tracks.slice(0, 8)) expect(s.trackStats[t]).toBe(before.trackStats[t] + 1);
  });
});
