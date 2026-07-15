import { Pressable } from '../../ui/ControlPrimitives';
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  HOURS,
  PX_PER_HOUR,
  dayLabel,
  addDays,
  weekMon,
  formatWeekdayShort,
} from '../calendarHelpers';
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
  dragSelect: {
    day: string;
    startMin: number;
    currentMin: number;
  } | null;
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
  weekStart,
  setWeekStart,
  setSelectedDay,
  weather,
  today,
  nowMin,
  weekDays,
  dragSelect,
  goalChipFor,
  completedTodoIds,
  getEventsForDay,
  todosForDay,
  handleColumnMouseDown,
  handleColumnMouseMove,
  handleEventMouseDown,
  handleToggleTodo,
  setEditingTodo,
  setEditingTodoTitle,
  setToastMessage,
  setSaving,
  scheduleTodoAt,
  gridRef,
}) => {
  const untimedByDay = weekDays.map((day) => todosForDay(day).filter((t) => !t.scheduled_time));

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-custom/20">
        <Pressable
          onClick={() => {
            const w = addDays(weekStart, -7);
            setWeekStart(w);
            setSelectedDay(w);
          }}
          className="p-2 rounded-full hover:bg-surface-solid transition-colors"
        >
          <ChevronLeft size={18} className="text-text-muted" />
        </Pressable>
        <div className="text-center">
          <p className="text-sm font-bold text-text-primary">
            {dayLabel(weekStart)} – {dayLabel(addDays(weekStart, 6))}
          </p>
          {!weekDays.includes(today) && (
            <Pressable
              onClick={() => {
                const w = weekMon(today);
                setWeekStart(w);
                setSelectedDay(today);
              }}
              className="text-xs text-primary font-semibold"
            >
              Bieżący tydzień
            </Pressable>
          )}
        </div>
        <Pressable
          onClick={() => {
            const w = addDays(weekStart, 7);
            setWeekStart(w);
            setSelectedDay(w);
          }}
          className="p-2 rounded-full hover:bg-surface-solid transition-colors"
        >
          <ChevronRight size={18} className="text-text-muted" />
        </Pressable>
      </div>
      <div className="flex border-b border-border-custom/40" style={{ paddingLeft: 'var(--ds-inline-style-44)' }}>
        {weekDays.map((day) => {
          const isToday = day === today;
          const dayForecast = weather?.daily?.[day];
          return (
            <div key={day} className="flex-1 text-center py-1.5 flex flex-col items-center justify-center relative group">
              <p className={`text-xs font-black uppercase tracking-wider ${isToday ? 'text-primary' : 'text-text-muted/80'}`}>
                {formatWeekdayShort(day)}
              </p>
              {dayForecast && (
                <div className="mt-0.5 flex flex-col items-center gap-0.5 cursor-help" title={`${WMO_WEATHER_DESC[dayForecast.weatherCode]}: ${dayForecast.tempMax}°C / ${dayForecast.tempMin}°C`}>
                  <div className="flex items-center justify-center transition-transform duration-[var(--motion-medium)] hover:scale-110">
                    {getWMOWeatherIcon(dayForecast.weatherCode, 12)}
                  </div>
                  <span className="text-3xs font-black text-text-muted leading-none">
                    {dayForecast.tempMax}°
                  </span>
                </div>
              )}
              <div className="mt-1 flex items-center justify-center h-8 w-8">
                {isToday ? (
                  <span className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-sm font-black text-on-accent leading-none shadow-sm shadow-[var(--shadow-glow-primary)]">
                    {parseInt(day.split('-')[2])}
                  </span>
                ) : (
                  <span className="text-base font-black text-text-primary leading-none">
                    {parseInt(day.split('-')[2])}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {renderAllDayTodos({
        days: weekDays,
        untimedByDay,
        goalChipFor,
        completedTodoIds,
        handleToggleTodo,
        setEditingTodo,
        setEditingTodoTitle,
        setToastMessage,
      })}
      <div ref={gridRef} className="flex-1 overflow-y-auto">
        <div className="flex" style={{ minHeight: HOURS * PX_PER_HOUR + 40 }}>
          {renderTimeGutter({ dayKey: undefined, weather: undefined })}
          {weekDays.map((day) => (
            <div
              key={day}
              data-day-col={day}
              className={`flex-1 relative border-l border-border-custom/30 ${day === today ? 'bg-primary/[0.02]' : ''}`}
            >
              {renderDayColumn({
                day,
                today,
                nowMin,
                dayEvents: getEventsForDay(day),
                dayTodos: todosForDay(day).filter((t) => t.scheduled_time),
                dragSelect,
                goalChipFor,
                completedTodoIds,
                handleColumnMouseDown,
                handleColumnMouseMove,
                handleEventMouseDown,
                handleToggleTodo,
                setEditingTodo,
                setEditingTodoTitle,
                setToastMessage,
                setSaving,
                scheduleTodoAt,
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
