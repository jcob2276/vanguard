import { describe, expect, it } from 'vitest';
import { rankFoodResult } from './foodSearch';

describe('food search ranking', () => {
  it('prefers exact and frequently used private matches', () => {
    const exact = rankFoodResult({ name: 'Grzesiek', brand: 'Goplana', useCount: 4 }, 'grzesiek');
    const loose = rankFoodResult({ name: 'Baton Grzesiek karmel', brand: null, useCount: 0 }, 'grzesiek');
    expect(exact).toBeGreaterThan(loose);
  });

  it('matches Polish diacritics consistently', () => {
    expect(rankFoodResult({ name: 'Żółty ser', brand: null }, 'zolty')).toBeGreaterThan(0);
  });
});
