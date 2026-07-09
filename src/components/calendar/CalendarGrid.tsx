import React, { useRef, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Shield,
  Check,
  Calendar,
  RefreshCw,
  Sun,
  Moon,
  Cloud,
  CloudSun,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  Wind,
} from 'lucide-react';
import { useCalendarData } from './useCalendarData';
import {
  HOUR_START,
  HOUR_END,
  HOURS,
  PX_PER_HOUR,
  PX_PER_MIN,
  layoutDayEvents,
  eventColor,
  formatTime,
  monthLabel,
  dayLabel,
  addDays,
  todayStr,
  weekMon,
  parseTime,
  dateOfISO,
  getWarsawOffset,
} from './calendarHelpers';
import { GOAL_ICON } from '../todo/todoUtils';
import { getSunTimes, formatTimeWarsaw } from '../../lib/solar';

// Weather Helpers
const WMO_WEATHER_DESC: Record<number, string> = {
  0: 'Jasno',
  1: 'Zachmurzenie częściowe',
  2: 'Zachmurzenie częściowe',
  3: 'Pochmurno',
  45: 'Mgła',
  48: 'Mgła',
  51: 'Mżawka',
  53: 'Mżawka',
  55: 'Mżawka',
  61: 'Deszcz',
  63: 'Deszcz',
  65: 'Deszcz',
  71: 'Śnieg',
  73: 'Śnieg',
  75: 'Śnieg',
  80: 'Przelotny deszcz',
  81: 'Przelotny deszcz',
  82: 'Przelotny deszcz',
  95: 'Burza',
  96: 'Burza',
  99: 'Burza',
};

function getWMOWeatherIcon(code: number, size = 12, isNight = false) {
  switch (code) {
    case 0:
      return isNight ? <Moon size={size} className="text-indigo-300 animate-pulse" /> : <Sun size={size} className="text-amber-400" />;
    case 1:
    case 2:
      return isNight ? <CloudMoon size={size} className="text-slate-300" /> : <CloudSun size={size} className="text-amber-300" />;
    case 3:
      return <Cloud size={size} className="text-slate-400" />;
    case 45:
    case 48:
      return <Wind size={size} className="text-zinc-400" />;
    case 51:
    case 53:
    case 55:
      return <CloudDrizzle size={size} className="text-sky-300" />;
    case 61:
    case 63:
    case 65:
      return <CloudRain size={size} className="text-blue-400" />;
    case 71:
    case 73:
    case 75:
      return <CloudSnow size={size} className="text-sky-200" />;
    case 80:
    case 81:
    case 82:
      return <CloudRain size={size} className="text-sky-400" />;
    case 95:
    case 96:
    case 99:
      return <CloudLightning size={size} className="text-amber-500 animate-pulse" />;
    default:
      return <Cloud size={size} className="text-slate-400" />;
  }
}

interface CalendarGridProps {
  calData: ReturnType<typeof useCalendarData>;
  userId: string | undefined;
  onSyncCalendar: () => void;
  isSyncing: boolean;
  handleToggleTodo: (id: string) => void;
  completedTodoIds: Set<string>;
  todosForDay: (day: string) => any[];
  goalChipFor: (sectionId: string | null) => any;
  scheduleTodoAt: (todo: any, day: string, startMin: number, duration: number) => Promise<any>;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  calData,
  userId,
  onSyncCalendar,
  isSyncing,
  handleToggleTodo,
  completedTodoIds,
  todosForDay,
  goalChipFor,
  scheduleTodoAt,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);

  const {
    calView,
    selectedDay,
    setSelectedDay,
    weekStart,
    setWeekStart,
    events,
    loading,
    weather,
    nowMin,
    setQuickCreate,
    setQuickDuration,
    setEditingTodo,
    setEditingTodoTitle,
    setToastMessage,
    setSaving,
    handleEventMouseDown,
    handleEventClick,
  } = calData;

  const [dragSelect, setDragSelect] = useState<{
    day: string;
    startMin: number;
    currentMin: number;
  } | null>(null);

  // Global mouseup to complete drag-to-create reliably
  useEffect(() => {
    if (!dragSelect) return;

    const handleGlobalMouseUp = () => {
      const start = Math.min(dragSelect.startMin, dragSelect.currentMin);
      const end = Math.max(dragSelect.startMin, dragSelect.currentMin);
      
      // If the drag duration is very small (less than 15 mins), treat it as a click and default to 60 mins
      const duration = end - start < 15 ? 60 : end - start;

      setQuickDuration(duration);
      setQuickCreate({ date: dragSelect.day, startMin: start });
      setDragSelect(null);
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragSelect, setQuickDuration, setQuickCreate]);

  const handleColumnMouseDown = (day: string, e: React.MouseEvent) => {
    // Only capture left clicks
    if (e.button !== 0) return;
    
    // Ignore clicks on event blocks, resize handles, or todo cards
    const target = e.target as HTMLElement;
    if (target.closest('.cursor-move') || target.closest('.cursor-s-resize') || target.closest('.cursor-grab')) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const clickedMin = Math.round((offsetY / PX_PER_MIN) / 15) * 15 + HOUR_START * 60;

    setDragSelect({
      day,
      startMin: clickedMin,
      currentMin: clickedMin,
    });
  };

  const handleColumnMouseMove = (day: string, e: React.MouseEvent) => {
    if (!dragSelect || dragSelect.day !== day) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const currentMin = Math.round((offsetY / PX_PER_MIN) / 15) * 15 + HOUR_START * 60;

    setDragSelect({
      ...dragSelect,
      currentMin: Math.max(HOUR_START * 60, Math.min(HOUR_END * 60, currentMin)),
    });
  };

  // Auto-scroll grid to start hour on mount and on view switches
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.scrollTop = 7.5 * PX_PER_HOUR; // Scroll to ~7:30 AM
    }
  }, [calView]);

  const today = useMemo(() => todayStr(), []);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Filter events and map by day for performance
  const eventsByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    const add = (day: string, ev: any) => {
      if (!map[day]) map[day] = [];
      map[day].push(ev);
    };
    for (const ev of events) {
      if (!ev.start_time) continue;
      const startDay = dateOfISO(ev.start_time);
      const endDay = ev.end_time ? dateOfISO(ev.end_time) : startDay;
      if (startDay === endDay) {
        add(startDay, ev);
        continue;
      }
      // Event crosses local midnight (e.g. Oura sleep starting ~23:xx, waking
      // next morning). A single block anchored to raw clock time would render
      // invisible or garbled, since renderEventBlock has no cross-midnight
      // awareness. Split into a head segment (start..midnight) on startDay and
      // a tail segment (midnight..end) on endDay — each renders correctly.
      const midnightISO = `${endDay}T00:00:00${getWarsawOffset(ev.start_time)}`;
      add(startDay, { ...ev, end_time: midnightISO });
      add(endDay, { ...ev, start_time: midnightISO });
    }
    return map;
  }, [events]);

  const getEventsForDay = (day: string) => eventsByDay[day] || [];

  const handleSlotClick = (day: string, hour: number, e: React.MouseEvent) => {
    // Avoid opening quick create if clicking on existing event or handle
    if ((e.target as HTMLElement).closest('.cursor-move')) return;
    
    // Snapping offset
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const clickedMin = Math.round((offsetY / PX_PER_HOUR) * 60 / 15) * 15;
    const startMin = hour * 60 + clickedMin;
    
    setQuickCreate({ date: day, startMin });
  };

  const renderEventBlock = (ev: any, left: string, width: string) => {
    if (!ev.start_time || !ev.end_time) return null;
    const startMin = parseTime(ev.start_time);
    const endMin = parseTime(ev.end_time);
    
    if (endMin <= HOUR_START * 60 || startMin >= HOUR_END * 60) return null;

    const visibleStartMin = Math.max(HOUR_START * 60, startMin);
    const visibleEndMin = Math.min(HOUR_END * 60, endMin);
    const top = (visibleStartMin - HOUR_START * 60) * PX_PER_MIN;
    const height = Math.max(20, (visibleEndMin - visibleStartMin) * PX_PER_MIN);
    const tooShort = height < 32;
    const isAIScheduled = ev.summary?.includes('✨') || ev.summary?.includes('[AI]');
    const isFocusTime = ev.summary?.includes('Focus Time') || ev.summary?.includes('🛡️');

    let displaySummary = ev.summary;
    if (tooShort) {
      const isSleep = ev.summary?.toLowerCase().includes('sen') || ev.summary?.toLowerCase().includes('sleep');
      if (isSleep) {
        displaySummary = `${formatTime(ev.start_time)}-${formatTime(ev.end_time)}`;
      } else {
        displaySummary = `${ev.summary} (${formatTime(ev.start_time)}–${formatTime(ev.end_time)})`;
      }
    }

    return (
      <div
        key={ev.id}
        onMouseDown={(e) => handleEventMouseDown(ev, e, 'move')}
        className={`absolute rounded-md shadow-sm ${tooShort ? 'px-1 py-0.5 flex items-center justify-start' : 'px-1.5 py-1'} overflow-hidden cursor-move hover:shadow-md hover:brightness-110 hover:scale-[1.01] active:scale-[0.99] active:brightness-95 transition-all duration-150 hover:z-20 select-none ${eventColor(ev)}`}
        style={{ top, height, left: `calc(${left} + 1px)`, width: `calc(${width} - 2px)` }}
        title={ev.summary || ''}
      >
        <div className="flex items-start gap-0.5 min-w-0 w-full justify-start flex-wrap">
          {isAIScheduled && !tooShort && <Sparkles size={9} className="shrink-0 animate-pulse opacity-90 mt-0.5" />}
          {isFocusTime && !tooShort && <Shield size={9} className="shrink-0 opacity-90 mt-0.5" />}
          <p className={`${tooShort ? 'text-[8.5px]' : 'text-[9.5px]'} font-extrabold leading-tight break-all whitespace-normal line-clamp-3`}>
            {displaySummary}
          </p>
        </div>
        {!tooShort && (
          <div className="opacity-85 text-[8.5px] font-bold leading-none mt-0.5 break-all whitespace-normal">
            <span>{formatTime(ev.start_time)}–{formatTime(ev.end_time)}</span>
          </div>
        )}
        <div
          onMouseDown={(e) => handleEventMouseDown(ev, e, 'resize')}
          className="absolute bottom-0 left-0 right-0 h-1.5 cursor-s-resize hover:bg-black/10 dark:hover:bg-white/10 z-30"
        />
      </div>
    );
  };

  const renderTodoBlock = (todo: any) => {
    if (!todo.scheduled_time) return null;
    const startMin = parseTime(todo.scheduled_time);
    const duration = todo.duration_minutes || 30;
    const visibleStartMin = Math.max(HOUR_START * 60, startMin);
    const visibleEndMin = Math.min(HOUR_END * 60, startMin + duration);
    if (visibleEndMin <= visibleStartMin) return null;
    const top = (visibleStartMin - HOUR_START * 60) * PX_PER_MIN;
    const height = Math.max(18, (visibleEndMin - visibleStartMin) * PX_PER_MIN);
    const chip = goalChipFor(todo.section_id);
    const GoalIcon = chip ? GOAL_ICON[chip.pillar] : null;
    const isCompleting = todo.status === 'done' || completedTodoIds.has(todo.id);
    return (
      <div
        key={`todo-${todo.id}`}
        title={`${todo.title}${chip?.dreamTitle ? ` · ${chip.dreamTitle}` : ''}`}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.setData('text/plain', JSON.stringify({ id: todo.id, title: todo.title, duration_minutes: todo.duration_minutes }));
          e.dataTransfer.effectAllowed = 'move';
        }}
        onClick={(e) => {
          e.stopPropagation();
          setEditingTodo(todo);
          setEditingTodoTitle(todo.title);
        }}
        className={`absolute rounded-md border border-dashed border-primary/50 bg-primary/10 hover:bg-primary/20 hover:scale-[1.01] hover:shadow-md px-1 py-0.5 overflow-hidden transition-all duration-150 z-10 cursor-grab active:cursor-grabbing ${isCompleting ? 'opacity-50' : ''}`}
        style={{ top, height, left: '75%', width: '24%' }}
      >
        <div className="flex items-start gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleTodo(todo.id);
              setToastMessage(`Ukończono: "${todo.title}" ✅`);
            }}
            className={`relative after:absolute after:-inset-2 mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm border flex items-center justify-center transition-colors ${isCompleting ? 'bg-emerald-500 border-emerald-500' : 'border-primary/50 hover:bg-primary/20'}`}
          >
            {isCompleting && <Check size={6} className="text-white" strokeWidth={4} />}
          </button>
          <p className={`flex items-center gap-0.5 text-[8px] font-bold text-primary leading-tight line-clamp-2 ${isCompleting ? 'line-through' : ''}`}>
            {GoalIcon && <GoalIcon size={7} className="shrink-0" />}
            <span className="truncate">{todo.title}</span>
          </p>
        </div>
      </div>
    );
  };

  const renderTimeGutter = (dayKey?: string) => {
    const tomorrow = addDays(today, 1);
    const showHourlyWeather = dayKey === today || dayKey === tomorrow;
    const hourlyForDay = showHourlyWeather && weather?.hourly?.[dayKey!] ? weather.hourly[dayKey!] : null;

    const hourlyByHour: Record<number, any> = {};
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
                transform: 'translateY(-50%)',
                height: 20,
                width: gutterWidth,
              }}
            >
              {hw && showHourlyWeather && (
                <div
                  className="flex items-center gap-0.5 mr-1"
                  title={`${WMO_WEATHER_DESC[hw.weatherCode]}${hw.precipProb > 0 ? ` · opady ${hw.precipProb}%` : ''}`}
                >
                  {getWMOWeatherIcon(hw.weatherCode, 9, absoluteHour < 6 || absoluteHour >= 20)}
                  <span className={`text-[8.5px] font-black leading-none tabular-nums ${hw.precipProb >= 50 ? 'text-sky-400' : 'text-text-muted/70'}`}>
                    {hw.temp}°
                  </span>
                </div>
              )}
              <span className="text-[10.5px] font-black text-text-secondary/80 text-right pr-2">
                {String(absoluteHour).padStart(2, '0')}:00
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDayColumn = (day: string, colClass = '') => {
    const dayEvents = getEventsForDay(day);
    const dayTodos = todosForDay(day).filter((t) => t.scheduled_time);
    const isToday = day === today;
    const nowLine = isToday ? (nowMin - HOUR_START * 60) * PX_PER_MIN : null;

    // Selection overlay calculations
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
        {/* Render horizontal grid lines */}
        {Array.from({ length: HOURS }, (_, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 border-b border-border-custom/10 pointer-events-none"
            style={{ top: i * PX_PER_HOUR, height: PX_PER_HOUR }}
          />
        ))}

        {/* Drag selection visual overlay */}
        {showSelection && selectionHeight > 0 && (
          <div
            className="absolute left-0 right-0 bg-primary/20 border border-primary/50 rounded-md pointer-events-none z-30 flex items-center justify-center shadow-lg"
            style={{ top: selectionTop, height: selectionHeight }}
          >
            <span className="text-[9px] font-black text-primary bg-background border border-border-custom/40 px-1.5 py-0.5 rounded shadow-md tabular-nums">
              {Math.floor(startMin / 60)}:{String(startMin % 60).padStart(2, '0')} - {Math.floor(endMin / 60)}:{String(endMin % 60).padStart(2, '0')}
            </span>
          </div>
        )}
        {(() => {
          const layouts = layoutDayEvents(dayEvents);
          return dayEvents.map((ev: any) => {
            const layout = layouts.get(ev.id) || { left: '0%', width: '100%' };
            return renderEventBlock(ev, layout.left, layout.width);
          });
        })()}
        {dayTodos.map(renderTodoBlock)}
        {/* Sunrise / sunset lines */}
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
                  className="absolute left-0 right-0 flex items-center pointer-events-none z-10"
                  style={{ top: sunriseTop }}
                  title={`Wschód: ${formatTimeWarsaw(sun.sunrise)}`}
                >
                  <div className="w-full h-[1px] bg-gradient-to-r from-amber-400/0 via-amber-400/50 to-amber-400/0" />
                  <span className="absolute right-1 text-[7px] font-bold text-amber-400/70 select-none">🌅 {formatTimeWarsaw(sun.sunrise)}</span>
                </div>
              )}
              {sunsetVisible && (
                <div
                  className="absolute left-0 right-0 flex items-center pointer-events-none z-10"
                  style={{ top: sunsetTop }}
                  title={`Zachód: ${formatTimeWarsaw(sun.sunset)}`}
                >
                  <div className="w-full h-[1px] bg-gradient-to-r from-orange-500/0 via-orange-500/50 to-orange-500/0" />
                  <span className="absolute right-1 text-[7px] font-bold text-orange-400/70 select-none">🌇 {formatTimeWarsaw(sun.sunset)}</span>
                </div>
              )}
            </>
          );
        })()}
        {nowLine !== null && nowLine >= 0 && (
          <div className="absolute left-0 right-0 flex items-center pointer-events-none z-20" style={{ top: nowLine }}>
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-md shadow-rose-500/50 animate-pulse -ml-[5px]" />
            <div className="flex-1 h-[1.5px] bg-rose-500" />
          </div>
        )}
      </div>
    );
  };

  const renderAllDayTodos = (days: string[]) => {
    const untimedByDay = days.map((day) => todosForDay(day).filter((t) => !t.scheduled_time));
    if (!untimedByDay.some((list) => list.length > 0)) return null;
    return (
      <div className="flex border-b border-border-custom/20 bg-surface-solid/10" style={{ paddingLeft: 44 }}>
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
                  className={`flex items-center gap-1.5 truncate rounded border border-dashed border-primary/40 bg-primary/8 px-1.5 py-0.5 text-[9px] font-bold text-primary transition-colors cursor-pointer hover:bg-primary/15 ${isCompleting ? 'opacity-50' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTodo(todo);
                    setEditingTodoTitle(todo.title);
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleTodo(todo.id);
                      setToastMessage(`Ukończono: "${todo.title}" ✅`);
                    }}
                    className={`relative after:absolute after:-inset-2 h-2.5 w-2.5 shrink-0 rounded-sm border flex items-center justify-center transition-colors ${isCompleting ? 'bg-emerald-500 border-emerald-500' : 'border-primary/50 hover:bg-primary/20'}`}
                  >
                    {isCompleting && <Check size={7} className="text-white" strokeWidth={4} />}
                  </button>
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

  const renderDayView = () => {
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
        {renderAllDayTodos([selectedDay])}
        <div ref={gridRef} className="flex-1 overflow-y-auto">
          <div className="flex" style={{ minHeight: HOURS * PX_PER_HOUR + 40 }}>
            {renderTimeGutter(selectedDay)}
            <div className="flex-1 relative">
              {renderDayColumn(selectedDay)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
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
                  {new Date(day + 'T12:00:00').toLocaleDateString('pl-PL', { weekday: 'short' })}
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
        {renderAllDayTodos(weekDays)}
        <div ref={gridRef} className="flex-1 overflow-y-auto">
          <div className="flex" style={{ minHeight: HOURS * PX_PER_HOUR + 40 }}>
            {renderTimeGutter()}
            {weekDays.map((day) => (
              <div
                key={day}
                data-day-col={day}
                className={`flex-1 relative border-l border-border-custom/30 ${day === today ? 'bg-primary/[0.02]' : ''}`}
              >
                {renderDayColumn(day)}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderAgendaView = () => {
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
    return (
      <div className="flex-1 overflow-y-auto pb-20">
        {days.map((day) => {
          const dayEv = getEventsForDay(day);
          const dayTodos = todosForDay(day);
          if (dayEv.length === 0 && dayTodos.length === 0 && day !== today) return null;
          return (
            <div key={day} className="px-4 pt-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[11px] font-black ${day === today ? 'text-primary' : 'text-text-muted'}`}>
                  {day === today ? 'Dziś' : dayLabel(day)}
                </span>
                {dayEv.length === 0 && dayTodos.length === 0 && (
                  <span className="text-[9px] text-text-muted/40">brak wydarzeń</span>
                )}
              </div>
              <div className="space-y-1.5">
                {dayEv.map((ev: any) => (
                  <div
                    key={ev.id}
                    onClick={() => handleEventClick(ev)}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer hover:scale-[1.005] active:scale-[0.995] transition-all ${eventColor(ev).replace('bg-', 'border-').split(' ')[0]} bg-surface-solid/50`}
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${eventColor(ev).split(' ')[0].replace('bg-', 'bg-')}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-text-primary line-clamp-1">{ev.summary}</p>
                      {ev.start_time && (
                        <p className="text-[9px] text-text-muted mt-0.5">
                          {formatTime(ev.start_time)}{ev.end_time ? ` – ${formatTime(ev.end_time)}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {dayTodos.map((todo) => {
                  const chip = goalChipFor(todo.section_id);
                  const GoalIcon = chip ? GOAL_ICON[chip.pillar] : null;
                  const isCompleting = todo.status === 'done' || completedTodoIds.has(todo.id);
                  return (
                    <div
                      key={todo.id}
                      className={`flex items-center gap-3 rounded-xl border border-dashed border-primary/30 px-3 py-2.5 transition-all bg-primary/[0.03] ${isCompleting ? 'opacity-50' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTodo(todo.id);
                          setToastMessage(`Ukończono: "${todo.title}" ✅`);
                        }}
                        className={`relative after:absolute after:-inset-2 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${isCompleting ? 'bg-emerald-500 border-emerald-500' : 'border-primary/40 hover:bg-primary/10'}`}
                      >
                        {isCompleting && <Check size={10} className="text-white" strokeWidth={3} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[12px] font-semibold text-text-primary line-clamp-1 ${isCompleting ? 'line-through' : ''}`}>{todo.title}</p>
                        <p className="text-[9px] text-text-muted mt-0.5">
                          {todo.scheduled_time ? formatTime(todo.scheduled_time) : 'Cały dzień'}
                          {chip?.dreamTitle && <span className="opacity-70"> · {chip.dreamTitle}</span>}
                        </p>
                      </div>
                      {GoalIcon && <GoalIcon size={11} className="shrink-0 opacity-60" />}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 border-b border-border-custom/10" />
            </div>
          );
        })}
        {events.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Calendar size={32} className="text-text-muted/30" />
            <div className="text-center">
              <p className="text-[13px] font-bold text-text-muted">Brak wydarzeń</p>
              <p className="text-[11px] text-text-muted/60 mt-1">Zsynchronizuj Google Calendar</p>
            </div>
            <button
              onClick={onSyncCalendar}
              className="flex items-center gap-2 rounded-full bg-primary/10 text-primary border border-primary/20 px-4 py-2 text-[12px] font-bold"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              Synchronizuj
            </button>
          </div>
        )}
      </div>
    );
  };

  switch (calView) {
    case 'dzien': return renderDayView();
    case 'tydzien': return renderWeekView();
    case 'agenda': return renderAgendaView();
  }
};
