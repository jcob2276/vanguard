import { describe, expect, it } from 'vitest';
import { auditNutritionDay } from './nutritionAudit';

describe('nutrition day audit', () => {
  it('penalizes estimates without marking them as missing', () => {
    const audit = auditNutritionDay([{ calories: 200, parse_meta: { trust_level: 'estimated' } }]);
    expect(audit.uncertainEntries).toBe(1);
    expect(audit.incompleteEntries).toBe(0);
  });

  it('recognizes confirmed days', () => {
    expect(auditNutritionDay([{ calories: 200, parse_meta: { trust_level: 'confirmed' } }]).score).toBe(100);
  });
});

