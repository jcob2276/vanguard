import { describe, expect, it } from 'vitest';
import { calculateAvailableMinutes, formatMinutes } from './dayCapacity';

describe('day capacity', () => {
  it('subtracts breaks and events inside the day boundary', () => {
    const available = calculateAvailableMinutes({ start: '09:00', end: '18:00', breakMinutes: 60 }, [{
      id: 'meeting', summary: 'Meeting', category: null,
      start_time: '2026-07-18T12:00:00', end_time: '2026-07-18T13:00:00',
    }]);
    expect(available).toBe(420);
  });

  it('clips events crossing the boundary', () => {
    const available = calculateAvailableMinutes({ start: '09:00', end: '12:00', breakMinutes: 0 }, [{
      id: 'meeting', summary: 'Meeting', category: null,
      start_time: '2026-07-18T08:30:00', end_time: '2026-07-18T09:30:00',
    }]);
    expect(available).toBe(150);
    expect(formatMinutes(150)).toBe('2h 30m');
  });

  it('does not count overlapping events twice', () => {
    const base = { summary: 'Meeting', category: null };
    const available = calculateAvailableMinutes({ start: '09:00', end: '12:00', breakMinutes: 0 }, [
      { ...base, id: 'one', start_time: '2026-07-18T09:00:00', end_time: '2026-07-18T10:00:00' },
      { ...base, id: 'two', start_time: '2026-07-18T09:30:00', end_time: '2026-07-18T10:30:00' },
    ]);
    expect(available).toBe(90);
  });
});
