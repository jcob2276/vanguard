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

    it.each([
      ['raport za tydzień o 12', '2024-01-15', '12:00'],
      ['raport za 3 dni', '2024-01-11', null],
      ['raport za 2 tygodnie', '2024-01-22', null],
      ['raport za 2 miesiące', '2024-03-08', null],
    ])('parses relative date in "%s"', (input, dueDate, scheduledTime) => {
      const result = parseTodoQuickInput(input, MONDAY);
      expect(result.title).toBe('raport');
      expect(result.due_date).toBe(dueDate);
      expect(result.scheduled_time).toBe(scheduledTime);
    });

    it.each(['urlop 18.07.2026', 'urlop 18 lipca 2026'])(
      'parses a full calendar date in "%s"',
      (input) => expect(parseTodoQuickInput(input, MONDAY).due_date).toBe('2026-07-18'),
    );

    it('does not accept an impossible date', () => {
      expect(parseTodoQuickInput('urlop 31.02.2026', MONDAY).due_date).toBeNull();
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

    it.each([
      ['trening 2 godziny 30 min', 150],
      ['telefon 45 minut', 45],
    ])('parses natural duration in "%s"', (input, duration) => {
      expect(parseTodoQuickInput(input, MONDAY).duration_minutes).toBe(duration);
    });
  });

  describe('natural language combinations', () => {
    it('turns a relative clock into date and time', () => {
      const result = parseTodoQuickInput('wyjść za 30 minut', MONDAY);
      expect(result.title).toBe('wyjść');
      expect(result.due_date).toBe('2024-01-08');
      expect(result.scheduled_time).toBe('10:30');
    });

    it.each([
      ['bieganie jutro rano', '2024-01-09', '08:00'],
      ['kolacja wieczorem', '2024-01-08', '18:00'],
    ])('parses a part of day in "%s"', (input, dueDate, scheduledTime) => {
      const result = parseTodoQuickInput(input, MONDAY);
      expect(result.due_date).toBe(dueDate);
      expect(result.scheduled_time).toBe(scheduledTime);
    });

    it('parses recurring weekday and hashtag', () => {
      const result = parseTodoQuickInput('raport co poniedziałek #praca', MONDAY);
      expect(result.title).toBe('raport');
      expect(result.due_date).toBe('2024-01-15');
      expect(result.recurrence).toBe('weekly');
      expect(result.tags).toEqual(['praca']);
    });

    it('parses a natural priority only as a trailing command', () => {
      expect(parseTodoQuickInput('opłacić fakturę pilne', MONDAY).priority).toBe('urgent');
      expect(parseTodoQuickInput('ważne dokumenty', MONDAY).priority).toBeNull();
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
