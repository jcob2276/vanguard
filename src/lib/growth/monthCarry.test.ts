import { describe, expect, it } from 'vitest';
import { monthCarryToWeekPlan } from './monthCarry';
import type { MonthFacts } from './monthReview';

const facts: MonthFacts = {
  monthStart: '2026-05-01',
  monthEnd: '2026-05-31',
  monthLabel: 'maj 2026',
  weeksInMonth: 5,
  weeksReviewed: 4,
  powerListDone: 40,
  powerListPlanned: 50,
  powerListZ: 12,
  powerListP: 3,
  kpiWeeksLogged: 4,
  pillarAverages: { cialo: 5, duch: 8, konto: 6 },
  activeProjectCount: 2,
};

describe('monthCarryToWeekPlan', () => {
  it('carries theme, correction and pillar hints', () => {
    const plan = monthCarryToWeekPlan(
      {
        month_theme: 'Pipeline przed perfekcją',
        correction_note: 'Więcej snu',
        leverage_note: 'Deep work rano',
      },
      facts,
    );
    expect(plan.intention).toBe('Pipeline przed perfekcją');
    expect(plan.commitment).toBe('Więcej snu');
    expect(plan.cialo).toBe('Więcej snu');
    expect(plan.duch).toBe('Deep work rano');
  });
});
