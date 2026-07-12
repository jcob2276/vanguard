import { describe, it, expect } from 'vitest';
import { calculateProjection } from './statsCalculations';
import type { Tables } from '../database.types';

// Simple factory helper to create partial body metric objects
function createBodyMetric(date: string, weight: number | null, waist: number | null = null): Tables<'body_metrics'> {
  return {
    id: Math.random().toString(),
    user_id: 'test-user',
    created_at: new Date().toISOString(),
    date,
    weight,
    waist,
    belly: null,
    biceps_l: null,
    biceps_r: null,
    body_fat: null,
    body_water: null,
    bone_mass: null,
    calf: null,
    chest: null,
    forearm: null,
    hips: null,
    muscle_mass: null,
    neck: null,
    thigh: null,
    weight_italia: null,
  };
}


describe('statsCalculations - calculateProjection', () => {
  it('should return null if data is null, undefined, or empty', () => {
    expect(calculateProjection(null, 'weight')).toBeNull();
    expect(calculateProjection([], 'weight')).toBeNull();
    expect(calculateProjection([createBodyMetric('2026-06-01', 80.0)], 'weight')).toBeNull();
  });

  it('should calculate projection correctly for downward trend', () => {
    // 14 days, decreasing by 0.2 kg per day
    const mockData: Tables<'body_metrics'>[] = [];
    let weight = 85.0;
    for (let i = 1; i <= 14; i++) {
      const dateStr = `2026-06-${i.toString().padStart(2, '0')}`;
      mockData.push(createBodyMetric(dateStr, weight));
      weight = Number((weight - 0.2).toFixed(1));
    }
    // Last value should be 85.0 - (13 * 0.2) = 82.4
    // We project 42 days into the future.
    // Daily slope is -0.2. Projected change = 42 * -0.2 = -8.4
    // Projected weight = 82.4 + (-8.4) = 74.0
    const result = calculateProjection(mockData, 'weight', 42);
    expect(result).not.toBeNull();
    expect(result?.value).toBe('74.0');
    expect(result?.change).toBe('-8.4');
  });

  it('should return null if there is denom = 0 or invalid data points', () => {
    // Non-changing dates, or all same dates causing denom = 0
    const mockData = [
      createBodyMetric('2026-06-01', 80.0),
      createBodyMetric('2026-06-01', 80.0),
      createBodyMetric('2026-06-01', 80.0),
    ];
    expect(calculateProjection(mockData, 'weight')).toBeNull();
  });
});

