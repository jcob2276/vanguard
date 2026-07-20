import { formatWarsawDate } from './date.ts';

const RECURRENCES = new Set(['daily', 'weekdays', 'weekly', 'biweekly', 'monthly']);

export interface TodoScheduleFields {
  title?: string | null;
  due_date?: string | null;
  deadline_date?: string | null;
  scheduled_time?: string | null;
  recurrence?: string | null;
  duration_minutes?: number | null;
}

export function normalizeTodoSchedule<T extends TodoScheduleFields>(fields: T): T {
  const normalized = { ...fields };

  if ('title' in normalized) {
    const title = normalized.title?.trim();
    if (!title) throw new Error('Zadanie musi mieć nazwę.');
    normalized.title = title;
  }

  if ('due_date' in normalized && normalized.due_date === null) {
    normalized.scheduled_time = null;
  } else if (normalized.scheduled_time) {
    const scheduled = new Date(normalized.scheduled_time);
    if (Number.isNaN(scheduled.getTime())) throw new Error('Nieprawidłowa godzina zadania.');
    normalized.due_date = formatWarsawDate(scheduled);
  }

  if (normalized.recurrence && !RECURRENCES.has(normalized.recurrence)) {
    throw new Error('Nieobsługiwany sposób powtarzania zadania.');
  }
  if (normalized.recurrence && 'due_date' in normalized && !normalized.due_date) {
    throw new Error('Powtarzające się zadanie wymaga daty.');
  }
  if (normalized.deadline_date && normalized.due_date && normalized.deadline_date < normalized.due_date) {
    throw new Error('Termin końcowy nie może być wcześniejszy niż zaplanowany dzień.');
  }
  if (normalized.duration_minutes != null && (normalized.duration_minutes < 5 || normalized.duration_minutes > 1440)) {
    throw new Error('Czas zadania musi wynosić od 5 minut do 24 godzin.');
  }

  return normalized;
}
