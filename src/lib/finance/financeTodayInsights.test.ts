import { describe, expect, it } from 'vitest';
import {
  buildBudgetProgress,
  buildCategorySlices,
  buildIncomeSummary,
} from './financeTodayInsights';

describe('financeTodayInsights', () => {
  it('builds category slices for current month expenses', () => {
    const slices = buildCategorySlices([
      {
        id: '1',
        user_id: 'u',
        amount: -100,
        category: 'Jedzenie',
        note: null,
        transaction_date: '2026-07-05',
        kind: 'expense',
        created_at: '',
      },
      {
        id: '2',
        user_id: 'u',
        amount: -50,
        category: 'Transport',
        note: null,
        transaction_date: '2026-07-10',
        kind: 'expense',
        created_at: '',
      },
    ], '2026-07');

    expect(slices).toHaveLength(2);
    expect(slices[0]?.category).toBe('Jedzenie');
    expect(slices[0]?.pct).toBeCloseTo(66.7, 0);
  });

  it('builds budget progress with over budget flag', () => {
    const progress = buildBudgetProgress({ effectiveExpenses: 1000, spentThisMonth: 1200 });
    expect(progress?.overBudget).toBe(true);
    expect(progress?.remaining).toBe(0);
  });

  it('summarizes income by uoz setter closer', () => {
    const lines = buildIncomeSummary([
      {
        id: '1',
        user_id: 'u',
        name: 'Etat',
        amount_monthly: 5000,
        source_type: 'salary',
        is_active: true,
        created_at: '',
      },
      {
        id: '2',
        user_id: 'u',
        name: 'Deale',
        amount_monthly: 3000,
        source_type: 'commission',
        is_active: true,
        created_at: '',
      },
    ]);

    expect(lines.find((l) => l.key === 'uoz')?.amount).toBe(5000);
    expect(lines.find((l) => l.key === 'closer')?.amount).toBe(3000);
  });
});
