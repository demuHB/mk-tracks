export type TabId = 'set' | 'tracks' | 'results' | 'stats' | 'more';

let navigateImpl: (tab: TabId) => void = () => {};

export function setNavigator(fn: (tab: TabId) => void): void {
  navigateImpl = fn;
}

export function navigate(tab: TabId): void {
  navigateImpl(tab);
}
