import { exportFilename, parseBackup, serializeBackup, summarize } from '../../domain/backup';
import { addDriver, removeDriver, resetDriverStats } from '../../domain/drivers';
import { resetTrackStats } from '../../domain/tracks';
import type { AppState, ThemeSetting } from '../../state/schema';
import { replaceState, update } from '../../state/store';
import { getLegacyBackup } from '../../state/storage';
import { driverColor } from '../charts';
import { confirmDialog, openSheet, toast } from '../components/dialogs';
import { h, icon, type Child } from '../dom';

export const APP_VERSION = '2.0';

const CHANGELOG: { version: string; items: string[] }[] = [
  {
    version: '2.0',
    items: [
      'Komplett neu gebaut: schneller, dunkles Design, Navigation unten',
      'Neuer Statistik-Tab: Formkurve, Platzierungen, Head-to-Head, Spieleabende, Rekorde',
      'Eingabe per Platz-Raster und Nummernpad statt Pop-ups',
      'Alle bisherigen Daten werden automatisch übernommen',
      'Die alte Version bleibt unter „Alte Version öffnen“ erreichbar',
    ],
  },
  { version: '1.8', items: ['Daten-Backup als Datei (Export/Import)'] },
  { version: '1.7', items: ['Manuelle Streckenauswahl im Strecken-Tab'] },
  { version: '1.6', items: ['Quick-Buttons für schnelle Platzierungseingabe'] },
];

function download(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function summaryList(state: AppState): HTMLElement {
  const s = summarize(state);
  const d = (x: Date | null) => (x ? x.toLocaleDateString('de-DE') : '–');
  return h(
    'dl',
    { class: 'summary' },
    h('dt', null, 'Fahrer'),
    h('dd', null, s.drivers.join(', ') || '–'),
    h('dt', null, 'Rennen'),
    h('dd', null, `${s.races} (${d(s.firstRace)} – ${d(s.lastRace)})`),
    h('dt', null, 'Gespielte Sets'),
    h('dd', null, String(s.sets)),
  );
}

async function importFile(file: File): Promise<void> {
  const result = parseBackup(await file.text());
  if (!result.ok) {
    toast(result.error, 'error');
    return;
  }
  const ok = await confirmDialog(
    'Backup importieren?',
    h(
      'div',
      null,
      h('p', { class: 'sheet-text' }, `„${file.name}“ ersetzt alle aktuellen Daten. Inhalt des Backups:`),
      summaryList(result.state),
    ),
    { confirmLabel: 'Importieren', danger: true },
  );
  if (!ok) return;
  if (replaceState(result.state)) toast('Backup importiert');
  else toast('Speichern fehlgeschlagen', 'error');
}

async function resetStatsSheet(state: AppState): Promise<void> {
  const chosen = await openSheet<string[] | null>(
    'Statistik zurücksetzen',
    (close) => {
      const boxes = state.drivers.map((d) => h('input', { type: 'checkbox', value: d }));
      return [
        h(
          'p',
          { class: 'sheet-text' },
          'Alle Ergebnisse der gewählten Fahrer werden gelöscht. Die Fahrer bleiben bestehen.',
        ),
        h(
          'div',
          { class: 'check-list' },
          state.drivers.map((d, i) => h('label', { class: 'check-row' }, boxes[i], d)),
        ),
        h(
          'div',
          { class: 'sheet-actions' },
          h('button', { class: 'btn btn-ghost', onclick: () => close(null) }, 'Abbrechen'),
          h(
            'button',
            {
              class: 'btn btn-danger',
              onclick: () => close(boxes.filter((b) => b.checked).map((b) => b.value)),
            },
            'Zurücksetzen',
          ),
        ),
      ];
    },
    null,
  );
  if (!chosen) return;
  if (chosen.length === 0) {
    toast('Bitte mindestens einen Fahrer auswählen.', 'error');
    return;
  }
  const ok = await confirmDialog(
    'Wirklich zurücksetzen?',
    `Alle Rennergebnisse von ${chosen.join(', ')} werden gelöscht. Das kann nicht rückgängig gemacht werden.`,
    { confirmLabel: 'Endgültig löschen', danger: true },
  );
  if (ok) {
    update((s) => resetDriverStats(s, chosen));
    toast('Statistik zurückgesetzt');
  }
}

export function renderMore(state: AppState): HTMLElement {
  const theme = state.settings?.theme ?? 'dark';
  const setTheme = (t: ThemeSetting) => update((s) => (s.settings = { ...s.settings, theme: t }));

  const driverInput = h('input', {
    type: 'text',
    placeholder: 'Name…',
    'aria-label': 'Name des neuen Fahrers',
  });
  const onAddDriver = (e: Event) => {
    e.preventDefault();
    let error: string | null = null;
    update((s) => (error = addDriver(s, driverInput.value)));
    if (error) toast(error, 'error');
    else toast('Fahrer hinzugefügt');
  };
  const onRemoveDriver = async (driver: string) => {
    const ok = await confirmDialog(
      'Fahrer entfernen?',
      `„${driver}“ und alle Ergebnisse dieses Fahrers werden gelöscht.`,
      { confirmLabel: 'Entfernen', danger: true },
    );
    if (ok) update((s) => removeDriver(s, driver));
  };

  const fileInput = h('input', {
    type: 'file',
    accept: '.json,application/json',
    hidden: true,
    onchange: (e: Event) => {
      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      input.value = '';
      if (file) void importFile(file);
    },
  });

  const legacyBackup = getLegacyBackup();

  const onResetTracks = async () => {
    const ok = await confirmDialog(
      'Strecken-Statistik zurücksetzen?',
      'Alle Häufigkeiten werden auf 0, alle Wahrscheinlichkeiten auf 100 % und der Set-Zähler auf 0 gesetzt. Fahrer-Ergebnisse bleiben erhalten.',
      { confirmLabel: 'Zurücksetzen', danger: true },
    );
    if (ok) {
      update(resetTrackStats);
      toast('Strecken-Statistik zurückgesetzt');
    }
  };

  const section = (title: string, ...children: Child[]) =>
    h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, title)), children);

  return h(
    'div',
    { class: 'view' },
    section(
      'Darstellung',
      h(
        'div',
        { class: 'segmented', role: 'radiogroup', 'aria-label': 'Farbschema' },
        (
          [
            ['dark', 'Dunkel'],
            ['light', 'Hell'],
            ['system', 'System'],
          ] as [ThemeSetting, string][]
        ).map(([value, label]) =>
          h(
            'button',
            {
              role: 'radio',
              'aria-checked': String(theme === value),
              class: [theme === value && 'is-active'],
              onclick: () => setTheme(value),
            },
            label,
          ),
        ),
      ),
    ),
    section(
      'Fahrer',
      h(
        'ul',
        { class: 'driver-list' },
        state.drivers.map((d) =>
          h(
            'li',
            null,
            h(
              'span',
              { class: 'driver-title' },
              h('span', { class: 'dot', style: { background: driverColor(state.drivers, d) } }),
              d,
            ),
            h('span', { class: 'muted small' }, `${state.driverStats[d]?.races ?? 0} Rennen`),
            h(
              'button',
              {
                class: 'icon-btn icon-btn-danger',
                'aria-label': `${d} entfernen`,
                onclick: () => onRemoveDriver(d),
              },
              icon('trash'),
            ),
          ),
        ),
      ),
      h(
        'form',
        { class: 'inline-form', onsubmit: onAddDriver },
        driverInput,
        h('button', { class: 'btn btn-primary', type: 'submit' }, icon('plus'), 'Hinzufügen'),
      ),
      h(
        'button',
        { class: 'btn btn-ghost btn-block', onclick: () => resetStatsSheet(state) },
        icon('reset'),
        'Statistik zurücksetzen…',
      ),
    ),
    section(
      'Daten-Backup',
      h(
        'p',
        { class: 'muted small' },
        'Sichert alle Daten als Datei. Backups der alten und neuen Version sind untereinander kompatibel.',
      ),
      summaryList(state),
      h(
        'div',
        { class: 'btn-row' },
        h(
          'button',
          {
            class: 'btn btn-primary',
            onclick: () => {
              download(exportFilename(), serializeBackup(state));
              toast('Backup gespeichert (Download-Ordner)');
            },
          },
          icon('download'),
          'Export',
        ),
        h('button', { class: 'btn btn-tonal', onclick: () => fileInput.click() }, icon('upload'), 'Import'),
      ),
      fileInput,
      legacyBackup !== null &&
        h(
          'button',
          {
            class: 'btn btn-ghost btn-block btn-subtle',
            onclick: () => download('mk-strecken-sicherung-vor-v2.json', legacyBackup),
          },
          'Automatische Sicherung vor dem Update herunterladen',
        ),
    ),
    section(
      'Alte Version',
      h(
        'p',
        { class: 'muted small' },
        'Die bisherige App (v1.8) bleibt verfügbar und nutzt dieselben Daten – du kannst jederzeit hin und her wechseln.',
      ),
      h('a', { class: 'btn btn-ghost btn-block', href: './legacy/' }, 'Alte Version öffnen'),
    ),
    h(
      'section',
      { class: 'card card-danger' },
      h('div', { class: 'card-head' }, h('h2', null, 'Gefahrenzone')),
      h(
        'button',
        { class: 'btn btn-danger btn-block', onclick: onResetTracks },
        'Strecken-Statistik zurücksetzen',
      ),
    ),
    h(
      'details',
      { class: 'card changelog' },
      h('summary', null, `Version ${APP_VERSION} · Changelog`),
      CHANGELOG.map((c) =>
        h(
          'div',
          { class: 'changelog-item' },
          h('strong', null, `Version ${c.version}`),
          h(
            'ul',
            null,
            c.items.map((i) => h('li', null, i)),
          ),
        ),
      ),
    ),
  );
}
