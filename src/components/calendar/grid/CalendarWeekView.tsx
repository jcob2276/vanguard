import { Pressable } from '../../ui/ControlPrimitives';
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HOURS, PX_PER_HOUR, dayLabel, addDays, weekMon, formatWeekdayShort } from '../calendarHelpers';
import { WMO_WEATHER_DESC, getWMOWeatherIcon } from '../CalendarWeather';
import { renderTimeGutter, renderDayColumn, renderAllDayTodos } from './CalendarGridColumns';
import type { CalRow } from '../calendarHelpers';
import type { CalendarTodo } from '../hooks/useCalendarTodos';
import type { WeatherState } from '../hooks/useCalendarWeather';
import type { GoalChip } from './types';

interface CalendarWeekViewProps {
  weekStart: string;
  setWeekStart: (start: string) => void;
  setSelectedDay: (day: string) => void;
  weather: WeatherState | null | undefined;
  today: string;
  nowMin: number;
  weekDays: string[];
  dragSelect: { day: string; startMin: number; currentMin: number } | null;
  goalChipFor: (sectionId: string | null) => GoalChip;
  completedTodoIds: Set<string>;
  getEventsForDay: (day: string) => CalRow[];
  todosForDay: (day: string) => CalendarTodo[];
  handleColumnMouseDown: (day: string, e: React.MouseEvent) => void;
  handleColumnMouseMove: (day: string, e: React.MouseEvent) => void;
  handleEventMouseDown: (ev: CalRow, e: React.MouseEvent<HTMLDivElement>, action: 'move' | 'resize') => void;
  handleToggleTodo: (id: string) => void;
  setEditingTodo: (todo: CalendarTodo | null) => void;
  setEditingTodoTitle: (title: string) => void;
  setToastMessage: (msg: string) => void;
  setSaving: (saving: boolean) => void;
  scheduleTodoAt: (todo: { id: string }, day: string, startMin: number, duration: number) => Promise<unknown>;
  gridRef: React.RefObject<HTMLDivElement | null>;
}

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({
  weekStart, setWeekStart, setSelectedDay, weather, today, nowMin, weekDays, dragSelect,
  goalChipFor, completedTodoIds, getEventsForDay, todosForDay, handleColumnMouseDown,
  handleColumnMouseMove, handleEventMouseDown, handleToggleTodo, setEditingTodo,
  setEditingTodoTitle, setToastMessage, setSaving, scheduleTodoAt, gridRef,
}) => {
  const topScrollRef = React.useRef<HTMLDivElement>(null);
  const untimedByDay = weekDays.map(day => todosForDay(day).filter(todo => !todo.scheduled_time));

  const moveWeek = (offset: number) => {
    const week = addDays(weekStart, offset);
    setWeekStart(week);
    setSelectedDay(week);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="calendar-period-header flex items-center justify-between border-b border-border-custom/20 px-4 py-2">
        <Pressable onClick={() => moveWeek(-7)} className="rounded-full p-2 hover:bg-surface-solid">
          <ChevronLeft size={18} className="text-text-muted" />
        </Pressable>
        <div className="text-center">
          <p className="text-sm font-bold text-text-primary">{dayLabel(weekStart)} – {dayLabel(addDays(weekStart, 6))}</p>
          {!weekDays.includes(today) && (
            <Pressable onClick={() => {
              const week = weekMon(today);
              setWeekStart(week);
              setSelectedDay(today);
            }} className="text-xs font-semibold text-primary">
              Bieżący tydzień
            </Pressable>
          )}
        </div>
        <Pressable onClick={() => moveWeek(7)} className="rounded-full p-2 hover:bg-surface-solid">
          <ChevronRight size={18} className="text-text-muted" />
        </Pressable>
      </div>

      <div
        ref={topScrollRef}
        className="calendar-week-top-scroll shrink-0 overflow-x-auto"
        onScroll={event => {
          if (gridRef.current) gridRef.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
      >
        <div className="calendar-week-canvas">
          <div className="calendar-week-strip flex border-b border-border-custom/70 pl-11">
            {weekDays.map(day => {
              const isToday = day === today;
              const forecast = weather?.daily?.[day];
              return (
                <div key={day} className="calendar-week-column flex flex-col items-center justify-center py-1.5 text-center">
                  <p className={`text-xs font-black uppercase tracking-wider ${isToday ? 'text-primary' : 'text-text-secondary'}`}>
                    {formatWeekdayShort(day)}
                  </p>
                  {forecast && (
                    <div className="mt-0.5 flex items-center gap-1" title={`${WMO_WEATHER_DESC[forecast.weatherCode]}: ${forecast.tempMax}°C / ${forecast.tempMin}°C`}>
                      {getWMOWeatherIcon(forecast.weatherCode, 12)}
                      <span className="text-3xs font-bold text-text-muted">{forecast.tempMax}°</span>
                    </div>
                  )}
                  <span className={`mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-black ${isToday ? 'bg-primary text-on-accent' : 'text-text-primary'}`}>
                    {parseInt(day.split('-')[2])}
                  </span>
                </div>
              );
            })}
          </div>
          {renderAllDayTodos({
            days: weekDays, untimedByDay, goalChipFor, completedTodoIds, handleToggleTodo,
            setEditingTodo, setEditingTodoTitle, setToastMessage,
          })}
        </div>
      </div>

      <div
        ref={gridRef}
        className="calendar-week-grid flex-1 overflow-auto"
        onScroll={event => {
          if (topScrollRef.current) topScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
      >
        <div className="calendar-week-canvas flex pt-3" style={{ minHeight: HOURS * PX_PER_HOUR + 40 }}>
          <div className="calendar-week-time-gutter sticky left-0 z-[var(--z-sticky)] bg-background">
            {renderTimeGutter({ dayKey: undefined, weather: undefined })}
          </div>
          {weekDays.map(day => (
            <div key={day} data-day-col={day} className={`calendar-week-column relative border-l border-border-custom/50 ${day === today ? 'bg-primary/[0.03]' : ''}`}>
              {renderDayColumn({
                day, today, nowMin, dayEvents: getEventsForDay(day),
                dayTodos: todosForDay(day).filter(todo => todo.scheduled_time), dragSelect,
                goalChipFor, completedTodoIds, handleColumnMouseDown, handleColumnMouseMove,
                handleEventMouseDown, handleToggleTodo, setEditingTodo, setEditingTodoTitle,
                setToastMessage, setSaving, scheduleTodoAt,
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
