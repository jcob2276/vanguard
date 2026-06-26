import { describe, expect, it } from 'vitest';
import { bodyTrend, mergeLatestBodyMetrics, navyBodyFatPct } from './bodyMetrics';

describe('mergeLatestBodyMetrics', () => {
  it('scala ostatnie niepuste wartości z wielu wpisów', () => {
    const merged = mergeLatestBodyMetrics([
      { date: '2026-06-25', weight: 74.5, waist: 83 },
      { date: '2026-06-26', belly: 87, chest: 95, hips: 90, weight: null, waist: null },
    ]);

    expect(merged?.weight).toBe(74.5);
    expect(merged?.waist).toBe(83);
    expect(merged?.belly).toBe(87);
    expect(merged?.hips).toBe(90);
    expect(merged?.asOfDate).toBe('2026-06-26');
  });
});

describe('bodyTrend', () => {
  it('porównuje dwa ostatnie wpisy z wartością pola', () => {
    const trend = bodyTrend(
      [
        { date: '2026-06-20', weight: 75 },
        { date: '2026-06-25', weight: 74.5 },
        { date: '2026-06-26', weight: null },
      ],
      'weight',
    );
    expect(trend).toEqual({ cur: 74.5, prev: 75 });
  });
});

describe('navyBodyFatPct', () => {
  it('liczy BF dla typowych pomiarów', () => {
    const bf = navyBodyFatPct(87, 37, 168);
    expect(bf).not.toBeNull();
    expect(bf!).toBeGreaterThan(10);
    expect(bf!).toBeLessThan(30);
  });
});
