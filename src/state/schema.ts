// Datenmodell. Das Shape ist identisch mit v1.8 (public/legacy/index.html) und wird nur additiv
// erweitert, damit alte und neue Version denselben localStorage-Eintrag nutzen können.

export interface DriverStats {
  races: number;
  wins: number;
  bestPosition: number | null;
  worstPosition: number | null;
  positions: number[];
  points: number[];
  bestPoints: number | null;
  worstPoints: number | null;
}

export interface RaceResult {
  position: number;
  points: number | null;
}

export interface Race {
  /** Date.now() beim Speichern – dient auch als Zeitstempel. */
  id: number;
  /** Anzeige-String im deutschen Format (von v1.8 übernommen). */
  timestamp: string;
  /** Sehr alte Einträge speichern nur die Platzierung als Zahl. */
  results: Record<string, RaceResult | number>;
  /** v2: ISO-Zeitstempel. Fehlt bei Rennen, die mit v1.8 gespeichert wurden. */
  ts?: string;
}

export interface DraftValues {
  position: string;
  points: string;
}

/** v2: Ergebnisse aus driverStats, die in der raceHistory fehlen (Altdaten ohne Datum). */
export interface OrphanStats {
  positions: number[];
  points: number[];
}

export interface CurrentSet {
  tracks: string[];
  /** Wahrscheinlichkeit jeder Strecke vor der Auslosung. */
  probabilities: Record<string, number>;
  createdAt: string;
  /** Stand von `counter` direkt nach dem Auslosen. Fehlt bei Sets vor dieser Version. */
  setNumber?: number;
  /** true, sobald für dieses Set ein Ergebnis gespeichert wurde. */
  played?: boolean;
}

export type ThemeSetting = 'system' | 'dark' | 'light';

export interface Settings {
  theme: ThemeSetting;
}

export interface AppState {
  tracks: string[];
  probabilities: Record<string, number>;
  counter: number;
  trackStats: Record<string, number>;
  drivers: string[];
  driverStats: Record<string, DriverStats>;
  raceHistory: Race[];
  customTracks: string[];
  currentDriverValues: Record<string, DraftValues>;
  selectedTracks: string[];
  // --- v2 (additiv) ---
  schemaVersion?: number;
  legacyOrphans?: Record<string, OrphanStats>;
  currentSet?: CurrentSet | null;
  settings?: Settings;
}

export const SCHEMA_VERSION = 2;
export const STORAGE_KEY = 'mkTracksAppState';
export const BACKUP_KEY = 'mkTracksAppState.backup-v1';

export const MIN_POSITION = 1;
export const MAX_POSITION = 24;
export const MIN_POINTS = 0;
export const MAX_POINTS = 120;
export const SET_SIZE = 8;

export const INITIAL_TRACKS = [
  'Baumwipfelpfad',
  'Fliegende Festung',
  'Kino Buu Huu',
  'Bowsers Festung',
  'Cheep-Cheep-Kaskaden',
  'Schoko-Sumpf',
  'Crown City',
  'Pusteblumen-Grotte',
  'Glühheiße Wüste',
  'Dinodino-Dschungel',
  'DK Alpin',
  'DK-Startrampe',
  'Knochentrocken-Vulkan',
  'Wildtierpark',
  '?-Block-Ruinen',
  'Koopa-Strand',
  'Mario Bros.-Piste',
  'Marios Piste',
  'Kuhmuh-Weide',
  'Peach Beach',
  'Peach-Stadion',
  'Rainbow Road',
  'Salzwasser-Serpentinen',
  'Shy Guys Basar',
  'Eiscreme-Eskapade',
  'Aurora-Ausblick',
  'Toads Fabrik',
  'Wario-Arena',
  'Warios Galeonenwrack',
  'Dampflok-Gipfel',
];

export const DEFAULT_DRIVERS = ['Dennis', 'Monika', 'Volker'];

export function emptyDriverStats(): DriverStats {
  return {
    races: 0,
    wins: 0,
    bestPosition: null,
    worstPosition: null,
    positions: [],
    points: [],
    bestPoints: null,
    worstPoints: null,
  };
}

export function createInitialState(): AppState {
  return {
    tracks: [],
    probabilities: {},
    counter: 0,
    trackStats: {},
    drivers: [...DEFAULT_DRIVERS],
    driverStats: {},
    raceHistory: [],
    customTracks: [],
    currentDriverValues: {},
    selectedTracks: [],
  };
}
