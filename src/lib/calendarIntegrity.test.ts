import { describe, expect, it } from 'vitest';
import { normalizeCalendarEvent } from './calendarIntegrity';

describe('normalizeCalendarEvent', () => {
  const base = { summary: ' Spotkanie ', start: '2026-07-19T10:00:00+02:00', end: '2026-07-19T11:00:00+02:00' };

  it('normalizes user text', () => {
    expect(normalizeCalendarEvent({ ...base, description: '  plan  ' })).toMatchObject({ summary: 'Spotkanie', description: 'plan' });
  });

  it('rejects empty, reversed and malformed events', () => {
    expect(() => normalizeCalendarEvent({ ...base, summary: ' ' })).toThrow('nazwę');
    expect(() => normalizeCalendarEvent({ ...base, end: base.start })).toThrow('po jego rozpoczęciu');
    expect(() => normalizeCalendarEvent({ ...base, recurrence: ['weekly'] })).toThrow('reguła');
  });
});
