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

interface CalendarWeekViewProps {
  weekStart: string;
  setWeekStart: (start: string) => void;
  setSelectedDay: (day: string) => void;
  weather: any;
  today: string;
  nowMin: number;
  weekDays: string[];
  dragSelect: {
    day: string;
    startMin: number;
    currentMin: number;
  } | null;
  goalChipFor: (sectionId: string | null) => any;
  completedTodoIds: Set<string>;
  getEventsForDay: (day: string) => any[];
  todosForDay: (day: string) => any[];
  handleColumnMouseDown: (day: string, e: React.MouseEvent) => void;
  handleColumnMouseMove: (day: string, e: React.MouseEvent) => void;
  handleEventMouseDown: (ev: any, e: React.MouseEvent<HTMLDivElement>, action: 'move' | 'resize') => void;
  handleToggleTodo: (id: string) => void;
  setEditingTodo: (todo: any) => void;
  setEditingTodoTitle: (title: string) => void;
  setToastMessage: (msg: string) => void;
  setSaving: (saving: boolean) => void;
  scheduleTodoAt: (todo: any, day: string, startMin: number, duration: number) => Promise<any>;
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
        <button
          onClick={() => {
            const w = addDays(weekStart, -7);
            setWeekStart(w);
            setSelectedDay(w);
          }}
          className="p-2 rounded-full hover:bg-surface-solid transition-colors"
        >
          <ChevronLeft size={18} className="text-text-muted" />
        </button>
        <div className="text-center">
          <p className="text-[12px] font-bold text-text-primary">
            {dayLabel(weekStart)} – {dayLabel(addDays(weekStart, 6))}
          </p>
          {!weekDays.includes(today) && (
            <button
              onClick={() => {
                const w = weekMon(today);
                setWeekStart(w);
                setSelectedDay(today);
              }}
              className="text-[10px] text-primary font-semibold"
            >
              Bieżący tydzień
            </button>
          )}
        </div>
        <button
          onClick={() => {
            const w = addDays(weekStart, 7);
            setWeekStart(w);
            setSelectedDay(w);
          }}
          className="p-2 rounded-full hover:bg-surface-solid transition-colors"
        >
          <ChevronRight size={18} className="text-text-muted" />
        </button>
      </div>
      <div className="flex border-b border-border-custom/40" style={{ paddingLeft: 44 }}>
        {weekDays.map((day) => {
          const isToday = day === today;
          const dayForecast = weather?.daily?.[day];
          return (
            <div key={day} className="flex-1 text-center py-1.5 flex flex-col items-center justify-center relative group">
              <p className={`text-[10px] font-black uppercase tracking-wider ${isToday ? 'text-primary' : 'text-text-muted/80'}`}>
                {formatWeekdayShort(day)}
              </p>
              {dayForecast && (
                <div className="mt-0.5 flex flex-col items-center gap-0.5 cursor-help" title={`${WMO_WEATHER_DESC[dayForecast.weatherCode]}: ${dayForecast.tempMax}°C / ${dayForecast.tempMin}°C`}>
                  <div className="flex items-center justify-center transition-transform duration-200 hover:scale-110">
                    {getWMOWeatherIcon(dayForecast.weatherCode, 12)}
                  </div>
                  <span className="text-[7.5px] font-black text-text-muted leading-none">
                    {dayForecast.tempMax}°
                  </span>
                </div>
              )}
              <div className="mt-1 flex items-center justify-center h-8 w-8">
                {isToday ? (
                  <span className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-[13px] font-black text-white leading-none shadow-sm shadow-primary/20">
                    {parseInt(day.split('-')[2])}
                  </span>
                ) : (
                  <span className="text-[15px] font-black text-text-primary leading-none">
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
