import { describe, expect, it } from 'vitest';
import { calorieRange, deriveFoodTrust } from './foodTrust';

describe('food trust', () => {
  it('does not pretend an incomplete product is usable', () => {
    expect(deriveFoodTrust({ source: 'off', calories: null }).level).toBe('incomplete');
  });

  it('distinguishes confirmed labels from estimates', () => {
    expect(deriveFoodTrust({ source: 'label_ocr', calories: 200 }).uncertaintyPct).toBe(5);
    expect(deriveFoodTrust({ source: 'estimated', calories: 200 }).uncertaintyPct).toBe(25);
  });

  it('builds a visible uncertainty range', () => {
    expect(calorieRange(200, 10)).toEqual({ min: 180, max: 220 });
  });
});

