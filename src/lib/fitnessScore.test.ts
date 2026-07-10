import { describe, expect, it } from 'vitest';
import { computeHabitConsistency, last7DayKeys } from '@vanguard/domain';

describe('last7DayKeys', () => {
  it('returns 7 days ending on today', () => {
    expect(last7DayKeys('2026-06-27')).toEqual([
      '2026-06-21',
      '2026-06-22',
      '2026-06-23',
      '2026-06-24',
      '2026-06-25',
      '2026-06-26',
      '2026-06-27',
    ]);
  });
});

describe('computeHabitConsistency', () => {
  const lenie = { id: 'h1', name: 'Lenie', is_positive: false };
  const meditate = { id: 'h2', name: 'Medytacja', is_positive: true };

  it('counts clean days for negative habits', () => {
    const result = computeHabitConsistency(
      [lenie],
      [
        { habit_id: 'h1', date: '2026-06-21', completed: true },
        { habit_id: 'h1', date: '2026-06-24', completed: true },
        { habit_id: 'h1', date: '2026-06-26', completed: true },
        { habit_id: 'h1', date: '2026-06-20', completed: true },
      ],
      '2026-06-27',
    );

    expect(result.breakdown[0]).toMatchObject({ name: 'Lenie', success: 4, total: 7, isPositive: false });
    expect(result.successTotal).toBe(4);
    expect(result.slotTotal).toBe(7);
    expect(result.habitRate).toBeCloseTo(4 / 7);
    expect(result.summaryLabel).toBe('Lenie: 4/7 (dni czyste)');
  });

  it('counts completed days for positive habits', () => {
    const result = computeHabitConsistency(
      [meditate],
      [
        { habit_id: 'h2', date: '2026-06-21', completed: true },
        { habit_id: 'h2', date: '2026-06-22', completed: true },
        { habit_id: 'h2', date: '2026-06-25', completed: true },
      ],
      '2026-06-27',
    );

    expect(result.breakdown[0]).toMatchObject({ name: 'Medytacja', success: 3, total: 7, isPositive: true });
    expect(result.summaryLabel).toBe('Medytacja: 3/7');
  });

  it('aggregates mixed positive and negative habits', () => {
    const result = computeHabitConsistency(
      [lenie, meditate],
      [
        { habit_id: 'h1', date: '2026-06-26', completed: true },
        { habit_id: 'h2', date: '2026-06-26', completed: true },
        { habit_id: 'h2', date: '2026-06-27', completed: true },
      ],
      '2026-06-27',
    );

    expect(result.successTotal).toBe(8);
    expect(result.slotTotal).toBe(14);
    expect(result.summaryLabel).toContain('Lenie: 6/7 (dni czyste)');
    expect(result.summaryLabel).toContain('Medytacja: 2/7');
  });
});
