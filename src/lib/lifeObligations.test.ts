import { describe, expect, it } from 'vitest';
import {
  dueLeadOffsetsToday,
  leadLabel,
  nextOccurrence,
  reminderKey,
} from '@vanguard/domain';

describe('lifeObligations', () => {
  it('computes next yearly occurrence', () => {
    expect(nextOccurrence('1990-03-15', 'yearly', '2026-03-01')).toBe('2026-03-15');
    expect(nextOccurrence('1990-03-15', 'yearly', '2026-03-15')).toBe('2026-03-15');
    expect(nextOccurrence('1990-03-15', 'yearly', '2026-03-16')).toBe('2027-03-15');
  });

  it('handles once recurrence', () => {
    expect(nextOccurrence('2026-08-01', 'once', '2026-07-01')).toBe('2026-08-01');
    expect(nextOccurrence('2026-06-01', 'once', '2026-07-01')).toBeNull();
  });

  it('fires lead offsets on the correct day', () => {
    const obl = {
      anchor_date: '2026-08-20',
      recurrence: 'yearly',
      lead_offsets: [-14, -7, 0],
      sent_reminders: [],
    };
    expect(dueLeadOffsetsToday(obl, '2026-08-06')).toEqual([
      { occurrence: '2026-08-20', offset: -14, key: reminderKey('2026-08-20', -14) },
    ]);
    expect(dueLeadOffsetsToday(obl, '2026-08-13')).toEqual([
      { occurrence: '2026-08-20', offset: -7, key: reminderKey('2026-08-20', -7) },
    ]);
    expect(dueLeadOffsetsToday({ ...obl, sent_reminders: ['2026-08-20:-14'] }, '2026-08-06')).toEqual([]);
  });

  it('formats lead labels', () => {
    expect(leadLabel(0)).toBe('w dniu');
    expect(leadLabel(-14)).toBe('14 dni wcześniej');
  });
});
