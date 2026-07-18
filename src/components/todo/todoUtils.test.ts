import { describe, expect, it } from 'vitest';
import { matchesSmartQuery, type SmartQueryItem } from './todoUtils';

const item: SmartQueryItem = {
  id: '1', title: 'Raport', priority: 'high', tags: ['praca'], due_date: '2026-07-18',
  section_id: null, status: 'open', duration_minutes: 90,
  scheduled_time: '2026-07-18T10:00:00+02:00', reminder_at: null,
};

describe('matchesSmartQuery', () => {
  it('supports saved views for duration, scheduling and reminders', () => {
    expect(matchesSmartQuery('duration:deep scheduled:yes reminder:no', item, '2026-07-18', {})).toBe(true);
    expect(matchesSmartQuery('duration:short', item, '2026-07-18', {})).toBe(false);
    expect(matchesSmartQuery('reminder:yes', item, '2026-07-18', {})).toBe(false);
  });
});
