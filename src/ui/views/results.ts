import { deleteRace, saveRaceFromDrafts, updateRaceResult } from '../../domain/drivers';
import { formatRaceTimestamp, raceDate, toResult } from '../../domain/races';
import { formatSessionKey, sessionKey } from '../../domain/stats';
import { MAX_POINTS, MIN_POINTS, type AppState, type Race } from '../../state/schema';
import { refresh, update } from '../../state/store';
import { driverColor } from '../charts';
import { confirmDialog, pickNumber, pickPosition, toast } from '../components/dialogs';
import { h, icon } from '../dom';
import { navigate } from '../nav';

const QUICK_POSITIONS = 12;
const HISTORY_PAGE = 15;
let historyLimit = HISTORY_PAGE;

function setDraft(driver: string, field: 'position' | 'points', value: number | null) {
  update((s) => {
    s.currentDriverValues[driver] ??= { position: '', points: '' };
    s.currentDriverValues[driver][field] = value === null ? '' : String(value);
  });
}

function driverEntry(state: AppState, driver: string): HTMLElement {
  const draft = state.currentDriverValues[driver] ?? { position: '', points: '' };
  const position = draft.position ? Number(draft.position) : null;
  const points = draft.points ? Number(draft.points) : null;

  const onPoints = async () => {
    const v = await pickNumber(`${driver} – Punkte`, points, MIN_POINTS, MAX_POINTS);
    if (v !== undefined) setDraft(driver, 'points', v);
  };
  const onMore = async () => {
    const v = await pickPosition(`${driver} – Platzierung`, position);
    if (v !== undefined) setDraft(driver, 'position', v);
  };

  return h(
    'div',
    { class: 'card driver-entry' },
    h(
      'div',
      { class: 'card-head' },
      h(
        'span',
        { class: 'driver-title' },
        h('span', { class: 'dot', style: { background: driverColor(state.drivers, driver) } }),
        driver,
      ),
      h(
        'button',
        { class: ['btn btn-sm', points === null ? 'btn-ghost' : 'btn-tonal'], onclick: onPoints },
        points === null ? 'Punkte' : `${points} Pkt.`,
      ),
    ),
    h(
      'div',
      { class: 'quick-grid', role: 'group', 'aria-label': `Platzierung ${driver}` },
      Array.from({ length: QUICK_POSITIONS }, (_, i) => i + 1).map((n) =>
        h(
          'button',
          {
            class: ['pos-btn', position === n && 'is-active'],
            'aria-pressed': String(position === n),
            onclick: () => setDraft(driver, 'position', position === n ? null : n),
          },
          String(n),
        ),
      ),
      h(
        'button',
        {
          class: ['pos-btn', position !== null && position > QUICK_POSITIONS && 'is-active'],
          onclick: onMore,
        },
        position !== null && position > QUICK_POSITIONS ? String(position) : '13+',
      ),
    ),
  );
}

function raceCard(state: AppState, race: Race): HTMLElement {
  const date = raceDate(race);
  const onDelete = async () => {
    const ok = await confirmDialog(
      'Rennen löschen?',
      `Das Rennen vom ${formatRaceTimestamp(date)} wird gelöscht. Die Statistiken werden neu berechnet.`,
      { confirmLabel: 'Löschen', danger: true },
    );
    if (ok) update((s) => deleteRace(s, race.id));
  };

  const entries = Object.entries(race.results)
    .map(([driver, value]) => ({ driver, ...toResult(value) }))
    .sort((a, b) => a.position - b.position);

  return h(
    'li',
    { class: 'race-card' },
    h(
      'div',
      { class: 'race-head' },
      h(
        'span',
        { class: 'muted small' },
        date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      ),
      h(
        'button',
        { class: 'icon-btn icon-btn-danger', 'aria-label': 'Rennen löschen', onclick: onDelete },
        icon('trash'),
      ),
    ),
    h(
      'div',
      { class: 'race-results' },
      entries.map(({ driver, position, points }) =>
        h(
          'div',
          { class: 'race-row' },
          h(
            'span',
            { class: 'driver-title' },
            h('span', { class: 'dot', style: { background: driverColor(state.drivers, driver) } }),
            driver,
          ),
          h(
            'button',
            {
              class: ['btn btn-sm btn-tonal', position <= 3 && `podium-${position}`],
              'aria-label': `Platzierung ${driver} ändern`,
              onclick: async () => {
                const v = await pickPosition(`${driver} – Platzierung`, position, false);
                if (typeof v === 'number') update((s) => updateRaceResult(s, race.id, driver, 'position', v));
              },
            },
            `${position}.`,
          ),
          h(
            'button',
            {
              class: ['btn btn-sm', points === null ? 'btn-ghost' : 'btn-tonal'],
              'aria-label': `Punkte ${driver} ändern`,
              onclick: async () => {
                const v = await pickNumber(`${driver} – Punkte`, points, MIN_POINTS, MAX_POINTS);
                if (v !== undefined) update((s) => updateRaceResult(s, race.id, driver, 'points', v));
              },
            },
            points === null ? '– Pkt.' : `${points} Pkt.`,
          ),
        ),
      ),
    ),
  );
}

function history(state: AppState): HTMLElement {
  if (state.raceHistory.length === 0) {
    return h('p', { class: 'empty' }, 'Noch keine Rennen gespeichert.');
  }
  const shown = state.raceHistory.slice(0, historyLimit);
  const groups: { key: string; races: Race[] }[] = [];
  for (const race of shown) {
    const key = sessionKey(raceDate(race));
    if (groups.at(-1)?.key !== key) groups.push({ key, races: [] });
    groups.at(-1)!.races.push(race);
  }
  return h(
    'div',
    null,
    groups.map((g) =>
      h(
        'div',
        { class: 'history-group' },
        h('h3', { class: 'group-title' }, formatSessionKey(g.key)),
        h(
          'ul',
          { class: 'race-list' },
          g.races.map((r) => raceCard(state, r)),
        ),
      ),
    ),
    state.raceHistory.length > historyLimit &&
      h(
        'button',
        {
          class: 'btn btn-ghost btn-block',
          onclick: () => {
            historyLimit += HISTORY_PAGE;
            refresh();
          },
        },
        `Ältere Rennen anzeigen (${state.raceHistory.length - historyLimit} weitere)`,
      ),
  );
}

export function renderResults(state: AppState): HTMLElement {
  const filled = state.drivers.filter((d) => state.currentDriverValues[d]?.position).length;

  const onSave = () => {
    let race: Race | null = null;
    update((s) => (race = saveRaceFromDrafts(s)));
    if (race) toast('Rennen gespeichert');
    else toast('Bitte mindestens eine Platzierung eintragen.', 'error');
  };

  return h(
    'div',
    { class: 'view' },
    h(
      'div',
      { class: 'section-head' },
      h('h2', null, 'Neues Rennen'),
      h('button', { class: 'btn btn-sm btn-ghost', onclick: () => navigate('more') }, 'Fahrer verwalten'),
    ),
    state.drivers.map((d) => driverEntry(state, d)),
    h(
      'div',
      { class: 'sticky-action' },
      h(
        'button',
        { class: 'btn btn-primary btn-lg btn-block', disabled: filled === 0, onclick: onSave },
        icon('check'),
        filled === 0 ? 'Rennen speichern' : `Rennen speichern (${filled}/${state.drivers.length})`,
      ),
    ),
    h('div', { class: 'section-head' }, h('h2', null, 'Renn-Historie')),
    history(state),
  );
}
