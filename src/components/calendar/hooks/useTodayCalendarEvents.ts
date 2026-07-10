import { useEffect, useState } from 'react';
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
  const [events, setEvents] = useState<TodayCalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!userId) return;
    const today = day || getTodayWarsaw();
    const { fromISO, toISO } = warsawDayBoundsISO(today);
    let cancelled = false;
    void (async () => {
      setLoading(true);
      supabase
        .from('vanguard_calendar')
        .select('id, summary, start_time, end_time, category')
        .eq('user_id', userId)
        .gte('start_time', fromISO)
        .lte('start_time', toISO)
        .order('start_time', { ascending: true })
        .then(({ data }) => {
          if (cancelled) return;
          setEvents((data as TodayCalEvent[]) || []);
          setLoading(false);
        });
    })();
    return () => { cancelled = true; };
  }, [userId, day]);

  // Keep "teraz"/past styling fresh without depending on an unrelated re-render.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const isActive = (e: TodayCalEvent) => nowMs >= new Date(e.start_time).getTime() && nowMs <= new Date(e.end_time).getTime();
  const isPast = (e: TodayCalEvent) => nowMs > new Date(e.end_time).getTime();

  return { events, loading, nowMs, isActive, isPast };
}
