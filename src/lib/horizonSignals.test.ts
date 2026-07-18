import { describe, expect, it } from 'vitest';
import { getTodayStateCopy, needsNutritionCorrection, needsRecoveryCorrection } from './horizonSignals';

describe('horizon signals', () => {
  it('keeps missing readiness neutral and under user control', () => {
    expect(getTodayStateCopy(0)).toContain('synchronizuje');
  });

  it('flags nutrition only when a real weekly deviation exists', () => {
    expect(needsNutritionCorrection({ loggedDays: 7, averageProtein: 140, proteinGoal: 150, caloriesDeltaPct: 2 })).toBe(false);
    expect(needsNutritionCorrection({ loggedDays: 4, averageProtein: 150, proteinGoal: 150, caloriesDeltaPct: 0 })).toBe(true);
  });

  it('flags accumulated recovery pressure', () => {
    expect(needsRecoveryCorrection({ warningDays: 2, averageRecovery: 70 })).toBe(false);
    expect(needsRecoveryCorrection({ warningDays: 3, averageRecovery: 70 })).toBe(true);
    expect(needsRecoveryCorrection({ warningDays: 0, averageRecovery: 54 })).toBe(true);
  });
});
