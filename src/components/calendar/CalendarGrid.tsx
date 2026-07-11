import React, { useRef, useEffect, useMemo } from 'react';
import { useCalendarData } from './useCalendarData';
import {
  PX_PER_HOUR,
  addDays,
  todayStr,
  dateOfISO,
  getWarsawOffset,
} from './calendarHelpers';
import { useCalendarDragSelect } from './grid/useCalendarDragSelect';
import { CalendarDayView } from './grid/CalendarDayView';
import { CalendarWeekView } from './grid/CalendarWeekView';
import { CalendarAgendaView } from './grid/CalendarAgendaView';

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
      const midnightISO = `${endDay}T00:00:00${getWarsawOffset(ev.start_time)}`;
      add(startDay, { ...ev, end_time: midnightISO });
      add(endDay, { ...ev, start_time: midnightISO });
    }
    return map;
  }, [events]);

  const getEventsForDay = (day: string) => eventsByDay[day] || [];

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
    case 'agenda':
      return (
        <CalendarAgendaView
          today={today}
          events={events}
          loading={loading}
          getEventsForDay={getEventsForDay}
          todosForDay={todosForDay}
          goalChipFor={goalChipFor}
          completedTodoIds={completedTodoIds}
          handleEventClick={handleEventClick}
          handleToggleTodo={handleToggleTodo}
          setToastMessage={setToastMessage}
          onSyncCalendar={onSyncCalendar}
          isSyncing={isSyncing}
        />
      );
  }
};
