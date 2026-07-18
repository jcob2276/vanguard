import type { CalendarAgendaEvent } from '../calendarAgendaApi';

export interface RunwayTask {
  id: string;
  title: string;
  scheduled_time: string | null;
  duration_minutes: number | null;
  status: string;
}

export interface RunwayItem {
  id: string;
  kind: 'task' | 'event';
  title: string;
  startMs: number | null;
  endMs: number | null;
}

function taskTimes(task: RunwayTask) {
  if (!task.scheduled_time) return { startMs: null, endMs: null };
  const startMs = new Date(task.scheduled_time).getTime();
  return { startMs, endMs: startMs + (task.duration_minutes || 30) * 60_000 };
}

export function buildTodayRunway(tasks: RunwayTask[], events: CalendarAgendaEvent[], nowMs: number) {
  const openTasks: RunwayItem[] = tasks
    .filter((task) => task.status !== 'done' && task.status !== 'dropped')
    .map((task) => ({ id: task.id, kind: 'task', title: task.title, ...taskTimes(task) }));
  const eventItems: RunwayItem[] = events.map((event) => ({
    id: event.id, kind: 'event', title: event.summary || 'Wydarzenie',
    startMs: new Date(event.start_time).getTime(), endMs: new Date(event.end_time).getTime(),
  }));
  const timed = [...openTasks, ...eventItems];
  const active = timed
    .filter((item) => item.startMs !== null && item.endMs !== null && item.startMs <= nowMs && nowMs < item.endMs)
    .sort((a, b) => (a.endMs || 0) - (b.endMs || 0))[0] ?? null;
  const upcoming = timed
    .filter((item) => item.startMs !== null && item.startMs > nowMs)
    .sort((a, b) => (a.startMs || 0) - (b.startMs || 0));
  const untimed = openTasks.filter((item) => item.startMs === null);
  const now = active ?? untimed[0] ?? upcoming[0] ?? null;
  const next = [...upcoming.filter((item) => item.id !== now?.id), ...untimed.filter((item) => item.id !== now?.id)].slice(0, 2);
  return { now, next };
}
