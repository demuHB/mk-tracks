import { registerSW } from 'virtual:pwa-register';
import './styles/main.css';
import type { AppState, ThemeSetting } from './state/schema';
import { initStore, subscribe } from './state/store';
import { destroyCharts, runMounts } from './ui/charts';
import { h, icon } from './ui/dom';
import { setNavigator, type TabId } from './ui/nav';
import { renderMore } from './ui/views/more';
import { renderResults } from './ui/views/results';
import { renderSet } from './ui/views/set';
import { renderStats } from './ui/views/stats';
import { renderTracks } from './ui/views/tracks';

const TABS: {
  id: TabId;
  label: string;
  title: string;
  icon: Parameters<typeof icon>[0];
  render: (s: AppState) => HTMLElement;
}[] = [
  { id: 'set', label: 'Set', title: 'Neues Set', icon: 'dice', render: renderSet },
  { id: 'tracks', label: 'Strecken', title: 'Strecken', icon: 'list', render: renderTracks },
  { id: 'results', label: 'Ergebnisse', title: 'Ergebnisse', icon: 'flag', render: renderResults },
  { id: 'stats', label: 'Statistik', title: 'Statistik', icon: 'chart', render: renderStats },
  { id: 'more', label: 'Mehr', title: 'Einstellungen', icon: 'more', render: renderMore },
];
const TAB_KEY = 'mkTracks.tab';

function readTab(): TabId {
  try {
    const t = localStorage.getItem(TAB_KEY);
    if (TABS.some((x) => x.id === t)) return t as TabId;
  } catch {
    /* ignorieren */
  }
  return 'set';
}

let currentTab: TabId = readTab();
let state = initStore();

const title = h('h1', { class: 'app-title' });
const main = h('main', { class: 'app-main', id: 'main' });
const navButtons = new Map<TabId, HTMLButtonElement>();
const nav = h(
  'nav',
  { class: 'bottom-nav', 'aria-label': 'Hauptnavigation' },
  TABS.map((t) => {
    const btn = h(
      'button',
      { class: 'nav-btn', onclick: () => navigateTo(t.id) },
      icon(t.icon),
      h('span', null, t.label),
    );
    navButtons.set(t.id, btn);
    return btn;
  }),
);

const media = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme(setting: ThemeSetting): void {
  const resolved = setting === 'system' ? (media.matches ? 'dark' : 'light') : setting;
  document.documentElement.dataset.theme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#0d0d0d' : '#f4f4f2');
}

function render(): void {
  const tab = TABS.find((t) => t.id === currentTab)!;
  applyTheme(state.settings?.theme ?? 'dark');
  title.textContent = tab.title;
  for (const [id, btn] of navButtons) {
    btn.classList.toggle('is-active', id === currentTab);
    if (id === currentTab) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  }
  destroyCharts();
  main.replaceChildren(tab.render(state));
  runMounts();
}

function navigateTo(tab: TabId): void {
  if (tab !== currentTab) {
    currentTab = tab;
    try {
      localStorage.setItem(TAB_KEY, tab);
    } catch {
      /* ignorieren */
    }
    render();
    window.scrollTo({ top: 0 });
  }
}

setNavigator(navigateTo);
subscribe((s) => {
  state = s;
  const y = window.scrollY;
  render();
  window.scrollTo({ top: y });
});
media.addEventListener('change', () => render());

// Änderungen aus der alten Version in einem anderen Tab übernehmen
window.addEventListener('storage', (e) => {
  if (e.key === 'mkTracksAppState') {
    state = initStore();
    render();
  }
});

document
  .getElementById('app')!
  .replaceChildren(
    h(
      'header',
      { class: 'app-header' },
      h('span', { class: 'app-logo', 'aria-hidden': 'true' }, '🏁'),
      title,
    ),
    main,
    nav,
  );
render();

registerSW({ immediate: true });
