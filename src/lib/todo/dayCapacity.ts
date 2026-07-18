import type { CalendarAgendaEvent } from '../calendarAgendaApi';

export interface DayCapacitySettings {
  start: string;
  end: string;
  breakMinutes: number;
}

export const DEFAULT_DAY_CAPACITY: DayCapacitySettings = { start: '09:00', end: '18:00', breakMinutes: 60 };

function minutes(time: string) {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}

export function calculateAvailableMinutes(settings: DayCapacitySettings, events: CalendarAgendaEvent[]) {
  const start = minutes(settings.start);
  const end = minutes(settings.end);
  const windowMinutes = Math.max(0, end - start - settings.breakMinutes);
  const intervals = events.map((event) => {
    const from = new Date(event.start_time);
    const to = new Date(event.end_time);
    const eventStart = from.getHours() * 60 + from.getMinutes();
    const eventEnd = to.getHours() * 60 + to.getMinutes();
    return [Math.max(start, eventStart), Math.min(end, eventEnd)] as const;
  }).filter(([from, to]) => to > from).sort(([a], [b]) => a - b);
  const merged = intervals.reduce<Array<[number, number]>>((result, [from, to]) => {
    const previous = result.at(-1);
    if (previous && from <= previous[1]) previous[1] = Math.max(previous[1], to);
    else result.push([from, to]);
    return result;
  }, []);
  const busyMinutes = merged.reduce((sum, [from, to]) => sum + to - from, 0);
  return Math.max(0, windowMinutes - busyMinutes);
}

export function formatMinutes(value: number) {
  if (value < 60) return `${value}m`;
  const rest = value % 60;
  return `${Math.floor(value / 60)}h${rest ? ` ${rest}m` : ''}`;
}
