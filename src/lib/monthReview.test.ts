import { describe, expect, it } from 'vitest';

import {
  closingMonthStartForReview,
  isMonthlyReviewDue,
  isFirstSundayMonthlyRitual,
  isMonthlyHardGate,
  isMonthlySoftCue,
  weekStartsInMonth,
} from './monthReview';

describe('monthReview timing', () => {
  it('closing month is previous calendar month during grace window', () => {
    expect(closingMonthStartForReview('2026-03-01')).toBe('2026-02-01');
    expect(closingMonthStartForReview('2026-03-14')).toBe('2026-02-01');
    expect(closingMonthStartForReview('2026-03-15')).toBeNull();
  });

  it('due when grace window and no completed review', () => {
    expect(isMonthlyReviewDue('2026-03-02', null)).toBe(true);
    expect(isMonthlyReviewDue('2026-03-02', { completed_at: '2026-03-01' })).toBe(false);
    expect(isMonthlyReviewDue('2026-03-20', null)).toBe(false);
  });

  it('hard gate only first 7 days of month', () => {
    expect(isMonthlyHardGate('2026-07-01')).toBe(true);
    expect(isMonthlyHardGate('2026-07-07')).toBe(true);
    expect(isMonthlyHardGate('2026-07-08')).toBe(false);
    expect(isMonthlySoftCue('2026-07-10')).toBe(true);
    expect(isMonthlySoftCue('2026-07-15')).toBe(false);
  });

  it('first Sunday ritual only in first week of month', () => {
    expect(isFirstSundayMonthlyRitual('2026-03-01')).toBe(true);
    expect(isFirstSundayMonthlyRitual('2026-03-08')).toBe(false);
    expect(isFirstSundayMonthlyRitual('2026-03-09')).toBe(false);
  });

  it('lists week starts overlapping month', () => {
    const weeks = weekStartsInMonth('2026-06-01');
    expect(weeks[0]).toBe('2026-05-25');
    expect(weeks).toContain('2026-06-01');
    expect(weeks).toContain('2026-06-29');
  });
});
