import { TIMEZONE } from '../../lib/date';
import { CalendarDays } from 'lucide-react';
import { useTodayCalendarEvents } from '../calendar/hooks/useTodayCalendarEvents';
import { useUserId } from '../../store/useStore';
import Badge from '../ui/Badge';

export default function TodayEventsCard() {
  const userId = useUserId();
  const { events, isActive, isPast } = useTodayCalendarEvents(userId);

  if (!events.length) {
    return (
      <section className="animate-fadeIn card p-4">
        <div className="flex items-center gap-2 mb-2">
          <CalendarDays size={12} className="text-text-muted" />
          <p className="text-2xs font-black uppercase tracking-[var(--ds-arbitrary-0-22em)] text-text-muted font-display">Dziś w kalendarzu</p>
        </div>
        <p className="text-sm text-text-muted">Brak wydarzeń — sync kalendarza w ustawieniach / Fundament.</p>
      </section>
    );
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE });

  return (
    <section className="animate-fadeIn card p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <CalendarDays size={12} className="text-text-muted" />
        <p className="text-2xs font-black uppercase tracking-[var(--ds-arbitrary-0-22em)] text-text-muted font-display">Dziś w kalendarzu</p>
      </div>
      <div className="space-y-1.5">
        {events.map((e) => {
          const active = isActive(e);
          const past = isPast(e);
          return (
            <div key={e.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all ${
              active
                ? 'bg-primary/10 border-l-2 border-l-primary border-y border-r border-primary/10'
                : past
                ? 'opacity-[var(--opacity-40)] border-l-2 border-l-text-muted/30 border-y border-r border-border-custom/50'
                : 'bg-surface-solid/40 border-l-2 border-l-text-muted/50 border-y border-r border-border-custom/30'
            }`}>
              <div className={`shrink-0 text-xs font-black tabular-nums ${active ? 'text-primary' : 'text-text-muted'}`}>
                {fmt(e.start_time)}
              </div>
              <div className={`min-w-0 flex-1 text-sm font-semibold truncate ${active ? 'text-text-primary' : 'text-text-secondary'}`}>
                {e.summary}
              </div>
              {active && (
                <Badge variant="tag" className="shrink-0 flex items-center gap-1 text-2xs font-black">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  teraz
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
