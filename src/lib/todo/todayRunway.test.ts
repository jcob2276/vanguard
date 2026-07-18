import { describe, expect, it } from 'vitest';
import { buildTodayRunway } from './todayRunway';

describe('buildTodayRunway', () => {
  it('prefers an active calendar event and orders upcoming work', () => {
    const now = new Date('2026-07-18T10:00:00Z').getTime();
    const result = buildTodayRunway([
      { id: 'loose', title: 'Kup mleko', status: 'open', scheduled_time: null, duration_minutes: 5 },
      { id: 'task', title: 'Raport', status: 'open', scheduled_time: '2026-07-18T11:00:00Z', duration_minutes: 30 },
    ], [{ id: 'event', summary: 'Spotkanie', category: null, start_time: '2026-07-18T09:30:00Z', end_time: '2026-07-18T10:30:00Z' }], now);

    expect(result.now?.title).toBe('Spotkanie');
    expect(result.next.map((item) => item.title)).toEqual(['Raport', 'Kup mleko']);
  });

  it('uses an untimed task when nothing is active', () => {
    const result = buildTodayRunway([
      { id: 'one', title: 'Telefon', status: 'open', scheduled_time: null, duration_minutes: 10 },
    ], [], Date.now());
    expect(result.now?.title).toBe('Telefon');
    expect(result.next).toEqual([]);
  });
});
