import { describe, expect, it } from 'vitest';
import { calibrateNutrition } from './nutritionCalibration';

describe('nutrition calibration', () => {
  it('waits for enough evidence', () => {
    expect(calibrateNutrition([{ date: '2026-01-01', calories: 2000 }], []).status).toBe('collecting');
  });

  it('calculates an observed weekly trend without claiming TDEE', () => {
    const days = Array.from({ length: 14 }, (_, i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, calories: 2000 }));
    const result = calibrateNutrition(days, [{ date: '2026-01-01', weight_kg: 80 }, { date: '2026-01-14', weight_kg: 79 }]);
    expect(result.status).toBe('ready');
    expect(result.weeklyWeightChangeKg).toBeLessThan(0);
  });
});
