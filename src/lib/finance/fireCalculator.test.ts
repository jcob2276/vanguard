import { describe, expect, it } from 'vitest';
import { computeFireMetrics, computeFinancialScore } from '@vanguard/domain';

describe('fireCalculator', () => {
  it('computes FIRE number at 4% SWR', () => {
    const r = computeFireMetrics({
      monthlyExpenses: 6000,
      monthlyIncome: 15000,
      currentSavings: 100000,
      expectedReturnPct: 7,
      inflationPct: 3,
      safeWithdrawalRatePct: 4,
    });
    expect(r.fireNumber).toBe(6000 * 12 / 0.04);
    expect(r.monthlySavings).toBe(9000);
    expect(r.savingsRatePct).toBeCloseTo(60, 0);
  });

  it('computes financial score', () => {
    const score = computeFinancialScore({
      runwayMonths: 6,
      emergencyTargetMonths: 6,
      savingsRatePct: 30,
      fireProgressPct: 50,
      monthlyCashFlow: 1000,
    });
    expect(score).toBeGreaterThan(50);
  });
});
