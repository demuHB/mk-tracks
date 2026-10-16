// Wischgesten zum Wechseln der Tabs.

export type SwipeDirection = 'left' | 'right';

const MIN_DISTANCE = 60;
const MAX_DURATION_MS = 800;
/** Horizontale Bewegung muss deutlich überwiegen, damit normales Scrollen nicht auslöst. */
const MIN_RATIO = 1.5;

/** 'left' = Finger nach links gewischt → nächster Tab. */
export function detectSwipe(dx: number, dy: number, durationMs: number): SwipeDirection | null {
  if (durationMs > MAX_DURATION_MS) return null;
  if (Math.abs(dx) < MIN_DISTANCE) return null;
  if (Math.abs(dx) < Math.abs(dy) * MIN_RATIO) return null;
  return dx < 0 ? 'left' : 'right';
}

/** Elemente, in denen horizontale Gesten eine eigene Bedeutung haben. */
const IGNORE_SELECTOR = 'input, select, textarea, canvas, dialog, .table-scroll, .filter-row';

function isHorizontallyScrollable(target: Element | null): boolean {
  for (let el = target; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const overflow = getComputedStyle(el).overflowX;
      if (overflow === 'auto' || overflow === 'scroll') return true;
    }
  }
  return false;
}

export function setupSwipe(onSwipe: (dir: SwipeDirection) => void): void {
  let start: { x: number; y: number; t: number } | null = null;

  document.addEventListener(
    'touchstart',
    (e) => {
      const target = e.target as Element | null;
      if (
        e.touches.length !== 1 ||
        document.querySelector('dialog[open]') ||
        target?.closest(IGNORE_SELECTOR) ||
        isHorizontallyScrollable(target)
      ) {
        start = null;
        return;
      }
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY, t: e.timeStamp };
    },
    { passive: true },
  );

  document.addEventListener(
    'touchend',
    (e) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const dir = detectSwipe(t.clientX - start.x, t.clientY - start.y, e.timeStamp - start.t);
      start = null;
      if (dir) onSwipe(dir);
    },
    { passive: true },
  );

  document.addEventListener('touchcancel', () => (start = null), { passive: true });
}
