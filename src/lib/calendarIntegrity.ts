export interface CalendarEventInput {
  id?: string;
  summary: string;
  start: string;
  end: string;
  description?: string;
  category?: string;
  recurrence?: string[] | null;
}

export function normalizeCalendarEvent<T extends CalendarEventInput>(event: T): T {
  const summary = event.summary.trim();
  if (!summary) throw new Error('Wydarzenie musi mieć nazwę.');

  const start = new Date(event.start);
  const end = new Date(event.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Data wydarzenia jest nieprawidłowa.');
  }
  if (end <= start) throw new Error('Koniec wydarzenia musi być po jego rozpoczęciu.');

  const recurrence = event.recurrence?.filter(Boolean);
  if (recurrence?.some((rule) => !rule.startsWith('RRULE:'))) {
    throw new Error('Nieprawidłowa reguła powtarzania wydarzenia.');
  }

  return {
    ...event,
    summary,
    description: event.description?.trim() || undefined,
    recurrence: event.recurrence === null ? null : recurrence?.length ? recurrence : undefined,
  };
}
