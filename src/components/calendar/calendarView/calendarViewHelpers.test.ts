import { describe, expect, it } from 'vitest';
import { buildRecurrenceRule, parseRecurrenceRule } from './calendarViewHelpers';

describe('calendar recurrence rules', () => {
  it('round-trips a custom weekly rule with an end date', () => {
    const rules = buildRecurrenceRule('custom', ['MO', 'WE', 'FR'], '2026-12-31');
    expect(parseRecurrenceRule(rules)).toEqual({
      recurrence: 'custom',
      customDays: ['MO', 'WE', 'FR'],
      endDate: '2026-12-31',
    });
  });

  it('parses simple recurrence and empty state', () => {
    expect(parseRecurrenceRule(['RRULE:FREQ=MONTHLY'])).toEqual({
      recurrence: 'monthly', customDays: [], endDate: '',
    });
    expect(parseRecurrenceRule(null)).toEqual({
      recurrence: '', customDays: [], endDate: '',
    });
  });
});
