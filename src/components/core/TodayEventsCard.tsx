import { getTodayWarsaw, warsawDayBoundsISO } from '../../lib/date';
import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Event = { summary: string; start_time: string; end_time: string };

export default function TodayEventsCard({ session }: { session: any }) {
  const userId = session?.user?.id;
  const [events, setEvents] = useState<Event[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!userId) return;
    const today = getTodayWarsaw();
    const { fromISO: from, toISO: to } = warsawDayBoundsISO(today);
    supabase
      .from('vanguard_calendar')
      .select('summary, start_time, end_time')
      .eq('user_id', userId)
      .gte('start_time', from)
      .lte('start_time', to)
      .order('start_time', { ascending: true })
      .then(({ data }) => { if (data?.length) setEvents(data as Event[]); });
  }, [userId]);

  // Keep "teraz"/past styling fresh without depending on an unrelated re-render —
  // otherwise an event silently never flips to "active" until something else re-renders the page.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  if (!events.length) {
    return (
      <section className="animate-fadeIn rounded-[24px] border border-border-custom bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <CalendarDays size={12} className="text-text-muted" />
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-text-muted font-display">Dziś w kalendarzu</p>
        </div>
        <p className="text-[12px] text-text-muted">Brak wydarzeń — sync kalendarza w ustawieniach / Fundament.</p>
      </section>
    );
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' });

  const isActive = (e: Event) => nowMs >= new Date(e.start_time).getTime() && nowMs <= new Date(e.end_time).getTime();
  const isPast = (e: Event) => nowMs > new Date(e.end_time).getTime();

  return (
    <section className="animate-fadeIn rounded-[24px] border border-border-custom bg-surface p-4 shadow-sm space-y-2.5">
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
                <span className="shrink-0 flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-black text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  teraz
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
