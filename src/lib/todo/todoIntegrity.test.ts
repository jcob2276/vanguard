import { describe, expect, it } from 'vitest';
import { normalizeTodoSchedule } from './todoIntegrity';

describe('normalizeTodoSchedule', () => {
  it('derives the Warsaw due date from a scheduled timestamp', () => {
    expect(normalizeTodoSchedule<{ scheduled_time: string; due_date?: string | null }>({ scheduled_time: '2026-07-19T00:30:00+02:00' }).due_date).toBe('2026-07-19');
  });

  it('clears time when a task becomes undated', () => {
    expect(normalizeTodoSchedule({ due_date: null, scheduled_time: '2026-07-19T09:00:00+02:00' }).scheduled_time).toBeNull();
    expect(normalizeTodoSchedule({ due_date: null, scheduled_time: null }).scheduled_time).toBeNull();
  });

  it('rejects invalid titles, recurrence and duration', () => {
    expect(() => normalizeTodoSchedule({ title: '  ' })).toThrow('nazwę');
    expect(() => normalizeTodoSchedule({ recurrence: 'yearly', due_date: '2026-07-19' })).toThrow('powtarzania');
    expect(() => normalizeTodoSchedule({ duration_minutes: 0 })).toThrow('5 minut');
  });

  it('accepts useful recurrence patterns and protects deadline order', () => {
    expect(normalizeTodoSchedule({ recurrence: 'weekdays', due_date: '2026-07-20' }).recurrence).toBe('weekdays');
    expect(normalizeTodoSchedule({ recurrence: 'biweekly', due_date: '2026-07-20' }).recurrence).toBe('biweekly');
    expect(() => normalizeTodoSchedule({ due_date: '2026-07-20', deadline_date: '2026-07-19' })).toThrow('Termin końcowy');
  });
});
