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
} from './calendarHelpers';
import { useCalendarDragSelect } from './grid/useCalendarDragSelect';
import { CalendarDayView } from './grid/CalendarDayView';
import { Calendar3DayView } from './grid/Calendar3DayView';
import { CalendarWeekView } from './grid/CalendarWeekView';
import { CalendarMonthView } from './grid/CalendarMonthView';
import type { CalRow } from './calendarHelpers';
import type { CalendarTodo } from './hooks/useCalendarTodos';
import type { GoalChip } from './grid/types';
import { useCalendarGridSwipe } from './grid/useCalendarGridSwipe';

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

function groupEventsByDay(events: CalRow[]): Record<string, CalRow[]> {
  const grouped: Record<string, CalRow[]> = {};
  const add = (day: string, event: CalRow) => {
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(event);
  };
  for (const event of events) {
    if (!event.start_time) continue;
    const startDay = dateOfISO(event.start_time);
    const endDay = event.end_time ? dateOfISO(event.end_time) : startDay;
    if (startDay === endDay) {
      add(startDay, event);
    } else {
      const midnight = `${endDay}T00:00:00${getWarsawOffset(event.start_time)}`;
      add(startDay, { ...event, end_time: midnight });
      add(endDay, { ...event, start_time: midnight });
    }
  }
  return grouped;
}

function useInitialGridScroll(gridRef: React.RefObject<HTMLDivElement | null>, calendarView: string) {
  useEffect(() => {
    if (gridRef.current) gridRef.current.scrollTop = 7.5 * PX_PER_HOUR;
  }, [calendarView, gridRef]);
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  calData,
  userId: _userId,
  onSyncCalendar: _onSyncCalendar,
  isSyncing: _isSyncing,
  handleToggleTodo,
  completedTodoIds,
  todosForDay,
  goalChipFor,
  scheduleTodoAt,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);

  const {
    calView, setCalView,
    selectedDay, setSelectedDay,
    weekStart, setWeekStart,
    displayEvents: events,
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

  useInitialGridScroll(gridRef, calView);

  const today = useMemo(() => todayStr(), []);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const eventsByDay = useMemo(() => groupEventsByDay(events), [events]);

  const getEventsForDay = (day: string) => eventsByDay[day] || [];

  const { onTouchStart, onTouchEnd } = useCalendarGridSwipe({
    calView,
    selectedDay,
    weekStart,
    setSelectedDay,
    setWeekStart,
  });

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
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {renderContent()}
    </div>
  );
};
