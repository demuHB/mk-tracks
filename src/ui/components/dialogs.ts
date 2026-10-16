import { MAX_POSITION } from '../../state/schema';
import { h, icon, type Child } from '../dom';

/** Öffnet ein Bottom-Sheet (<dialog>). `build` erhält eine close-Funktion. */
export function openSheet<T>(
  title: string,
  build: (close: (value: T) => void) => Child,
  fallback: T,
): Promise<T> {
  return new Promise((resolve) => {
    let result = fallback;
    const dialog = h('dialog', { class: 'sheet', 'aria-label': title });
    const close = (value: T) => {
      result = value;
      dialog.close();
    };
    dialog.append(
      h(
        'div',
        { class: 'sheet-head' },
        h('h2', null, title),
        h(
          'button',
          { class: 'icon-btn', 'aria-label': 'Schließen', onclick: () => close(fallback) },
          icon('x'),
        ),
      ),
      h('div', { class: 'sheet-body' }, build(close)),
    );
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) close(fallback); // Klick auf den Hintergrund
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(result);
    });
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

export function confirmDialog(
  title: string,
  message: string | Node,
  options: { confirmLabel?: string; danger?: boolean } = {},
): Promise<boolean> {
  return openSheet<boolean>(
    title,
    (close) => [
      typeof message === 'string' ? h('p', { class: 'sheet-text' }, message) : message,
      h(
        'div',
        { class: 'sheet-actions' },
        h('button', { class: 'btn btn-ghost', onclick: () => close(false) }, 'Abbrechen'),
        h(
          'button',
          { class: ['btn', options.danger ? 'btn-danger' : 'btn-primary'], onclick: () => close(true) },
          options.confirmLabel ?? 'OK',
        ),
      ),
    ],
    false,
  );
}

/** Platzierung 1–24 per Raster wählen. `null` = leeren, `undefined` = abgebrochen. */
export function pickPosition(title: string, current: number | null, allowClear = true) {
  return openSheet<number | null | undefined>(
    title,
    (close) => [
      h(
        'div',
        { class: 'pos-grid' },
        Array.from({ length: MAX_POSITION }, (_, i) => i + 1).map((n) =>
          h(
            'button',
            {
              class: ['pos-btn', n === current && 'is-active', n <= 3 && `podium-${n}`],
              onclick: () => close(n),
            },
            String(n),
          ),
        ),
      ),
      allowClear && h('button', { class: 'btn btn-ghost btn-block', onclick: () => close(null) }, 'Leeren'),
    ],
    undefined,
  );
}

/** Zahl per Nummernpad eingeben. `null` = leeren, `undefined` = abgebrochen. */
export function pickNumber(title: string, current: number | null, min: number, max: number) {
  return openSheet<number | null | undefined>(
    title,
    (close) => {
      let value = current === null ? '' : String(current);
      const display = h('output', { class: 'numpad-display' });
      const hint = h('p', { class: 'numpad-hint' }, `${min}–${max}`);
      const ok = h(
        'button',
        { class: 'btn btn-primary btn-block', onclick: () => close(Number(value)) },
        'Übernehmen',
      );
      const refresh = () => {
        display.textContent = value || '–';
        const n = Number(value);
        const valid = value !== '' && n >= min && n <= max;
        ok.disabled = !valid;
        hint.classList.toggle('is-error', value !== '' && !valid);
      };
      const press = (k: string) => {
        if (k === '⌫') value = value.slice(0, -1);
        else if (value.length < 3) value = value === '0' ? k : value + k;
        refresh();
      };
      refresh();
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];
      return [
        display,
        hint,
        h(
          'div',
          { class: 'numpad' },
          keys.map((k) =>
            h(
              'button',
              {
                class: 'numpad-key',
                'aria-label': k === '⌫' ? 'Löschen' : k === 'C' ? 'Leeren' : k,
                onclick: () => (k === 'C' ? close(null) : press(k)),
              },
              k === '⌫' ? icon('backspace') : k,
            ),
          ),
        ),
        ok,
      ];
    },
    undefined,
  );
}

let toastTimer: number | undefined;

export function toast(message: string, kind: 'info' | 'error' = 'info'): void {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: ['toast', kind === 'error' && 'is-error'], role: 'status' }, message);
  document.body.appendChild(el);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.remove(), 3000);
}
