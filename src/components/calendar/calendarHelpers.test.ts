import { describe, it, expect } from 'vitest';
import { getWarsawOffset } from './calendarHelpers';

describe('getWarsawOffset', () => {
  it('returns +01:00 for winter standard time (January)', () => {
    // January 15, 2026 is standard time in Poland (UTC+1)
    const winterDate = new Date('2026-01-15T12:00:00Z');
    expect(getWarsawOffset(winterDate)).toBe('+01:00');
  });

  it('returns +02:00 for summer daylight saving time (July)', () => {
    // July 15, 2026 is DST in Poland (UTC+2)
    const summerDate = new Date('2026-07-15T12:00:00Z');
    expect(getWarsawOffset(summerDate)).toBe('+02:00');
  });

  it('correctly handles the start of DST transition day (March 29, 2026)', () => {
    // In Poland, standard time (+01:00) ends at 02:00 local time (01:00 UTC) on last Sunday of March.
    // 00:30 UTC -> 01:30 Warsaw local time (still +01:00)
    const preTransition = new Date('2026-03-29T00:30:00Z');
    expect(getWarsawOffset(preTransition)).toBe('+01:00');

    // 01:30 UTC -> 03:30 Warsaw local time (now +02:00, clocks went forward at 01:00 UTC)
    const postTransition = new Date('2026-03-29T01:30:00Z');
    expect(getWarsawOffset(postTransition)).toBe('+02:00');
  });

  it('correctly handles the end of DST transition day (October 25, 2026)', () => {
    // In Poland, DST (+02:00) ends at 03:00 local time (01:00 UTC) on last Sunday of October.
    // 00:30 UTC -> 02:30 Warsaw local time (still +02:00)
    const preTransition = new Date('2026-10-25T00:30:00Z');
    expect(getWarsawOffset(preTransition)).toBe('+02:00');

    // 02:30 UTC -> 03:30 Warsaw local time (now +01:00, clocks went back at 01:00 UTC)
    const postTransition = new Date('2026-10-25T02:30:00Z');
    expect(getWarsawOffset(postTransition)).toBe('+01:00');
  });

  it('throws an error if an invalid date is passed', () => {
    expect(() => getWarsawOffset('invalid-date-string')).toThrow();
  });
});
