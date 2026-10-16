# MK Strecken

Mario-Kart-Streckenauslosung mit Ergebnis-Erfassung und Statistiken – als installierbare Web-App (PWA).

Live: https://demuhb.github.io/mk-tracks/ · Alte Version (v1.8): https://demuhb.github.io/mk-tracks/legacy/

## Entwicklung

```bash
npm install
npm run dev      # http://localhost:5173/mk-tracks/
npm test
npm run build
```

Deployment läuft per GitHub Action (`.github/workflows/deploy.yml`) bei jedem Push auf `main`.

## Daten & Kompatibilität

Alle Daten liegen im Browser unter `localStorage['mkTracksAppState']` – im selben Format wie v1.8.
Neue Felder (`schemaVersion`, `ts`, `currentSet`, `settings`, `legacyOrphans`) werden nur ergänzt,
daher können alte und neue Version parallel mit denselben Daten benutzt werden. Backups (Export/Import)
sind in beide Richtungen kompatibel. Vor der ersten Migration wird eine Kopie unter
`mkTracksAppState.backup-v1` abgelegt.

- `src/state/` – Datenmodell, Migration, Speicher
- `src/domain/` – Streckenauslosung, Ergebnisse, Statistiken (reine Funktionen, getestet)
- `src/ui/` – Views und Komponenten (ohne Framework)
- `public/legacy/` – die alte Version 1:1
