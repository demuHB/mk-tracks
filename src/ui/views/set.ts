import { formatProbability, generateSet, isSetUndoable, resetProbabilities } from '../../domain/tracks';
import type { AppState } from '../../state/schema';
import { update } from '../../state/store';
import { confirmDialog, toast } from '../components/dialogs';
import { h, icon } from '../dom';
import { navigate } from '../nav';

export function renderSet(state: AppState): HTMLElement {
  const set = state.currentSet;
  const undoable = isSetUndoable(state);

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
            set.tracks.map((track, i) =>
              h(
                'li',
                { class: 'set-item', style: { animationDelay: `${i * 40}ms` } },
                h('span', { class: 'set-num' }, String(i + 1)),
                h('span', { class: 'set-name' }, track),
                h(
                  'span',
                  { class: 'chip', title: 'Wahrscheinlichkeit vor der Auslosung' },
                  formatProbability(set.probabilities[track] ?? 1),
                ),
              ),
            ),
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
