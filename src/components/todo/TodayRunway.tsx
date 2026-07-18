import { CalendarDays, CheckSquare2, ChevronRight } from 'lucide-react';
import { TIMEZONE } from '../../lib/date';
import { buildTodayRunway, type RunwayItem } from '../../lib/todo/todayRunway';
import { useTodayCalendarEvents } from '../calendar/hooks/useTodayCalendarEvents';
import { Pressable } from '../ui/ControlPrimitives';
import { useTodoContext } from './context/TodoContext';

function formatTime(ms: number | null) {
  if (!ms) return null;
  return new Date(ms).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE });
}

function ItemIcon({ kind }: Pick<RunwayItem, 'kind'>) {
  return kind === 'event' ? <CalendarDays size={15} /> : <CheckSquare2 size={15} />;
}

export default function TodayRunway() {
  const { userId, today, todayItems, toggleExpand } = useTodoContext();
  const { events, nowMs } = useTodayCalendarEvents(userId, today);
  const runway = buildTodayRunway(todayItems, events, nowMs);
  if (!runway.now) return null;

  const open = (item: RunwayItem) => item.kind === 'task' && toggleExpand(item.id);

  return (
    <section className="mb-3 overflow-hidden rounded-2xl border border-border-custom/35 bg-surface-solid/25">
      <Pressable onClick={() => open(runway.now!)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-surface-solid/45">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ItemIcon kind={runway.now.kind} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-2xs font-black uppercase tracking-widest text-primary/70">Teraz</span>
          <span className="block truncate text-sm font-semibold text-text-primary">{runway.now.title}</span>
        </span>
        {runway.now.startMs && <span className="text-xs tabular-nums text-text-muted">{formatTime(runway.now.startMs)}</span>}
        {runway.now.kind === 'task' && <ChevronRight size={16} className="text-text-muted/50" />}
      </Pressable>
      {runway.next.length > 0 && (
        <div className="border-t border-border-custom/20 px-3.5 py-2.5">
          <p className="mb-1.5 text-2xs font-black uppercase tracking-widest text-text-muted/45">Następnie</p>
          <div className="space-y-1.5">
            {runway.next.map((item) => (
              <Pressable key={`${item.kind}-${item.id}`} onClick={() => open(item)} className="flex w-full items-center gap-2 py-0.5 text-left">
                <span className="text-text-muted/55"><ItemIcon kind={item.kind} /></span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-text-primary/80">{item.title}</span>
                {item.startMs && <span className="text-2xs tabular-nums text-text-muted/55">{formatTime(item.startMs)}</span>}
              </Pressable>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
