import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { getTodayWarsaw, warsawDayBoundsISO } from '../../../lib/date';

export interface TodayCalEvent {
  id: string;
  summary: string;
  start_time: string;
  end_time: string;
  category: string | null;
}

export function useTodayCalendarEvents(userId: string | undefined, day?: string) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  const today = day || getTodayWarsaw();
  const { fromISO, toISO } = warsawDayBoundsISO(today);

  const { data: events = [], isLoading: loading } = useQuery<TodayCalEvent[]>({
    queryKey: ['today-calendar-events', userId, today],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('vanguard_calendar')
        .select('id, summary, start_time, end_time, category')
        .eq('user_id', userId)
        .gte('start_time', fromISO)
        .lte('start_time', toISO)
        .order('start_time', { ascending: true });
      if (error) throw error;
      return (data as TodayCalEvent[]) || [];
    },
    enabled: !!userId,
  });

  // Keep "teraz"/past styling fresh without depending on an unrelated re-render.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const isActive = (e: TodayCalEvent) => nowMs >= new Date(e.start_time).getTime() && nowMs <= new Date(e.end_time).getTime();
  const isPast = (e: TodayCalEvent) => nowMs > new Date(e.end_time).getTime();

  return { events, loading, nowMs, isActive, isPast };
}
