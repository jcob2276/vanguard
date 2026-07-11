import { describe, it, expect } from 'vitest';
import { parseTodoQuickInput } from './todoParser';

// Fixed anchor date: Monday 2024-01-08 (week: Mon=1, Tue=2, ..., Sun=0)
const MONDAY = new Date('2024-01-08T10:00:00');

describe('parseTodoQuickInput', () => {
  describe('recurrence tokens', () => {
    it('parses "codziennie" as daily recurrence', () => {
      const result = parseTodoQuickInput('wynieś śmieci codziennie', MONDAY);
      expect(result.recurrence).toBe('daily');
      expect(result.tokens.some(t => t.type === 'recurrence')).toBe(true);
      expect(result.title).not.toContain('codziennie');
    });

    it('parses "co tydzień" as weekly recurrence', () => {
      const result = parseTodoQuickInput('spotkanie co tydzień', MONDAY);
      expect(result.recurrence).toBe('weekly');
    });

    it('parses "co miesiąc" as monthly recurrence', () => {
      const result = parseTodoQuickInput('płatność co miesiąc', MONDAY);
      expect(result.recurrence).toBe('monthly');
    });

    it('adds today as default due_date when recurrence is set and no date given', () => {
      const result = parseTodoQuickInput('wynieś śmieci codziennie', MONDAY);
      expect(result.due_date).toBe('2024-01-08');
    });

    it('does not override explicit date with recurrence default', () => {
      const result = parseTodoQuickInput('spotkanie jutro co tydzień', MONDAY);
      expect(result.due_date).toBe('2024-01-09'); // jutro = tomorrow, not today
      expect(result.recurrence).toBe('weekly');
    });

    it('recurrence type token is typed as "recurrence" not "any"', () => {
      const result = parseTodoQuickInput('wynieś śmieci codziennie', MONDAY);
      const recurrenceToken = result.tokens.find(t => t.type === 'recurrence');
      expect(recurrenceToken).toBeDefined();
      expect(recurrenceToken?.type).toBe('recurrence');
    });
  });

  describe('priority tokens', () => {
    it('parses p1 as urgent priority', () => {
      const result = parseTodoQuickInput('ważna sprawa p1', MONDAY);
      expect(result.priority).toBe('urgent');
      expect(result.title).not.toContain('p1');
    });

    it('parses p4 as low priority', () => {
      const result = parseTodoQuickInput('coś nieważnego p4', MONDAY);
      expect(result.priority).toBe('low');
    });
  });

  describe('date tokens', () => {
    it('parses "jutro" as next day', () => {
      const result = parseTodoQuickInput('zadzwonić jutro', MONDAY);
      expect(result.due_date).toBe('2024-01-09');
      expect(result.title).toBe('zadzwonić');
    });

    it('parses "dzisiaj" as today', () => {
      const result = parseTodoQuickInput('zapłacić dzisiaj', MONDAY);
      expect(result.due_date).toBe('2024-01-08');
    });

    it('parses weekday names', () => {
      const result = parseTodoQuickInput('meeting piątek', MONDAY);
      // Next Friday from Monday 2024-01-08 is 2024-01-12
      expect(result.due_date).toBe('2024-01-12');
    });
  });

  describe('duration tokens', () => {
    it('parses "30min" as 30 minutes', () => {
      const result = parseTodoQuickInput('siłownia 30min', MONDAY);
      expect(result.duration_minutes).toBe(30);
    });

    it('parses "1.5h" as 90 minutes', () => {
      const result = parseTodoQuickInput('bieganie 1.5h', MONDAY);
      expect(result.duration_minutes).toBe(90);
    });
  });

  describe('combined parsing', () => {
    it('handles multiple tokens in one input', () => {
      const result = parseTodoQuickInput('sprint review jutro o 14 1h p2', MONDAY);
      expect(result.title).toBe('sprint review');
      expect(result.due_date).toBe('2024-01-09');
      expect(result.scheduled_time).toBe('14:00');
      expect(result.duration_minutes).toBe(60);
      expect(result.priority).toBe('high');
    });

    it('returns null priority and date for plain text', () => {
      const result = parseTodoQuickInput('kup chleb', MONDAY);
      expect(result.priority).toBeNull();
      expect(result.due_date).toBeNull();
      expect(result.recurrence).toBeNull();
      expect(result.title).toBe('kup chleb');
    });

    it('handles null/undefined input gracefully', () => {
      expect(() => parseTodoQuickInput(null)).not.toThrow();
      expect(() => parseTodoQuickInput(undefined)).not.toThrow();
      expect(parseTodoQuickInput(null).title).toBe('');
    });
  });
});
