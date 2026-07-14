import { TIMEZONE } from '../../lib/date';
import { Clock } from 'lucide-react';
import { useTodayCalendarEvents } from '../calendar/hooks/useTodayCalendarEvents';

const CAT_DOT: Record<string, string> = {
  work:     'bg-info',
  health:   'bg-success',
  sport:    'bg-warning',
  personal: 'bg-primary',
  study:    'bg-warning',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE });
}

export default function TodayEventsPanel({ userId, today }: { userId: string; today: string }) {
  const { events, loading, isActive, isPast } = useTodayCalendarEvents(userId, today);

  return (
    <div className="hidden lg:flex flex-col w-72 shrink-0 border-l border-border-custom/20 bg-background/60 h-full overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-border-custom/10">
        <p className="text-xs font-black uppercase tracking-widest text-text-muted/50">Kalendarz dziś</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {loading && (
          <p className="text-xs text-text-muted/40 text-center py-8">Ładuję…</p>
        )}
        {!loading && events.length === 0 && (
          <p className="text-xs text-text-muted/30 text-center py-8 italic">Brak wydarzeń</p>
        )}
        {!loading && events.map((ev) => {
          const active = isActive(ev);
          const past = isPast(ev);
          const dot = ev.category ? (CAT_DOT[ev.category.toLowerCase()] ?? 'bg-primary/60') : 'bg-primary/60';

          return (
            <div
              key={ev.id}
              className={`flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition-all ${
                active
                  ? 'bg-primary/8 border border-primary/20'
                  : past
                  ? 'opacity-[var(--opacity-35)]'
                  : 'hover:bg-surface-solid/30'
              }`}
            >
              <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dot} ${past ? 'opacity-[var(--opacity-40)]' : ''}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-semibold leading-snug ${active ? 'text-primary' : 'text-text-primary'} line-clamp-2`}>
                  {ev.summary || '—'}
                </p>
                <p className="text-2xs text-text-muted/50 mt-0.5 flex items-center gap-0.5 tabular-nums">
                  <Clock size={7} />
                  {fmt(ev.start_time)} – {fmt(ev.end_time)}
                </p>
              </div>
              {active && (
                <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-2xs font-black text-primary">TERAZ</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
