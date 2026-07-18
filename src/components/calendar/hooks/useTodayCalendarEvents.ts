import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTodayWarsaw, warsawDayBoundsISO } from '../../../lib/date';
import { fetchCalendarAgenda, type CalendarAgendaEvent } from '../../../lib/calendarAgendaApi';

export function useTodayCalendarEvents(userId: string | undefined, day?: string) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  const today = day || getTodayWarsaw();
  const { fromISO, toISO } = warsawDayBoundsISO(today);

  const { data: events = [], isLoading: loading } = useQuery<CalendarAgendaEvent[]>({
    queryKey: ['today-calendar-events', userId, today],
    queryFn: () => userId ? fetchCalendarAgenda(userId, fromISO, toISO) : Promise.resolve([]),
    enabled: !!userId,
  });

  // Keep "teraz"/past styling fresh without depending on an unrelated re-render.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const isActive = (e: CalendarAgendaEvent) => nowMs >= new Date(e.start_time).getTime() && nowMs <= new Date(e.end_time).getTime();
  const isPast = (e: CalendarAgendaEvent) => nowMs > new Date(e.end_time).getTime();

  return { events, loading, nowMs, isActive, isPast };
}
