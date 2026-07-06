import { useState } from 'react';
import { parseTime, getWarsawOffset, type CalRow } from '../components/calendar/calendarHelpers';
import type { CalendarTodo } from './useCalendarTodos';
import type { CalendarEvent } from './useCalendarWrite';

interface UseAISchedulingProps {
  userId: string | undefined;
  selectedDay: string;
  eventsForDay: (day: string) => CalRow[];
  focusTimeDefense: boolean;
  decompressionBuffer: boolean;
  inboxTodos: CalendarTodo[];
  createEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<{ success: boolean; eventId?: string }>;
  scheduleTodoAt: (todo: { id: string }, day: string, startMin: number, durationMinutes?: number) => Promise<void>;
  fetchEvents: () => Promise<void>;
  fetchAllTodos: () => Promise<void>;
  setToastMessage: (msg: string | null) => void;
}

export function useAIScheduling({
  userId,
  selectedDay,
  eventsForDay,
  focusTimeDefense,
  decompressionBuffer,
  inboxTodos,
  createEvent,
  scheduleTodoAt,
  fetchEvents,
  fetchAllTodos,
  setToastMessage,
}: UseAISchedulingProps) {
  const [isScheduling, setIsScheduling] = useState(false);

  const handleAISchedule = async () => {
    if (!userId) return;
    if (inboxTodos.length === 0) {
      setToastMessage('Brak zadań w skrzynce Inbox do zaplanowania.');
      return;
    }
    setIsScheduling(true);
    try {
      const dayEvents = eventsForDay(selectedDay);
      let busyIntervals = dayEvents.map(ev => {
        const start = parseTime(ev.start_time || '');
        const end = parseTime(ev.end_time || '');
        return { start, end };
      }).sort((a, b) => a.start - b.start);

      // Focus Time Defense: check 8:00 - 10:00 (480 to 600 min)
      if (focusTimeDefense) {
        const overlapsFocus = busyIntervals.some(i => (i.start < 600 && i.end > 480));
        if (!overlapsFocus) {
          const startISO = `${selectedDay}T08:00:00${getWarsawOffset(selectedDay)}`;
          const endISO = `${selectedDay}T10:00:00${getWarsawOffset(selectedDay)}`;
          await createEvent({
            summary: 'Focus Time 🛡️',
            start: startISO,
            end: endISO,
            category: 'praca'
          });
          busyIntervals.push({ start: 480, end: 600 });
          busyIntervals.sort((a, b) => a.start - b.start);
        }
      }

      // Schedule inbox tasks — give each one a due_date + scheduled_time on the todo itself,
      // not a synced calendar_event, so it stays in sync with the same row Todo.tsx edits.
      let currentPointer = 540; // Start at 9:00 AM (540 mins)
      const workEnd = 1080; // End at 6:00 PM (1080 mins)

      for (const todo of inboxTodos) {
        if (currentPointer >= workEnd) break;
        const duration = 60; // 1 hour per task
        let foundSlot = false;

        while (currentPointer + duration <= workEnd && !foundSlot) {
          const slotStart = currentPointer;
          const slotEnd = slotStart + duration;
          const collision = busyIntervals.some(i => (i.start < slotEnd && i.end > slotStart));

          if (!collision) {
            await scheduleTodoAt(todo, selectedDay, slotStart, duration);

            let bufferMins = decompressionBuffer ? 15 : 0;
            busyIntervals.push({ start: slotStart, end: slotEnd + bufferMins });
            busyIntervals.sort((a, b) => a.start - b.start);

            currentPointer = slotEnd + bufferMins;
            foundSlot = true;
          } else {
            currentPointer += 15;
          }
        }
      }

      await fetchEvents();
      await fetchAllTodos();
      setToastMessage('Zadania zostały pomyślnie zaplanowane przez AI! ✨');
    } catch (e: unknown) {
      console.error('Error during AI scheduling:', e);
      setToastMessage('Wystąpił błąd podczas planowania.');
    } finally {
      setIsScheduling(false);
    }
  };

  return { isScheduling, handleAISchedule };
}
