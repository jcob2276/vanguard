import { Check, Clock, Calendar } from 'lucide-react';
import type { ScheduleItem } from '../../types/schedule';

interface TimelineDayProps {
  dayLabel: string;
  dayDate: string;
  items: ScheduleItem[];
  isToday?: boolean;
  onToggleDone?: (itemId: string) => void;
}

export function TimelineDay({ dayLabel, dayDate, items, isToday, onToggleDone }: TimelineDayProps) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span
          className="text-[10px] font-black uppercase tracking-[0.12em]"
          style={{ color: isToday ? '#5B6CFF' : 'var(--color-text-tertiary)' }}
        >
          {dayLabel}
        </span>
        {isToday && <div className="w-1 h-1 rounded-full bg-[#5B6CFF]" />}
        <div className="flex-1 h-px" style={{ background: 'rgba(153,161,175,0.12)' }} />
      </div>

      <div className="space-y-1.5">
        {items.map(item => (
          <div
            key={item.id}
            className="flex items-start gap-3 rounded-xl px-3 py-2.5"
            style={{
              background: item.done ? 'rgba(153,161,175,0.04)' : 'var(--surface-solid)',
              border: '1px solid',
              borderColor: item.done ? 'rgba(153,161,175,0.1)' : 'rgba(153,161,175,0.14)',
              opacity: item.done ? 0.6 : 1,
            }}
          >
            <button
              onClick={() => onToggleDone?.(item.id)}
              className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center border transition-all"
              style={{
                borderColor: item.done ? '#10B981' : (item.color ?? 'rgba(153,161,175,0.3)'),
                background: item.done ? '#10B981' : 'transparent',
                cursor: onToggleDone ? 'pointer' : 'default',
              }}
            >
              {item.done && <Check size={8} color="white" />}
            </button>

            <div className="flex-1 min-w-0">
              <p
                className="text-[12px] font-medium leading-tight"
                style={{
                  color: item.done ? 'var(--color-text-tertiary)' : 'var(--text-primary)',
                  textDecoration: item.done ? 'line-through' : 'none',
                }}
              >
                {item.title}
              </p>
              {(item.startTime || item.dueAt) && (
                <div className="flex items-center gap-1 mt-0.5">
                  {item.kind === 'event' ? <Calendar size={9} style={{ color: 'var(--color-text-tertiary)' }} /> : <Clock size={9} style={{ color: 'var(--color-text-tertiary)' }} />}
                  <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    {item.startTime ?? item.dueAt}
                  </span>
                </div>
              )}
            </div>

            {item.color && (
              <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ background: item.color }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
