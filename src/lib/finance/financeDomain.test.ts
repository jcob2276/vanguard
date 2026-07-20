import { describe, expect, it } from 'vitest';
import { computeSafeToSpend, runMonteCarlo, computeMortgage } from '@vanguard/domain';

describe('finance domain v2', () => {
  it('computes safe to spend', () => {
    const r = computeSafeToSpend({
      liquid: 50000,
      monthlyIncome: 15000,
      monthlyExpenses: 6000,
      emergencyTargetMonths: 6,
      spentThisMonth: 2000,
      daysLeftInMonth: 10,
    });
    expect(r.safeToday).toBeGreaterThan(0);
    expect(r.breakdown.freeCashFlow).toBe(9000);
  });

  it('runs monte carlo with bounded probability', () => {
    const r = runMonteCarlo({
      currentSavings: 100000,
      monthlyContribution: 5000,
      fireTarget: 1800000,
      expectedReturnPct: 7,
      simulations: 100,
      maxYears: 30,
    });
    expect(r.successProbability).toBeGreaterThanOrEqual(0);
    expect(r.successProbability).toBeLessThanOrEqual(1);
  });

  it('computes mortgage payment', () => {
    const r = computeMortgage({ principal: 400000, annualRatePct: 7, years: 25 });
    expect(r.monthlyPayment).toBeGreaterThan(2000);
    expect(r.totalInterest).toBeGreaterThan(0);
  });
});
