import { describe, expect, it } from 'vitest';
import { migrate } from '../src/state/migrate';
import { loadState, saveState } from '../src/state/storage';
import { BACKUP_KEY, INITIAL_TRACKS, STORAGE_KEY } from '../src/state/schema';
import { legacyState } from './fixtures';

describe('migrate', () => {
  it('erzeugt aus leeren Daten einen gültigen Start-State', () => {
    const s = migrate(null);
    expect(s.drivers).toEqual(['Dennis', 'Monika', 'Volker']);
    expect(s.tracks).toEqual(INITIAL_TRACKS);
    expect(s.probabilities['Rainbow Road']).toBe(1);
    expect(s.schemaVersion).toBe(2);
  });

  it('übernimmt alle v1.8-Daten unverändert', () => {
    const s = migrate(legacyState());
    expect(s.counter).toBe(3);
    expect(s.probabilities['Rainbow Road']).toBe(0.25);
    expect(s.trackStats['Rainbow Road']).toBe(2);
    expect(s.tracks).toContain('Meine Strecke');
    expect(s.selectedTracks).toEqual(['Rainbow Road']);
    expect(s.currentDriverValues.Dennis).toEqual({ position: '4', points: '' });
    expect(s.raceHistory).toHaveLength(4);
  });

  it('wandelt das alte Zahlen-Format um und ergänzt ts aus der id', () => {
    const s = migrate(legacyState());
    const oldest = s.raceHistory[3];
    expect(oldest.results.Volker).toEqual({ position: 1, points: null });
    expect(new Date(oldest.ts!).getTime()).toBe(oldest.id);
  });

  it('driverStats stimmen exakt mit den gespeicherten v1.8-Werten überein', () => {
    const input = legacyState();
    const s = migrate(legacyState());
    for (const driver of input.drivers) {
      const before = input.driverStats[driver as keyof typeof input.driverStats];
      const after = s.driverStats[driver];
      expect(after.races).toBe(before.races);
      expect(after.wins).toBe(before.wins);
      expect(after.bestPosition).toBe(before.bestPosition);
      expect(after.worstPosition).toBe(before.worstPosition);
      expect([...after.positions].sort()).toEqual([...before.positions].sort());
      expect([...after.points].sort()).toEqual([...before.points].sort());
    }
  });

  it('bewahrt Ergebnisse, die nur in driverStats stehen, als Altdaten', () => {
    const s = migrate(legacyState());
    expect(s.legacyOrphans).toEqual({ Volker: { positions: [7, 12], points: [40] } });
  });

  it('ist idempotent (v2 → v2)', () => {
    const once = migrate(legacyState());
    const twice = migrate(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it('verwirft Altdaten, wenn die alte Version die Statistik zurückgesetzt hat', () => {
    const v2 = JSON.parse(JSON.stringify(migrate(legacyState())));
    // so sieht es aus, nachdem v1.8 "Reset Statistik" für Volker ausgeführt hat
    v2.driverStats.Volker = { races: 0, wins: 0, positions: [], points: [] };
    for (const race of v2.raceHistory) delete race.results.Volker;
    const s = migrate(v2);
    expect(s.legacyOrphans).toEqual({});
    expect(s.driverStats.Volker.races).toBe(0);
  });

  it('behält unbekannte Felder (Vorwärtskompatibilität)', () => {
    const s = migrate({ ...legacyState(), zukunft: 42 });
    expect((s as unknown as { zukunft: number }).zukunft).toBe(42);
  });

  it('übernimmt Rennen, die die alte Version nach der Migration speichert', () => {
    const v2 = JSON.parse(JSON.stringify(migrate(legacyState())));
    const id = new Date('2026-06-13T20:00:00').getTime();
    v2.raceHistory.unshift({
      id,
      timestamp: 'Sa., 13. Juni',
      results: { Dennis: { position: 1, points: 120 } },
    });
    const s = migrate(v2);
    expect(s.raceHistory[0].ts).toBe(new Date(id).toISOString());
    expect(s.driverStats.Dennis.wins).toBe(3);
  });
});

describe('storage', () => {
  it('legt vor der ersten Migration eine Sicherheitskopie an', () => {
    localStorage.clear();
    const raw = JSON.stringify(legacyState());
    localStorage.setItem(STORAGE_KEY, raw);
    const s = loadState();
    expect(localStorage.getItem(BACKUP_KEY)).toBe(raw);
    saveState(s);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyState()).replace('"counter":3', '"counter":9'));
    loadState();
    expect(localStorage.getItem(BACKUP_KEY)).toBe(raw); // wird nicht überschrieben
  });

  it('speichert im selben Schlüssel und Format', () => {
    localStorage.clear();
    const s = migrate(legacyState());
    saveState(s);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.drivers).toEqual(s.drivers);
    expect(stored.driverStats.Dennis.positions).toBeInstanceOf(Array);
    expect(stored.raceHistory[0].results.Dennis.position).toBe(2);
  });
});
