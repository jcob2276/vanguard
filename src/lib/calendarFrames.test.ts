import { describe, expect, it } from 'vitest';
import { evaluatePlanningFrame } from './calendarFrames';

const frame = {
  preferred_days: [1, 3, 5],
  preferred_start: '09:00:00',
  preferred_end: '12:00:00',
  frame_strength: 'prefer',
};

describe('evaluatePlanningFrame', () => {
  it('matches a preferred weekday and time', () => {
    expect(evaluatePlanningFrame(frame, '2026-07-20', 10 * 60).matches).toBe(true);
  });

  it('explains a weekday mismatch', () => {
    expect(evaluatePlanningFrame(frame, '2026-07-21', 10 * 60).reason).toContain('dzień');
  });

  it('explains a time mismatch', () => {
    expect(evaluatePlanningFrame(frame, '2026-07-20', 8 * 60).reason).toContain('09:00');
  });
});

