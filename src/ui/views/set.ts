import {
  formatProbability,
  generateSet,
  isRevealed,
  isSetUndoable,
  resetProbabilities,
  revealTrack,
} from '../../domain/tracks';
import type { AppState, CurrentSet } from '../../state/schema';
import { update } from '../../state/store';
import { afterMount } from '../charts';
import { confirmDialog, toast } from '../components/dialogs';
import { h, icon } from '../dom';
import { navigate } from '../nav';

/** Set, dessen Einblend-Animation schon lief (sonst würde sie bei jedem Neu-Rendern wiederholt). */
let introducedSet: string | null = null;
/** Strecke, die gerade aufgedeckt wird und beim nächsten Rendern umdreht. */
let flipping: number | null = null;

function trackFace(set: CurrentSet, track: string, i: number, extraClass?: string): HTMLElement {
  return h(
    'div',
    { class: ['flip-face face-shown', extraClass] },
    h('span', { class: 'set-num' }, String(i + 1)),
    h('span', { class: 'set-name' }, track),
    h(
      'span',
      { class: 'chip', title: 'Wahrscheinlichkeit vor der Auslosung' },
      formatProbability(set.probabilities[track] ?? 1),
    ),
  );
}

function hiddenFace(i: number): HTMLElement {
  return h(
    'div',
    { class: 'flip-face face-hidden' },
    h('span', { class: 'set-num' }, String(i + 1)),
    h('span', { class: 'hidden-hint' }, 'Antippen zum Aufdecken'),
    h('span', { class: 'hidden-mark', 'aria-hidden': 'true' }, '?'),
  );
}

function setItem(set: CurrentSet, track: string, i: number, isNew: boolean): HTMLElement {
  const itemProps = { class: ['set-item', isNew && 'is-new'], style: { animationDelay: `${i * 40}ms` } };

  if (i === flipping) {
    // Beide Seiten rendern und nach dem Einhängen umdrehen.
    const back = hiddenFace(i);
    back.setAttribute('aria-hidden', 'true');
    const inner = h('div', { class: 'flip-inner' }, back, trackFace(set, track, i, 'is-back'));
    afterMount(() => requestAnimationFrame(() => inner.classList.add('is-flipped')));
    return h('li', itemProps, h('div', { class: 'flip-card' }, inner));
  }

  if (!isRevealed(set, i)) {
    return h(
      'li',
      itemProps,
      h(
        'button',
        {
          class: 'flip-card',
          'aria-label': `Strecke ${i + 1} aufdecken`,
          onclick: () => {
            flipping = i;
            update((s) => revealTrack(s, i));
          },
        },
        h('div', { class: 'flip-inner' }, hiddenFace(i)),
      ),
    );
  }

  return h('li', itemProps, trackFace(set, track, i));
}

export function renderSet(state: AppState): HTMLElement {
  const set = state.currentSet;
  const undoable = isSetUndoable(state);
  const isNewSet = !!set && set.createdAt !== introducedSet;
  if (set) introducedSet = set.createdAt;
  // Nur für genau dieses Rendern umdrehen
  queueMicrotask(() => (flipping = null));

  const onGenerate = () => {
    update((s) => generateSet(s));
    if (undoable) toast('Vorheriges Set ersetzt – es wird nicht mitgezählt');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onReset = async () => {
    const ok = await confirmDialog(
      'Wahrscheinlichkeiten zurücksetzen?',
      'Alle Strecken bekommen wieder 100 % und der Set-Zähler startet bei 0. Die Häufigkeiten bleiben erhalten.',
      { confirmLabel: 'Zurücksetzen', danger: true },
    );
    if (!ok) return;
    update(resetProbabilities);
    toast('Wahrscheinlichkeiten zurückgesetzt');
  };

  return h(
    'div',
    { class: 'view' },
    h(
      'section',
      { class: 'hero' },
      h('div', { class: 'hero-label' }, 'Gespielte Sets'),
      h('div', { class: 'hero-value' }, String(state.counter)),
      h(
        'button',
        { class: 'btn btn-primary btn-lg btn-block', onclick: onGenerate },
        icon('dice'),
        'Neues Set würfeln',
      ),
    ),
    set
      ? h(
          'section',
          { class: 'card' },
          h(
            'div',
            { class: 'card-head' },
            h('h2', null, 'Aktuelles Set'),
            h(
              'span',
              { class: 'muted small' },
              new Date(set.createdAt).toLocaleString('de-DE', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              }),
            ),
          ),
          set.setNumber !== undefined &&
            h(
              'p',
              { class: ['set-status', undoable ? 'is-open' : 'is-played'] },
              undoable
                ? 'Noch nicht gespielt – neu würfeln ersetzt dieses Set, ohne es mitzuzählen.'
                : 'Gespielt – zählt in der Strecken-Statistik.',
            ),
          h(
            'ol',
            { class: 'set-list' },
            set.tracks.map((track, i) => setItem(set, track, i, isNewSet)),
          ),
          h(
            'button',
            { class: 'btn btn-ghost btn-block', onclick: () => navigate('results') },
            icon('flag'),
            'Ergebnisse eintragen',
          ),
        )
      : h(
          'section',
          { class: 'empty' },
          h('p', null, 'Noch kein Set gelost.'),
          h('p', { class: 'muted small' }, 'Oder im Tab „Strecken“ 8 Strecken selbst auswählen.'),
        ),
    h(
      'button',
      { class: 'btn btn-ghost btn-block btn-subtle', onclick: onReset },
      icon('reset'),
      'Wahrscheinlichkeiten zurücksetzen',
    ),
  );
}
