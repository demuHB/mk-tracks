import { migrate } from './migrate';
import { BACKUP_KEY, SCHEMA_VERSION, STORAGE_KEY, type AppState } from './schema';

export function loadState(storage: Storage = localStorage): AppState {
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch (e) {
    console.error('Fehler beim Laden:', e);
  }
  if (!raw) return migrate(null);

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error('Gespeicherte Daten sind kein gültiges JSON:', e);
  }

  const version = (parsed as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (version !== SCHEMA_VERSION) {
    try {
      // Einmalige Sicherheitskopie der Daten vor der ersten Migration.
      if (!storage.getItem(BACKUP_KEY)) storage.setItem(BACKUP_KEY, raw);
    } catch (e) {
      console.error('Sicherheitskopie fehlgeschlagen:', e);
    }
  }
  return migrate(parsed);
}

export function saveState(state: AppState, storage: Storage = localStorage): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('Fehler beim Speichern:', e);
    return false;
  }
}

/** Liefert die vor der ersten Migration gesicherten Rohdaten (falls vorhanden). */
export function getLegacyBackup(storage: Storage = localStorage): string | null {
  try {
    return storage.getItem(BACKUP_KEY);
  } catch {
    return null;
  }
}
