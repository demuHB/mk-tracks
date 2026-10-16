import { describe, expect, it } from 'vitest';
import { detectSwipe } from '../src/ui/swipe';

describe('detectSwipe', () => {
  it('erkennt klare horizontale Wischbewegungen', () => {
    expect(detectSwipe(-120, 10, 200)).toBe('left');
    expect(detectSwipe(120, -15, 200)).toBe('right');
  });

  it('ignoriert kurze, langsame oder überwiegend vertikale Bewegungen', () => {
    expect(detectSwipe(-40, 0, 100)).toBeNull();
    expect(detectSwipe(-150, 0, 1500)).toBeNull();
    expect(detectSwipe(-100, 90, 200)).toBeNull();
  });
});
