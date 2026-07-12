import { formatWeekdayShort } from '../../calendar/calendarHelpers';
import { isoDateStr, isoDurationMin } from './morningPlanHelpers';
import { CAPACITY_HOURS } from './useMorningPlanData';
import type { CalEvent } from './types';

interface MorningPlanWeekStripProps {
  weekDays: string[];
  planningDate: string;
  actualToday: string;
  weekCalendarEvents: CalEvent[];
  weekTaskCounts: Record<string, number>;
}

export default function MorningPlanWeekStrip({
  weekDays,
  planningDate,
  actualToday,
  weekCalendarEvents,
  weekTaskCounts,
}: MorningPlanWeekStripProps) {
  return (
    <div className="flex items-stretch gap-0.5 px-3 pt-2.5 pb-1.5 border-b border-border-custom/10 shrink-0">
      {weekDays.map((d) => {
        const isTarget = d === planningDate;
        const isRealToday = d === actualToday;
        const hours = weekCalendarEvents
          .filter((e) => isoDateStr(e.start_time) === d)
          .reduce((sum, e) => sum + isoDurationMin(e.start_time, e.end_time), 0) / 60;
        const taskCount = weekTaskCounts[d] || 0;
        const loadPct = Math.min(100, (hours / CAPACITY_HOURS) * 100);
        const weekdayLabel = formatWeekdayShort(d).replace('.', '');
        const dayNum = Number(d.slice(8, 10));
        return (
          <div
            key={d}
            className={`flex-1 flex flex-col items-center gap-1 rounded-xl py-1.5 transition-colors ${isTarget ? 'bg-primary/10' : ''}`}
          >
            <span className={`text-[8px] font-black uppercase tracking-wide ${isTarget ? 'text-primary' : 'text-text-muted/70'}`}>
              {weekdayLabel}
            </span>
            <span
              className={`text-[11px] font-black ${
                isTarget ? 'text-primary' : isRealToday ? 'text-text-primary' : 'text-text-secondary'
              }`}
            >
              {dayNum}
            </span>
            <div className="w-4 h-1 rounded-full bg-border-custom/30 overflow-hidden">
              <div className="h-full bg-primary/50" style={{ width: `${loadPct}%` }} />
            </div>
            <span className="text-[7px] font-bold text-text-muted/60 h-2.5">{taskCount > 0 ? `${taskCount}z` : ''}</span>
          </div>
        );
      })}
    </div>
  );
}
