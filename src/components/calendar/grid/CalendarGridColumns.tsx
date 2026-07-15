import { Pressable } from '../../ui/ControlPrimitives';
import { getTodayWarsaw, formatWarsawDate } from '../../../lib/date';
import React from 'react';
import { Check } from 'lucide-react';
import {
  HOUR_START,
  HOURS,
  PX_PER_HOUR,
  PX_PER_MIN,
  layoutDayEvents,
} from '../calendarHelpers';
import { GOAL_ICON } from '../../todo/todoUtils';
import { getSunTimes, formatTimeWarsaw } from '../../../lib/solar';
import { WMO_WEATHER_DESC, getWMOWeatherIcon } from '../CalendarWeather';
import { renderEventBlock, renderTodoBlock } from './CalendarGridBlocks';
import type {
  CalendarGridTimeGutterProps,
  CalendarGridColumnProps,
  CalendarGridAllDayTodosProps,
} from './types';

export const renderTimeGutter = ({
  dayKey,
  weather,
}: CalendarGridTimeGutterProps) => {
  const today = getTodayWarsaw();
  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatWarsawDate(d);
  })();
  const showHourlyWeather = dayKey === today || dayKey === tomorrow;
  const hourlyForDay = showHourlyWeather && weather?.hourly?.[dayKey!] ? weather.hourly[dayKey!] : null;

  const hourlyByHour: Record<number, { hour: number; temp: number; weatherCode: number; precipProb: number }> = {};
  if (hourlyForDay) {
    for (const h of hourlyForDay) {
      hourlyByHour[h.hour] = h;
    }
  }

  const gutterWidth = showHourlyWeather ? 72 : 44;

  return (
    <div className="flex flex-col shrink-0 relative" style={{ width: gutterWidth }}>
      {Array.from({ length: HOURS + 1 }, (_, i) => {
        const absoluteHour = HOUR_START + i;
        const hw = hourlyByHour[absoluteHour];
        return (
          <div
            key={i}
            className="absolute right-0 flex items-center justify-end"
            style={{
              top: i * PX_PER_HOUR,
              transform: 'var(--ds-inline-style-translatey-50)',
              height: 'var(--ds-inline-style-20)',
              width: gutterWidth,
            }}
          >
            {hw && showHourlyWeather && (
              <div
                className="flex items-center gap-0.5 mr-1"
                title={`${WMO_WEATHER_DESC[hw.weatherCode]}${hw.precipProb > 0 ? ` · opady ${hw.precipProb}%` : ''}`}
              >
                {getWMOWeatherIcon(hw.weatherCode, 9, absoluteHour < 6 || absoluteHour >= 20)}
                <span className={`text-2xs font-black leading-none tabular-nums ${hw.precipProb >= 50 ? 'text-info' : 'text-text-muted/70'}`}>
                  {hw.temp}°
                </span>
              </div>
            )}
            <span className="text-xs font-black text-text-secondary/80 text-right pr-2">
              {String(absoluteHour).padStart(2, '0')}:00
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const renderDayColumn = ({
  day,
  colClass = '',
  today,
  nowMin,
  dayEvents,
  dayTodos,
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
}: CalendarGridColumnProps) => {
  const isToday = day === today;
  const nowLine = isToday ? (nowMin - HOUR_START * 60) * PX_PER_MIN : null;

  const showSelection = dragSelect && dragSelect.day === day;
  const startMin = showSelection ? Math.min(dragSelect!.startMin, dragSelect!.currentMin) : 0;
  const endMin = showSelection ? Math.max(dragSelect!.startMin, dragSelect!.currentMin) : 0;
  const selectionTop = (startMin - HOUR_START * 60) * PX_PER_MIN;
  const selectionHeight = (endMin - startMin) * PX_PER_MIN;

  return (
    <div
      key={day}
      className={`relative flex-1 min-w-0 ${colClass}`}
      style={{ height: HOURS * PX_PER_HOUR }}
      onMouseDown={(e) => handleColumnMouseDown(day, e)}
      onMouseMove={(e) => handleColumnMouseMove(day, e)}
      onDragOver={(e) => {
        e.preventDefault();
        e.currentTarget.classList.add('bg-primary/5');
      }}
      onDragLeave={(e) => {
        e.currentTarget.classList.remove('bg-primary/5');
      }}
      onDrop={async (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('bg-primary/5');
        const rawData = e.dataTransfer.getData('text/plain');
        if (!rawData) return;
        try {
          const todo = JSON.parse(rawData);
          const rect = e.currentTarget.getBoundingClientRect();
          const offsetY = e.clientY - rect.top;
          const dropMin = Math.round((offsetY / PX_PER_MIN) / 15) * 15 + HOUR_START * 60;

          setSaving(true);
          await scheduleTodoAt(todo, day, dropMin, todo.duration_minutes ?? 60);
          setToastMessage(`Zaplanowano zadanie: "${todo.title}" 📅`);
        } catch (err) {
          console.error('Failed to drop and schedule task:', err);
          setToastMessage('Nie udało się zaplanować zadania.');
        } finally {
          setSaving(false);
        }
      }}
    >
      {Array.from({ length: HOURS }, (_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-b border-border-custom/10 pointer-events-none"
          style={{ top: i * PX_PER_HOUR, height: PX_PER_HOUR }}
        />
      ))}

      {showSelection && selectionHeight > 0 && (
        <div
          className="absolute left-0 right-0 bg-primary/20 border border-primary/50 rounded-md pointer-events-none z-[var(--z-sticky)] flex items-center justify-center shadow-lg"
          style={{ top: selectionTop, height: selectionHeight }}
        >
          <span className="text-2xs font-black text-primary bg-background border border-border-custom/40 px-1.5 py-0.5 rounded shadow-md tabular-nums">
            {Math.floor(startMin / 60)}:{String(startMin % 60).padStart(2, '0')} - {Math.floor(endMin / 60)}:{String(endMin % 60).padStart(2, '0')}
          </span>
        </div>
      )}
      {(() => {
        const layouts = layoutDayEvents(dayEvents);
        return dayEvents.map((ev) => {
          const layout = layouts.get(ev.id) || { left: '0%', width: '100%' };
          return renderEventBlock({ ev, left: layout.left, width: layout.width, handleEventMouseDown });
        });
      })()}
      {dayTodos.map((todo) =>
        renderTodoBlock({ todo, goalChipFor, completedTodoIds, handleToggleTodo, setEditingTodo, setEditingTodoTitle, setToastMessage })
      )}
      {(() => {
        const sun = getSunTimes(day);
        const sunriseTop = (sun.sunriseMin - HOUR_START * 60) * PX_PER_MIN;
        const sunsetTop  = (sun.sunsetMin  - HOUR_START * 60) * PX_PER_MIN;
        const sunriseVisible = sunriseTop >= 0 && sunriseTop <= HOURS * PX_PER_HOUR;
        const sunsetVisible  = sunsetTop  >= 0 && sunsetTop  <= HOURS * PX_PER_HOUR;
        return (
          <>
            {sunriseVisible && (
              <div
                className="absolute left-0 right-0 flex items-center pointer-events-none z-[var(--z-raised)]"
                style={{ top: sunriseTop }}
                title={`Wschód: ${formatTimeWarsaw(sun.sunrise)}`}
              >
                <div className="w-full h-[var(--ds-h-1px)] bg-gradient-to-r from-warning/0 via-warning/50 to-warning/0" />
                <span className="absolute right-1 text-3xs font-bold text-warning/70 select-none">🌅 {formatTimeWarsaw(sun.sunrise)}</span>
              </div>
            )}
            {sunsetVisible && (
              <div
                className="absolute left-0 right-0 flex items-center pointer-events-none z-[var(--z-raised)]"
                style={{ top: sunsetTop }}
                title={`Zachód: ${formatTimeWarsaw(sun.sunset)}`}
              >
                <div className="w-full h-[var(--ds-h-1px)] bg-gradient-to-r from-warning/0 via-warning/50 to-warning/0" />
                <span className="absolute right-1 text-3xs font-bold text-warning/70 select-none">🌇 {formatTimeWarsaw(sun.sunset)}</span>
              </div>
            )}
          </>
        );
      })()}
      {nowLine !== null && nowLine >= 0 && (
        <div className="absolute left-0 right-0 flex items-center pointer-events-none z-[var(--z-popover)]" style={{ top: nowLine }}>
          <div className="w-2.5 h-2.5 rounded-full bg-danger shadow-md shadow-danger/50 animate-pulse -ml-[var(--ds-arbitrary-5px)]" />
          <div className="flex-1 h-[var(--ds-h-1-5px)] bg-danger" />
        </div>
      )}
    </div>
  );
};

export const renderAllDayTodos = ({
  days,
  untimedByDay,
  goalChipFor,
  completedTodoIds,
  handleToggleTodo,
  setEditingTodo,
  setEditingTodoTitle,
  setToastMessage,
}: CalendarGridAllDayTodosProps) => {
  if (!untimedByDay.some((list) => list.length > 0)) return null;
  return (
    <div className="flex border-b border-border-custom/20 bg-surface-solid/10" style={{ paddingLeft: 'var(--ds-inline-style-44)' }}>
      {days.map((day, idx) => (
        <div key={day} className="flex-1 min-w-0 p-1 space-y-1 border-l border-border-custom/10 first:border-l-0">
          {untimedByDay[idx].map((todo) => {
            const chip = goalChipFor(todo.section_id);
            const GoalIcon = chip ? GOAL_ICON[chip.pillar] : null;
            const isCompleting = todo.status === 'done' || completedTodoIds.has(todo.id);
            return (
              <div
                key={todo.id}
                title={todo.title}
                className={`flex items-center gap-1.5 truncate rounded border border-dashed border-primary/40 bg-primary/8 px-1.5 py-0.5 text-2xs font-bold text-primary transition-colors cursor-pointer hover:bg-primary/15 ${isCompleting ? 'opacity-[var(--opacity-50)]' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingTodo(todo);
                  setEditingTodoTitle(todo.title);
                }}
              >
                <Pressable
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleTodo(todo.id);
                    setToastMessage(`Ukończono: "${todo.title}" ✅`);
                  }}
                  aria-label={`Oznacz zadanie jako wykonane: ${todo.title}`}
                  className={`relative after:absolute after:-inset-2 h-2.5 w-2.5 shrink-0 rounded-sm border flex items-center justify-center transition-colors ${isCompleting ? 'bg-success border-success' : 'border-primary/50 hover:bg-primary/20'}`}
                >
                  {isCompleting && <Check size={7} className="text-on-accent" strokeWidth={4} />}
                </Pressable>
                {GoalIcon && <GoalIcon size={8} className="shrink-0" />}
                <span className={`truncate ${isCompleting ? 'line-through' : ''}`}>{todo.title}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
