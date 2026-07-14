import React from 'react';
import { Check, Calendar, RefreshCw } from 'lucide-react';
import Button from '../../ui/Button';
import {
  eventColor,
  formatTime,
  dayLabel,
  addDays,
} from '../calendarHelpers';
import { GOAL_ICON } from '../../todo/todoUtils';
import type { CalRow } from '../calendarHelpers';
import type { CalendarTodo } from '../hooks/useCalendarTodos';
import type { GoalChip } from './types';

interface CalendarAgendaViewProps {
  today: string;
  events: CalRow[];
  loading: boolean;
  getEventsForDay: (day: string) => CalRow[];
  todosForDay: (day: string) => CalendarTodo[];
  goalChipFor: (sectionId: string | null) => GoalChip;
  completedTodoIds: Set<string>;
  handleEventClick: (ev: CalRow) => void;
  handleToggleTodo: (id: string) => void;
  setToastMessage: (msg: string) => void;
  onSyncCalendar: () => void;
  isSyncing: boolean;
}

export const CalendarAgendaView: React.FC<CalendarAgendaViewProps> = ({
  today,
  events,
  loading,
  getEventsForDay,
  todosForDay,
  goalChipFor,
  completedTodoIds,
  handleEventClick,
  handleToggleTodo,
  setToastMessage,
  onSyncCalendar,
  isSyncing,
}) => {
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
              <span className={`text-xs font-black ${day === today ? 'text-primary' : 'text-text-muted'}`}>
                {day === today ? 'Dziś' : dayLabel(day)}
              </span>
              {dayEv.length === 0 && dayTodos.length === 0 && (
                <span className="text-2xs text-text-muted/40">brak wydarzeń</span>
              )}
            </div>
            <div className="space-y-1.5">
              {dayEv.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => handleEventClick(ev)}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer hover:scale-[1.005] active:scale-[0.995] transition-all ${eventColor(ev).replace('bg-', 'border-').split(' ')[0]} bg-surface-solid/50`}
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${eventColor(ev).split(' ')[0].replace('bg-', 'bg-')}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text-primary line-clamp-1">{ev.summary}</p>
                    {ev.start_time && (
                      <p className="text-2xs text-text-muted mt-0.5">
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
                      className={`relative after:absolute after:-inset-2 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${isCompleting ? 'bg-success border-success' : 'border-primary/40 hover:bg-primary/10'}`}
                    >
                      {isCompleting && <Check size={10} className="text-white" strokeWidth={3} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold text-text-primary line-clamp-1 ${isCompleting ? 'line-through' : ''}`}>{todo.title}</p>
                      <p className="text-2xs text-text-muted mt-0.5">
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
            <p className="text-sm font-bold text-text-muted">Brak wydarzeń</p>
            <p className="text-xs text-text-muted/60 mt-1">Zsynchronizuj Google Calendar</p>
          </div>
          <Button
            onClick={onSyncCalendar}
            variant="tonal"
            icon={<RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />}
            className="rounded-full px-4 py-2 text-sm"
          >
            Synchronizuj
          </Button>
        </div>
      )}
    </div>
  );
};
