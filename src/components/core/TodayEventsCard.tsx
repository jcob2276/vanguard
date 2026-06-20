import { getTodayWarsaw } from '../../lib/date';
import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Event = { summary: string; start_time: string; end_time: string };

export default function TodayEventsCard({ session }: { session: any }) {
  const userId = session?.user?.id;
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (!userId) return;
    const today = getTodayWarsaw();
    const from = `${today}T00:00:00`;
    const to = `${today}T23:59:59`;
    supabase
      .from('vanguard_calendar')
      .select('summary, start_time, end_time')
      .eq('user_id', userId)
      .gte('start_time', from)
      .lte('start_time', to)
      .order('start_time', { ascending: true })
      .then(({ data }) => { if (data?.length) setEvents(data as Event[]); });
  }, [userId]);

  if (!events.length) return null;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' });

  const nowMs = Date.now();
  const isActive = (e: Event) => nowMs >= new Date(e.start_time).getTime() && nowMs <= new Date(e.end_time).getTime();
  const isPast = (e: Event) => nowMs > new Date(e.end_time).getTime();

  return (
    <section className="rounded-[24px] border border-border-custom bg-surface p-4 shadow-sm space-y-2.5">
      <div className="flex items-center gap-2">
        <CalendarDays size={12} className="text-text-muted" />
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-text-muted font-display">Dziś w kalendarzu</p>
      </div>
      <div className="space-y-1.5">
        {events.map((e, i) => {
          const active = isActive(e);
          const past = isPast(e);
          return (
            <div key={`${e.start_time}-${i}`} className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all ${
              active ? 'bg-primary/[0.07] border border-primary/20' : past ? 'opacity-40' : 'bg-surface-solid/30'
            }`}>
              <div className={`shrink-0 text-[10px] font-black tabular-nums ${active ? 'text-primary' : 'text-text-muted'}`}>
                {fmt(e.start_time)}
              </div>
              <div className={`min-w-0 flex-1 text-[12px] font-semibold truncate ${active ? 'text-text-primary' : 'text-text-secondary'}`}>
                {e.summary}
              </div>
              {active && (
                <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-black text-primary">teraz</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
