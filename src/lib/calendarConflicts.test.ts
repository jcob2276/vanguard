import { describe, expect, it } from 'vitest';
import { findCalendarConflicts } from './calendarConflicts';

const event = { id: 'one', summary: 'Rozmowa', start_time: '2026-07-18T10:00:00', end_time: '2026-07-18T11:00:00' };

describe('findCalendarConflicts', () => {
  it('finds a real overlap but allows adjacent events', () => {
    expect(findCalendarConflicts([event], new Date('2026-07-18T10:30:00').getTime(), new Date('2026-07-18T11:30:00').getTime())).toHaveLength(1);
    expect(findCalendarConflicts([event], new Date('2026-07-18T11:00:00').getTime(), new Date('2026-07-18T12:00:00').getTime())).toHaveLength(0);
  });

  it('excludes the event being edited', () => {
    expect(findCalendarConflicts([event], new Date('2026-07-18T10:00:00').getTime(), new Date('2026-07-18T11:00:00').getTime(), 'one')).toHaveLength(0);
  });
});
