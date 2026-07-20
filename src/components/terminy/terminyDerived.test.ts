import { describe, expect, it } from 'vitest';
import type { LifeObligation } from '../../lib/lifeObligationsApi';
import {
  bucketMap,
  countdownLabel,
  deriveAll,
  deriveObligation,
  filterByKind,
  initialsFrom,
  ringProgress,
  urgencyBucket,
} from './terminyDerived';

function obl(partial: Partial<LifeObligation> & Pick<LifeObligation, 'id' | 'title' | 'kind' | 'anchor_date'>): LifeObligation {
  return {
    user_id: 'u1',
    related_name: null,
    recurrence: 'yearly',
    lead_offsets: [-14, -7, 0],
    notes: null,
    is_active: true,
    sent_reminders: [],
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

describe('terminyDerived', () => {
  const today = '2026-07-20';

  it('buckets by urgency', () => {
    expect(urgencyBucket(0)).toBe('today');
    expect(urgencyBucket(3)).toBe('week');
    expect(urgencyBucket(20)).toBe('month');
    expect(urgencyBucket(45)).toBe('later');
  });

  it('ring progresses toward occurrence', () => {
    expect(ringProgress(0)).toBe(1);
    expect(ringProgress(90)).toBe(0.08);
    expect(ringProgress(45)).toBeCloseTo(0.5, 1);
  });

  it('derives and sorts by days left', () => {
    const rows = deriveAll([
      obl({ id: '1', title: 'Far', kind: 'document', anchor_date: '2026-12-01' }),
      obl({ id: '2', title: 'Soon', kind: 'people', anchor_date: '2026-07-25' }),
      obl({ id: '3', title: 'Today', kind: 'vehicle', anchor_date: '2026-07-20' }),
    ], today);
    expect(rows.map((r) => r.item.id)).toEqual(['3', '2', '1']);
    expect(rows[0].bucket).toBe('today');
    expect(rows[1].bucket).toBe('week');
  });

  it('builds bucket map', () => {
    const rows = deriveAll([
      obl({ id: '1', title: 'A', kind: 'people', anchor_date: '2026-07-20' }),
      obl({ id: '2', title: 'B', kind: 'people', anchor_date: '2026-08-10' }),
    ], today);
    const map = bucketMap(rows);
    expect(map.today).toHaveLength(1);
    expect(map.month).toHaveLength(1);
  });

  it('filters vault kind', () => {
    const rows = deriveAll([
      obl({ id: '1', title: 'A', kind: 'people', anchor_date: '2026-08-01' }),
      obl({ id: '2', title: 'B', kind: 'vehicle', anchor_date: '2026-08-01' }),
    ], today);
    expect(filterByKind(rows, 'vehicle')).toHaveLength(1);
  });

  it('initials and countdown labels', () => {
    expect(initialsFrom('Urodziny Mama', 'Anna Kowalska')).toBe('AK');
    expect(initialsFrom('OC', null)).toBe('OC');
    expect(countdownLabel(0)).toBe('Dziś');
    expect(countdownLabel(1)).toBe('Jutro');
    expect(countdownLabel(12)).toBe('12 dni');
  });

  it('returns null for expired once', () => {
    expect(deriveObligation(obl({
      id: 'x',
      title: 'Old',
      kind: 'document',
      anchor_date: '2026-01-01',
      recurrence: 'once',
    }), today)).toBeNull();
  });
});
