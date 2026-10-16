import { describe, expect, it } from 'vitest';
import { parseBackup, serializeBackup } from '../src/domain/backup';
import {
  addDriver,
  deleteRace,
  removeDriver,
  resetDriverStats,
  saveRaceFromDrafts,
  updateRaceResult,
} from '../src/domain/drivers';
import { normalizeRaces } from '../src/domain/races';
import {
  filterRaces,
  formCurve,
  headToHead,
  longestWinStreak,
  positionDistribution,
  rankings,
  records,
  sessionKey,
  sessions,
} from '../src/domain/stats';
import { applyManualSelection, generateSet, toggleSelection } from '../src/domain/tracks';
import { migrate } from '../src/state/migrate';
import { legacyState } from './fixtures';

const state = () => migrate(legacyState());

describe('Streckenauswahl', () => {
  it('lost 8 verschiedene Strecken, halbiert deren Wahrscheinlichkeit und zählt', () => {
    const s = state();
    const before = { ...s.probabilities };
    const statsBefore = { ...s.trackStats };
    const set = generateSet(s);
    expect(set.tracks).toHaveLength(8);
    expect(new Set(set.tracks).size).toBe(8);
    expect(s.counter).toBe(4);
    for (const t of set.tracks) {
      expect(set.probabilities[t]).toBe(before[t]);
      expect(s.probabilities[t]).toBe(before[t] * 0.5);
      expect(s.trackStats[t]).toBe(statsBefore[t] + 1);
    }
    expect(s.currentSet).toBe(set);
  });

  it('manuelle Auswahl: max. 8 und Übernahme als Set', () => {
    const s = state();
    s.selectedTracks = [];
    for (const t of s.tracks.slice(0, 10)) toggleSelection(s, t);
    expect(s.selectedTracks).toHaveLength(8);
    const set = applyManualSelection(s);
    expect(set.tracks.sort()).toEqual(s.tracks.slice(0, 8).sort());
    expect(s.selectedTracks).toEqual([]);
  });
});

describe('Rennen & Fahrer', () => {
  it('speichert Entwürfe als Rennen und leert sie', () => {
    const s = state();
    s.currentDriverValues.Dennis = { position: '2', points: '99' };
    s.currentDriverValues.Monika = { position: '', points: '50' };
    const race = saveRaceFromDrafts(s, new Date('2026-06-14T20:00:00'))!;
    expect(race.results).toEqual({ Dennis: { position: 2, points: 99 } });
    expect(s.raceHistory[0]).toBe(race);
    expect(s.currentDriverValues.Dennis).toEqual({ position: '', points: '' });
  });

  it('gibt null zurück, wenn keine Platzierung eingetragen ist', () => {
    const s = state();
    s.currentDriverValues.Dennis = { position: '', points: '' };
    expect(saveRaceFromDrafts(s)).toBeNull();
  });

  it('bearbeitet und löscht Rennen', () => {
    const s = state();
    const id = s.raceHistory[0].id;
    updateRaceResult(s, id, 'Volker', 'points', 33);
    expect(s.raceHistory[0].results.Volker).toEqual({ position: 5, points: 33 });
    deleteRace(s, id);
    expect(s.raceHistory.find((r) => r.id === id)).toBeUndefined();
  });

  it('Fahrer hinzufügen, zurücksetzen, entfernen', () => {
    const s = state();
    expect(addDriver(s, ' Luigi ')).toBeNull();
    expect(addDriver(s, 'Luigi')).toMatch(/existiert/);
    resetDriverStats(s, ['Volker']);
    expect(s.raceHistory.every((r) => !('Volker' in r.results))).toBe(true);
    expect(s.legacyOrphans?.Volker).toBeUndefined();
    removeDriver(s, 'Monika');
    expect(s.drivers).toEqual(['Dennis', 'Volker', 'Luigi']);
  });
});

describe('Statistiken', () => {
  const races = normalizeRaces(state().raceHistory);
  const drivers = ['Dennis', 'Monika', 'Volker'];

  it('sortiert Rennen chronologisch', () => {
    expect(races.map((r) => r.date.getTime())).toEqual([...races.map((r) => r.date.getTime())].sort());
  });

  it('Rangliste: Siege, dann Ø-Platz – inkl. Altdaten', () => {
    const s = state();
    const r = rankings(drivers, races, s.legacyOrphans);
    expect(r.map((x) => x.driver)).toEqual(['Dennis', 'Monika', 'Volker']);
    const volker = r[2];
    expect(volker.races).toBe(4);
    expect(volker.wins).toBe(1);
    expect(volker.avgPosition).toBeCloseTo((5 + 1 + 7 + 12) / 4);
    const dennis = r[0];
    expect(dennis.wins).toBe(2);
    expect(dennis.podiums).toBe(4);
    expect(dennis.avgPoints).toBeCloseTo((90 + 110 + 105) / 3);
  });

  it('Formkurve mit gleitendem Durchschnitt', () => {
    const curve = formCurve(races, 'Dennis', 2);
    expect(curve.map((p) => p.position)).toEqual([3, 1, 1, 2]);
    expect(curve.map((p) => p.rollingAvg)).toEqual([3, 2, 1, 1.5]);
  });

  it('Platzierungsverteilung', () => {
    const dist = positionDistribution(races, 'Monika');
    expect(dist.slice(0, 4)).toEqual([1, 1, 1, 1]);
    expect(dist).toHaveLength(24);
  });

  it('Head-to-Head nur über gemeinsame Rennen', () => {
    const h = headToHead(races, drivers);
    expect(h.Dennis.Monika).toEqual({ wins: 2, losses: 2, ties: 0 });
    expect(h.Dennis.Volker).toEqual({ wins: 1, losses: 1, ties: 0 });
    expect(h.Volker.Dennis).toEqual({ wins: 1, losses: 1, ties: 0 });
  });

  it('Spieleabende gehen bis 5 Uhr morgens', () => {
    expect(sessionKey(new Date('2026-06-13T02:00:00'))).toBe('2026-06-12');
    expect(sessionKey(new Date('2026-06-13T06:00:00'))).toBe('2026-06-13');
    const ss = sessions(races, drivers);
    expect(ss).toHaveLength(1);
    expect(ss[0].standings[0].driver).toBe('Dennis');
  });

  it('Zeitraum-Filter', () => {
    const now = new Date('2026-06-20T12:00:00');
    expect(filterRaces(races, { kind: 'days', days: 10 }, now)).toHaveLength(4);
    expect(filterRaces(races, { kind: 'days', days: 1 }, now)).toHaveLength(0);
    expect(filterRaces(races, { kind: 'session', key: '2026-06-12' })).toHaveLength(4);
  });

  it('Rekorde & Serien', () => {
    expect(longestWinStreak(races, 'Dennis')).toBe(2);
    const rec = records(races, drivers);
    expect(rec.find((r) => r.label === 'Längste Siegesserie')?.driver).toBe('Dennis');
    expect(rec.find((r) => r.label === 'Meiste Punkte')?.value).toBe('110 Pkt.');
  });
});

describe('Backup', () => {
  it('Round-Trip Export → Import', () => {
    const s = state();
    const res = parseBackup(serializeBackup(s));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state).toEqual(s);
      expect(res.summary.races).toBe(4);
    }
  });

  it('importiert v1.8-Backups', () => {
    const res = parseBackup(JSON.stringify(legacyState()));
    expect(res.ok).toBe(true);
  });

  it('lehnt ungültige Dateien ab', () => {
    expect(parseBackup('kein json').ok).toBe(false);
    expect(parseBackup('{"foo":1}').ok).toBe(false);
    expect(parseBackup('{"drivers":["A"],"trackStats":{},"raceHistory":5}').ok).toBe(false);
  });
});
