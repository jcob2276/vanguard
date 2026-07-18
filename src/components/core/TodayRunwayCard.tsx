import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CheckSquare2, ChevronRight, Sunrise } from 'lucide-react';
import { useUserId } from '../../store/useStore';
import { listTodoItems } from '../../lib/todo/todo';
import { buildTodayRunway, type RunwayItem } from '../../lib/todo/todayRunway';
import { getTodayWarsaw, TIMEZONE } from '../../lib/date';
import { useTodayCalendarEvents } from '../calendar/hooks/useTodayCalendarEvents';
import { Pressable } from '../ui/ControlPrimitives';
import { todoKeys } from '../../lib/queryKeys';

function formatTime(ms: number | null) {
  if (!ms) return null;
  return new Date(ms).toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  });
}

function RunwayIcon({ kind }: Pick<RunwayItem, 'kind'>) {
  return kind === 'event' ? <CalendarDays size={16} /> : <CheckSquare2 size={16} />;
}

export default function TodayRunwayCard() {
  const userId = useUserId();
  const navigate = useNavigate();
  const today = getTodayWarsaw();
  const { events, nowMs } = useTodayCalendarEvents(userId, today);
  const { data: tasks = [] } = useQuery({
    queryKey: todoKeys.items(userId || ''),
    queryFn: () => listTodoItems(userId!),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
  const todayTasks = useMemo(() => tasks.filter((task) => (
    task.status === 'open' && (task.due_date === today || task.scheduled_time?.slice(0, 10) === today)
  )), [tasks, today]);
  const runway = useMemo(
    () => buildTodayRunway(todayTasks, events, nowMs),
    [todayTasks, events, nowMs],
  );

  const openItem = (item: RunwayItem) => {
    navigate(item.kind === 'task' ? `/todo?task=${item.id}` : '/kalendarz');
  };

  if (!runway.now) {
    return (
      <section className="rounded-2xl border border-border-custom/35 bg-surface-solid/30 p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-success/10 text-success"><Sunrise size={17} /></span>
          <div>
            <p className="text-2xs font-black uppercase tracking-widest text-text-muted">Teraz</p>
            <p className="text-sm font-semibold text-text-primary">Masz wolną przestrzeń.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border-custom/35 bg-surface-solid/30">
      <Pressable
        onClick={() => openItem(runway.now!)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-solid/45"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><RunwayIcon kind={runway.now.kind} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-2xs font-black uppercase tracking-widest text-primary">Teraz</span>
          <span className="block truncate text-sm font-bold text-text-primary">{runway.now.title}</span>
        </span>
        {runway.now.startMs ? <span className="text-xs tabular-nums text-text-muted">{formatTime(runway.now.startMs)}</span> : null}
        <ChevronRight size={16} className="text-text-muted/50" />
      </Pressable>

      {runway.next.length ? (
        <div className="border-t border-border-custom/25 px-4 py-3">
          <p className="mb-2 text-2xs font-black uppercase tracking-widest text-text-muted">Następnie</p>
          <div className="space-y-1">
            {runway.next.map((item) => (
              <Pressable
                key={`${item.kind}-${item.id}`}
                onClick={() => openItem(item)}
                className="flex w-full items-center gap-2.5 rounded-lg py-1.5 text-left hover:bg-surface-solid/40"
              >
                <span className="text-text-muted"><RunwayIcon kind={item.kind} /></span>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-text-primary/85">{item.title}</span>
                {item.startMs ? <span className="text-2xs tabular-nums text-text-muted">{formatTime(item.startMs)}</span> : null}
              </Pressable>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
