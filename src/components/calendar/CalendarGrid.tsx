/**
 * @component CalendarGrid
 * @role Dispatcher renderowania siatki — wybiera day/3-day/week/month/agenda.
 * @composes grid/CalendarDayView, grid/Calendar3DayView, grid/CalendarWeekView, grid/CalendarMonthView, grid/CalendarAgendaView
 * @usedBy CalendarView
 */
import React, { useRef, useEffect, useMemo } from 'react';
import { useCalendarData } from './hooks/useCalendarData';
import {
  PX_PER_HOUR,
  addDays,
  todayStr,
  dateOfISO,
  getWarsawOffset,
  weekMon,
} from './calendarHelpers';
import { useCalendarDragSelect } from './grid/useCalendarDragSelect';
import { CalendarDayView } from './grid/CalendarDayView';
import { Calendar3DayView } from './grid/Calendar3DayView';
import { CalendarWeekView } from './grid/CalendarWeekView';
import { CalendarMonthView } from './grid/CalendarMonthView';
import type { CalRow } from './calendarHelpers';
import type { CalendarTodo } from './hooks/useCalendarTodos';
import type { GoalChip } from './grid/types';

interface CalendarGridProps {
  calData: ReturnType<typeof useCalendarData>;
  userId: string | undefined;
  onSyncCalendar: () => void;
  isSyncing: boolean;
  handleToggleTodo: (id: string) => void;
  completedTodoIds: Set<string>;
  todosForDay: (day: string) => CalendarTodo[];
  goalChipFor: (sectionId: string | null) => GoalChip;
  scheduleTodoAt: (todo: { id: string }, day: string, startMin: number, duration: number) => Promise<unknown>;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  calData,
  userId: _userId,
  onSyncCalendar,
  isSyncing,
  handleToggleTodo,
  completedTodoIds,
  todosForDay,
  goalChipFor,
  scheduleTodoAt,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const {
    calView,
    setCalView,
    selectedDay,
    setSelectedDay,
    weekStart,
    setWeekStart,
    displayEvents: events,
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

  const { dragSelect, handleColumnMouseDown, handleColumnMouseMove } = useCalendarDragSelect({
    setQuickDuration,
    setQuickCreate,
  });

  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.scrollTop = 7.5 * PX_PER_HOUR;
    }
  }, [calView]);

  const today = useMemo(() => todayStr(), []);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalRow[]> = {};
    const add = (day: string, ev: CalRow) => {
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
      const midnightISO = `${endDay}T00:00:00${getWarsawOffset(ev.start_time)}`;
      add(startDay, { ...ev, end_time: midnightISO });
      add(endDay, { ...ev, start_time: midnightISO });
    }
    return map;
  }, [events]);

  const getEventsForDay = (day: string) => eventsByDay[day] || [];

  // Horizontal touch swipe navigation for mobile screens
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length !== 1) return;
    const diffX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const diffY = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(diffX) > 60 && Math.abs(diffY) < 45) {
      const direction = diffX < 0 ? 1 : -1;
      if (calView === 'dzien') {
        const next = addDays(selectedDay, direction);
        setSelectedDay(next);
        setWeekStart(weekMon(next));
      } else if (calView === '3dni') {
        const next = addDays(selectedDay, direction * 3);
        setSelectedDay(next);
        setWeekStart(next);
      } else if (calView === 'tydzien') {
        const next = addDays(weekStart, direction * 7);
        setSelectedDay(next);
        setWeekStart(next);
      } else if (calView === 'miesiac') {
        const [y, m] = selectedDay.split('-').map(Number);
        const d = new Date(y, m - 1 + direction, 1);
        const newY = d.getFullYear();
        const newM = String(d.getMonth() + 1).padStart(2, '0');
        setSelectedDay(`${newY}-${newM}-01`);
      }
    }
  };

  const renderContent = () => {
    switch (calView) {
      case 'dzien':
        return (
          <CalendarDayView
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            setWeekStart={setWeekStart}
            weather={weather}
            today={today}
            nowMin={nowMin}
            dragSelect={dragSelect}
            goalChipFor={goalChipFor}
            completedTodoIds={completedTodoIds}
            getEventsForDay={getEventsForDay}
            todosForDay={todosForDay}
            handleColumnMouseDown={handleColumnMouseDown}
            handleColumnMouseMove={handleColumnMouseMove}
            handleEventMouseDown={handleEventMouseDown}
            handleToggleTodo={handleToggleTodo}
            setEditingTodo={setEditingTodo}
            setEditingTodoTitle={setEditingTodoTitle}
            setToastMessage={setToastMessage}
            setSaving={setSaving}
            scheduleTodoAt={scheduleTodoAt}
            gridRef={gridRef}
          />
        );
      case '3dni':
        return (
          <Calendar3DayView
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            setWeekStart={setWeekStart}
            weather={weather}
            today={today}
            nowMin={nowMin}
            dragSelect={dragSelect}
            goalChipFor={goalChipFor}
            completedTodoIds={completedTodoIds}
            getEventsForDay={getEventsForDay}
            todosForDay={todosForDay}
            handleColumnMouseDown={handleColumnMouseDown}
            handleColumnMouseMove={handleColumnMouseMove}
            handleEventMouseDown={handleEventMouseDown}
            handleToggleTodo={handleToggleTodo}
            setEditingTodo={setEditingTodo}
            setEditingTodoTitle={setEditingTodoTitle}
            setToastMessage={setToastMessage}
            setSaving={setSaving}
            scheduleTodoAt={scheduleTodoAt}
            gridRef={gridRef}
          />
        );
      case 'tydzien':
        return (
          <CalendarWeekView
            weekStart={weekStart}
            setWeekStart={setWeekStart}
            setSelectedDay={setSelectedDay}
            weather={weather}
            today={today}
            nowMin={nowMin}
            weekDays={weekDays}
            dragSelect={dragSelect}
            goalChipFor={goalChipFor}
            completedTodoIds={completedTodoIds}
            getEventsForDay={getEventsForDay}
            todosForDay={todosForDay}
            handleColumnMouseDown={handleColumnMouseDown}
            handleColumnMouseMove={handleColumnMouseMove}
            handleEventMouseDown={handleEventMouseDown}
            handleToggleTodo={handleToggleTodo}
            setEditingTodo={setEditingTodo}
            setEditingTodoTitle={setEditingTodoTitle}
            setToastMessage={setToastMessage}
            setSaving={setSaving}
            scheduleTodoAt={scheduleTodoAt}
            gridRef={gridRef}
          />
        );
      case 'miesiac':
        return (
          <CalendarMonthView
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            setCalView={setCalView}
            getEventsForDay={getEventsForDay}
            todosForDay={todosForDay}
            handleEventClick={handleEventClick}
            setQuickCreate={setQuickCreate}
            today={today}
          />
        );
    }
  };

  return (
    <div
      className="flex-1 flex flex-col min-h-0 overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {renderContent()}
    </div>
  );
};
