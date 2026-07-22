import { Pressable } from '../../ui/ControlPrimitives';
import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { getMonthGridDays, eventColor, formatTime, addDays } from '../calendarHelpers';
import type { CalRow } from '../calendarHelpers';
import type { CalendarTodo } from '../hooks/useCalendarTodos';
import { getPolishHolidayForDate } from '../../../lib/holidays';

interface CalendarMonthViewProps {
  selectedDay: string;
  setSelectedDay: (day: string) => void;
  setCalView: (view: 'dzien' | '3dni' | 'tydzien' | 'miesiac') => void;
  getEventsForDay: (day: string) => CalRow[];
  todosForDay: (day: string) => CalendarTodo[];
  handleEventClick: (ev: CalRow) => void;
  setQuickCreate: (val: { date: string; startMin: number } | null) => void;
  today: string;
}

const WEEKDAY_NAMES = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz'];

export const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
  selectedDay,
  setSelectedDay,
  setCalView,
  getEventsForDay,
  todosForDay,
  handleEventClick,
  setQuickCreate,
  today,
}) => {
  const currentMonthDate = useMemo(() => new Date(selectedDay), [selectedDay]);
  const gridDays = useMemo(() => getMonthGridDays(selectedDay), [selectedDay]);

  const changeMonth = (delta: number) => {
    const d = new Date(currentMonthDate);
    d.setMonth(d.getMonth() + delta);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedDay(`${y}-${m}-01`);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background select-none">
      {/* Month Navigation Bar */}
      <div className="flex items-center justify-between border-b border-border-custom/40 px-4 py-3 bg-surface-solid/20">
        <div className="flex items-center gap-2">
          <Pressable onClick={() => changeMonth(-1)} className="rounded-full p-2 hover:bg-surface-solid">
            <ChevronLeft size={18} className="text-text-muted" />
          </Pressable>
          <p className="text-sm font-black uppercase tracking-wider text-text-primary">
            {new Date(selectedDay).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Pressable onClick={() => changeMonth(1)} className="rounded-full p-2 hover:bg-surface-solid">
          <ChevronRight size={18} className="text-text-muted" />
        </Pressable>
      </div>

      {/* Weekday Columns Header */}
      <div className="grid grid-cols-7 border-b border-border-custom/40 bg-surface-solid/30 py-2 text-center text-xs font-black uppercase tracking-wider text-text-muted">
        {WEEKDAY_NAMES.map((name) => (
          <div key={name}>{name}</div>
        ))}
      </div>

      {/* Month Cells Grid */}
      <div className="grid flex-1 grid-cols-7 grid-rows-5 md:grid-rows-6 divide-x divide-y divide-border-custom/30 overflow-y-auto">
        {gridDays.map((cell) => {
          const dayEvents = getEventsForDay(cell.dateStr);
          const dayTodos = todosForDay(cell.dateStr);
          const holiday = getPolishHolidayForDate(cell.dateStr);
          const maxVisible = holiday ? 2 : 3;
          const overflowCount = Math.max(0, dayEvents.length + dayTodos.length - maxVisible);

          return (
            <div
              key={cell.dateStr}
              onClick={() => {
                setSelectedDay(cell.dateStr);
              }}
              className={`group relative flex flex-col p-1.5 transition-colors hover:bg-surface-solid/40 min-h-[90px] ${
                !cell.isCurrentMonth ? 'bg-surface-solid/10 text-text-muted/40' : ''
              } ${cell.isToday ? 'bg-primary/[0.04]' : ''}`}
            >
              {/* Day Header inside Cell */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${
                    cell.isToday
                      ? 'bg-primary text-on-accent'
                      : cell.isCurrentMonth
                      ? 'text-text-primary'
                      : 'text-text-muted/60'
                  }`}
                >
                  {cell.dayNumber}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuickCreate({ date: cell.dateStr, startMin: 540 });
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-surface-solid text-text-muted transition-opacity"
                  title="Dodaj wydarzenie"
                >
                  <Plus size={12} />
                </button>
              </div>

              {holiday && (
                <div
                  className="truncate text-[9px] font-black text-warning bg-warning/10 px-1 py-0.5 rounded border border-warning/20 mb-0.5 shrink-0 select-none"
                  title={holiday.name}
                >
                  🇵🇱 {holiday.name}
                </div>
              )}

              {/* Event & Task Pills */}
              <div className="flex-1 space-y-1 overflow-hidden">
                {dayEvents.slice(0, maxVisible).map((ev) => (
                  <div
                    key={ev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEventClick(ev);
                    }}
                    className={`truncate rounded px-1.5 py-0.5 text-3xs font-medium cursor-pointer transition-transform hover:scale-[1.02] ${eventColor(
                      ev
                    )}`}
                    title={`${ev.summary} (${ev.start_time ? formatTime(ev.start_time) : ''})`}
                  >
                    {ev.start_time && <span className="font-bold mr-1">{formatTime(ev.start_time)}</span>}
                    {ev.summary}
                  </div>
                ))}

                {dayEvents.length < maxVisible &&
                  dayTodos.slice(0, maxVisible - dayEvents.length).map((todo) => (
                    <div
                      key={todo.id}
                      className="truncate rounded bg-surface-solid/80 border border-border-custom/50 px-1.5 py-0.5 text-3xs font-medium text-text-secondary"
                      title={todo.title}
                    >
                      ✓ {todo.title}
                    </div>
                  ))}

                {overflowCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDay(cell.dateStr);
                      setCalView('dzien');
                    }}
                    className="w-full text-left text-3xs font-bold text-primary hover:underline pt-0.5"
                  >
                    +{overflowCount} więcej…
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
