import { describe, expect, it } from 'vitest';
import {
  computeIncomeBreakdown,
  computeRunwayFloor,
  buildCashflowMonth,
} from '@vanguard/domain';

describe('income model', () => {
  it('splits UoZ base from variable commission income', () => {
    const breakdown = computeIncomeBreakdown([
      { source_type: 'salary', amount_monthly: 4000, is_active: true },
      { source_type: 'commission', amount_monthly: 8000, is_active: true },
      { source_type: 'sales', amount_monthly: 2000, is_active: true },
    ]);
    expect(breakdown.baseMonthly).toBe(4000);
    expect(breakdown.variableMonthly).toBe(10000);
    expect(breakdown.totalMonthly).toBe(14000);
  });

  it('computes runway without deal when base does not cover expenses', () => {
    const breakdown = computeIncomeBreakdown([
      { source_type: 'salary', amount_monthly: 4000, is_active: true },
    ]);
    const runway = computeRunwayFloor(12000, 6000, breakdown);
    expect(runway.baseCoversExpenses).toBe(false);
    expect(runway.monthlyDeficitWithoutVariable).toBe(2000);
    expect(runway.runwayWithoutDealMonths).toBe(6);
  });

  it('marks runway covered when UoZ covers expenses', () => {
    const breakdown = computeIncomeBreakdown([
      { source_type: 'salary', amount_monthly: 9000, is_active: true },
    ]);
    const runway = computeRunwayFloor(20000, 6000, breakdown);
    expect(runway.baseCoversExpenses).toBe(true);
    expect(runway.runwayWithoutDealMonths).toBe(null);
  });
});

describe('cashflow calendar', () => {
  it('aggregates inflows and outflows for month', () => {
    const summary = buildCashflowMonth(2026, 7, [
      { kind: 'income', name: 'UoZ', amount: 4000, day: 10 },
      { kind: 'bill', name: 'Czynsz', amount: 2000, day: 5 },
    ], 10000);
    expect(summary.totalIn).toBe(4000);
    expect(summary.totalOut).toBe(2000);
    expect(summary.projectedEndBalance).toBe(12000);
  });
});
