import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getTodayWarsaw, formatWarsawDate } from './date';

describe('date utils (Warsaw timezone safety)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });


  it('formatWarsawDate should format a UTC Date correctly to Warsaw local YYYY-MM-DD', () => {
    // Date: 2026-06-21T23:30:00.000Z. Warsaw should be 2026-06-22T01:30:00 (next day)
    const dateToFormat = new Date('2026-06-21T23:30:00.000Z');
    const formatted = formatWarsawDate(dateToFormat);
    expect(formatted).toBe('2026-06-22');
  });

  it('formatWarsawDate should format a string/number input correctly', () => {
    const formattedStr = formatWarsawDate('2026-06-21T23:30:00.000Z');
    expect(formattedStr).toBe('2026-06-22');

    const formattedTimestamp = formatWarsawDate(new Date('2026-12-21T23:30:00.000Z').getTime());
    // In December, Warsaw is UTC+1, so 23:30 + 1 hour is 00:30 next day
    expect(formattedTimestamp).toBe('2026-12-22');
  });

  it('getTodayWarsaw should return current local date in YYYY-MM-DD format', () => {
    // Summer DST: 2026-06-21 23:30:00 UTC -> Warsaw is 2026-06-22 01:30:00
    vi.setSystemTime(new Date('2026-06-21T23:30:00.000Z'));
    expect(getTodayWarsaw()).toBe('2026-06-22');

    // Winter standard: 2026-12-21 23:30:00 UTC -> Warsaw is 2026-12-22 00:30:00
    vi.setSystemTime(new Date('2026-12-21T23:30:00.000Z'));
    expect(getTodayWarsaw()).toBe('2026-12-22');
  });
});
