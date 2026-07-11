import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  HOURS,
  PX_PER_HOUR,
  monthLabel,
  addDays,
  weekMon,
} from '../calendarHelpers';
import { WMO_WEATHER_DESC, getWMOWeatherIcon } from '../CalendarWeather';
import { renderTimeGutter, renderDayColumn, renderAllDayTodos } from './CalendarGridColumns';

interface CalendarDayViewProps {
  selectedDay: string;
  setSelectedDay: (day: string) => void;
  setWeekStart: (start: string) => void;
  weather: any;
  today: string;
  nowMin: number;
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

export const CalendarDayView: React.FC<CalendarDayViewProps> = ({
  selectedDay,
  setSelectedDay,
  setWeekStart,
  weather,
  today,
  nowMin,
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
  const untimedTodos = todosForDay(selectedDay).filter((t) => !t.scheduled_time);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-custom/20">
        <button
          onClick={() => {
            const d = addDays(selectedDay, -1);
            setSelectedDay(d);
            setWeekStart(weekMon(d));
          }}
          className="p-2 rounded-full hover:bg-surface-solid transition-colors"
        >
          <ChevronLeft size={18} className="text-text-muted" />
        </button>
        <div className="text-center flex flex-col items-center">
          <p className="text-[14px] font-bold text-text-primary">{monthLabel(selectedDay)}</p>
          {weather?.daily?.[selectedDay] && (
            <div className="flex items-center gap-1 mt-0.5 text-[10.5px] font-bold text-text-muted cursor-help" title={WMO_WEATHER_DESC[weather.daily[selectedDay].weatherCode]}>
              {getWMOWeatherIcon(weather.daily[selectedDay].weatherCode, 13)}
              <span>{weather.daily[selectedDay].tempMax}°C / {weather.daily[selectedDay].tempMin}°C</span>
            </div>
          )}
          {selectedDay !== today && (
            <button
              onClick={() => {
                setSelectedDay(today);
                setWeekStart(weekMon(today));
              }}
              className="text-[10px] text-primary font-semibold mt-0.5"
            >
              Wróć do dziś
            </button>
          )}
        </div>
        <button
          onClick={() => {
            const d = addDays(selectedDay, 1);
            setSelectedDay(d);
            setWeekStart(weekMon(d));
          }}
          className="p-2 rounded-full hover:bg-surface-solid transition-colors"
        >
          <ChevronRight size={18} className="text-text-muted" />
        </button>
      </div>
      {renderAllDayTodos({
        days: [selectedDay],
        untimedByDay: [untimedTodos],
        goalChipFor,
        completedTodoIds,
        handleToggleTodo,
        setEditingTodo,
        setEditingTodoTitle,
        setToastMessage,
      })}
      <div ref={gridRef} className="flex-1 overflow-y-auto">
        <div className="flex" style={{ minHeight: HOURS * PX_PER_HOUR + 40 }}>
          {renderTimeGutter({ dayKey: selectedDay, weather })}
          <div className="flex-1 relative">
            {renderDayColumn({
              day: selectedDay,
              today,
              nowMin,
              dayEvents: getEventsForDay(selectedDay),
              dayTodos: todosForDay(selectedDay).filter((t) => t.scheduled_time),
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
        </div>
      </div>
    </div>
  );
};
