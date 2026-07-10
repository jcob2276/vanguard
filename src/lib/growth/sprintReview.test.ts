import { describe, expect, it } from 'vitest';
import { weekStartsInSprint } from './sprintReview';

describe('sprintReview', () => {
  it('weekStartsInSprint returns 12 Monday week_starts', () => {
    const weeks = weekStartsInSprint('2026-03-03');
    expect(weeks).toHaveLength(12);
    expect(weeks[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(weeks[11]).toBe('2026-05-18');
  });
});
