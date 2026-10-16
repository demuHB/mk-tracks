// Gespeicherte Daten so, wie sie v1.8 (public/legacy/index.html) erzeugt.

const legacyRace = (id: number, results: Record<string, unknown>) => ({
  id,
  timestamp: new Date(id).toLocaleString('de-DE'),
  results,
});

const T0 = new Date('2026-06-12T19:00:00').getTime();
const MIN = 60_000;

export const legacyRaces = [
  // raceHistory ist neueste zuerst
  legacyRace(T0 + 30 * MIN, {
    Dennis: { position: 2, points: 90 },
    Monika: { position: 1, points: 100 },
    Volker: { position: 5, points: null },
  }),
  legacyRace(T0 + 20 * MIN, { Dennis: { position: 1, points: 110 }, Monika: { position: 3, points: 80 } }),
  legacyRace(T0 + 10 * MIN, { Dennis: { position: 1, points: 105 }, Monika: { position: 4, points: 70 } }),
  // sehr altes Format: nur Platzierung als Zahl
  legacyRace(T0, { Dennis: 3, Monika: 2, Volker: 1 }),
];

const stats = (positions: number[], points: number[]) => ({
  races: positions.length,
  wins: positions.filter((p) => p === 1).length,
  bestPosition: Math.min(...positions),
  worstPosition: Math.max(...positions),
  positions,
  points,
  bestPoints: points.length ? Math.max(...points) : null,
  worstPoints: points.length ? Math.min(...points) : null,
});

export function legacyState() {
  return {
    tracks: ['Baumwipfelpfad', 'Meine Strecke'],
    probabilities: { Baumwipfelpfad: 0.5, 'Rainbow Road': 0.25, 'Meine Strecke': 1 },
    counter: 3,
    trackStats: { Baumwipfelpfad: 1, 'Rainbow Road': 2, 'Meine Strecke': 0 },
    drivers: ['Dennis', 'Monika', 'Volker'],
    driverStats: {
      Dennis: stats([2, 1, 1, 3], [90, 110, 105]),
      Monika: stats([1, 3, 4, 2], [100, 80, 70]),
      // Volker hat zwei Rennen aus der Zeit vor der Historie
      Volker: stats([5, 1, 7, 12], [40]),
    },
    raceHistory: legacyRaces,
    customTracks: ['Meine Strecke'],
    currentDriverValues: { Dennis: { position: '4', points: '' } },
    selectedTracks: ['Rainbow Road'],
  };
}
