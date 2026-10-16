import {
  addTrack,
  applyManualSelection,
  formatProbability,
  removeTrack,
  toggleSelection,
  tracksByFrequency,
} from '../../domain/tracks';
import { SET_SIZE, type AppState } from '../../state/schema';
import { getState, update } from '../../state/store';
import { confirmDialog, toast } from '../components/dialogs';
import { h, icon } from '../dom';
import { navigate } from '../nav';

async function confirmSelection(): Promise<void> {
  const selected = getState().selectedTracks;
  const ok = await confirmDialog(
    'Strecken als Set übernehmen?',
    h(
      'ol',
      { class: 'preview-list' },
      selected.map((t) => h('li', null, t)),
    ),
    { confirmLabel: 'Übernehmen' },
  );
  if (ok) {
    update((s) => applyManualSelection(s));
    navigate('set');
  } else {
    update((s) => (s.selectedTracks = []));
  }
}

export function renderTracks(state: AppState): HTMLElement {
  const rows = tracksByFrequency(state);
  const maxCount = Math.max(1, ...rows.map((r) => r.count));
  const selected = state.selectedTracks;

  const onToggle = (track: string) => {
    update((s) => toggleSelection(s, track));
    if (getState().selectedTracks.length === SET_SIZE) void confirmSelection();
  };

  const onDelete = async (e: Event, track: string) => {
    e.stopPropagation();
    const ok = await confirmDialog('Strecke löschen?', `„${track}“ wird aus dem Datensatz entfernt.`, {
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (ok) update((s) => removeTrack(s, track));
  };

  const input = h('input', {
    type: 'text',
    placeholder: 'Neue Strecke…',
    'aria-label': 'Name der neuen Strecke',
    enterkeyhint: 'done',
  });
  const onAdd = (e: Event) => {
    e.preventDefault();
    let error: string | null = null;
    update((s) => (error = addTrack(s, input.value)));
    if (error) toast(error, 'error');
    else toast('Strecke hinzugefügt');
  };

  return h(
    'div',
    { class: 'view' },
    h('p', { class: 'hint' }, `Tippe ${SET_SIZE} Strecken an, um ein eigenes Set zusammenzustellen.`),
    h(
      'ul',
      { class: 'track-list' },
      rows.map(({ track, count, probability }, i) => {
        const isSelected = selected.includes(track);
        const isCustom = state.customTracks.includes(track);
        return h(
          'li',
          { class: 'track-li' },
          h(
            'button',
            {
              class: ['track-row', isSelected && 'is-selected'],
              'aria-pressed': String(isSelected),
              onclick: () => onToggle(track),
            },
            h(
              'span',
              { class: 'track-rank' },
              isSelected ? String(selected.indexOf(track) + 1) : `${i + 1}.`,
            ),
            h(
              'span',
              { class: 'track-main' },
              h('span', { class: 'track-name' }, track),
              h(
                'span',
                { class: 'freq-bar', 'aria-hidden': 'true' },
                h('span', { style: { width: `${(count / maxCount) * 100}%` } }),
              ),
            ),
            h('span', { class: 'track-count' }, `${count}×`),
            h('span', { class: 'chip' }, formatProbability(probability)),
          ),
          isCustom &&
            h(
              'button',
              {
                class: 'icon-btn icon-btn-danger',
                'aria-label': `${track} löschen`,
                onclick: (e: Event) => onDelete(e, track),
              },
              icon('trash'),
            ),
        );
      }),
    ),
    h(
      'form',
      { class: 'card inline-form', onsubmit: onAdd },
      input,
      h('button', { class: 'btn btn-primary', type: 'submit' }, icon('plus'), 'Hinzufügen'),
    ),
    selected.length > 0 &&
      h(
        'div',
        { class: 'selection-pill' },
        h('span', null, `Ausgewählt: ${selected.length}/${SET_SIZE}`),
        h(
          'button',
          {
            class: 'icon-btn',
            'aria-label': 'Auswahl leeren',
            onclick: () => update((s) => (s.selectedTracks = [])),
          },
          icon('x'),
        ),
      ),
  );
}
