import type { QueryClient } from '@tanstack/react-query';
import { calendarKeys } from '../../../lib/queryKeys';
import { parseTime, dateOfISO, getWarsawOffset, HOUR_START, HOUR_END, PX_PER_MIN, CalRow } from '../calendarHelpers';

interface VisibleRange {
  rangeStart: string;
  rangeEnd: string;
}

interface UseCalendarEventDragParams {
  userId: string | undefined;
  accessToken: string | undefined;
  queryClient: QueryClient;
  visibleRange: VisibleRange;
  updateEventMutation: {
    mutateAsync: (args: {
      userId: string;
      accessToken: string;
      event: { id: string; summary: string; start: string; end: string; category?: string; description?: string; recurrence?: string[] | null };
    }) => Promise<unknown>;
  };
  onEventClick: (ev: CalRow) => void;
  setToastMessage: (msg: string | null) => void;
}

export function useCalendarEventDrag({
  userId,
  accessToken,
  queryClient,
  visibleRange,
  updateEventMutation,
  onEventClick,
  setToastMessage,
}: UseCalendarEventDragParams) {
  const handleEventMouseDown = (
    ev: CalRow,
    e: React.MouseEvent<HTMLDivElement>,
    action: 'move' | 'resize'
  ) => {
    e.stopPropagation();
    e.preventDefault();

    if (!ev.start_time || !ev.end_time) return;
    if (ev.series_id) {
      onEventClick(ev);
      setToastMessage('Cykliczne wydarzenie zmienisz bezpiecznie w edycji całej serii.');
      return;
    }

    const cardElement = action === 'resize'
      ? (e.currentTarget.parentElement as HTMLDivElement)
      : (e.currentTarget as HTMLDivElement);

    if (cardElement) {
      cardElement.style.transition = 'none';
      cardElement.style.zIndex = '50';
    }

    const startMin = parseTime(ev.start_time);
    const endMin = parseTime(ev.end_time);
    const duration = endMin - startMin;

    const startY = e.clientY;
    const initialStartMin = startMin;
    const initialEndMin = endMin;
    const originalDate = dateOfISO(ev.start_time);
    // Mutable — 'move' drags can cross into a different day column; 'resize'
    // never changes which day the event belongs to.
    let eventDate = originalDate;

    let hasMoved = false;
    let lastDiffMins = 0;
    let lastDay = originalDate;

    const dayUnderCursor = (clientX: number, clientY: number): string | null => {
      const el = document.elementFromPoint(clientX, clientY)?.closest('[data-day-col]');
      return el?.getAttribute('data-day-col') || null;
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      hasMoved = true;
      const diffY = moveEvent.clientY - startY;
      const diffMins = Math.round((diffY / PX_PER_MIN) / 15) * 15;

      if (action === 'move') {
        const hoveredDay = dayUnderCursor(moveEvent.clientX, moveEvent.clientY);
        if (hoveredDay) eventDate = hoveredDay;
      }

      if (diffMins === lastDiffMins && eventDate === lastDay) return;
      lastDiffMins = diffMins;
      lastDay = eventDate;

      // Temporary local update for snappy UI feel
      queryClient.setQueryData(
        calendarKeys.events(userId || '', visibleRange.rangeStart, visibleRange.rangeEnd),
        (old: CalRow[] | undefined) => {
          return (old || []).map((item) => {
            if (item.id !== ev.id) return item;

            let newStartMin = initialStartMin;
            let newEndMin = initialEndMin;

            if (action === 'move') {
              newStartMin = Math.max(HOUR_START * 60, Math.min(HOUR_END * 60 - duration, initialStartMin + diffMins));
              newEndMin = newStartMin + duration;
            } else if (action === 'resize') {
              newEndMin = Math.max(newStartMin + 15, Math.min(HOUR_END * 60, initialEndMin + diffMins));
            }

            const pad = (n: number) => String(n).padStart(2, '0');
            const newStartISO = `${eventDate}T${pad(Math.floor(newStartMin / 60))}:${pad(newStartMin % 60)}:00${getWarsawOffset(eventDate)}`;
            const newEndISO = `${eventDate}T${pad(Math.floor(newEndMin / 60))}:${pad(newEndMin % 60)}:00${getWarsawOffset(eventDate)}`;

            return {
              ...item,
              start_time: newStartISO,
              end_time: newEndISO,
            };
          });
        }
      );
    };

    const handleMouseUp = async (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      if (cardElement) {
        cardElement.style.transition = '';
        cardElement.style.zIndex = '';
      }

      if (!hasMoved) {
        onEventClick(ev);
        return;
      }

      const diffY = upEvent.clientY - startY;
      const diffMins = Math.round((diffY / PX_PER_MIN) / 15) * 15;

      let finalStartMin = initialStartMin;
      let finalEndMin = initialEndMin;

      if (action === 'move') {
        finalStartMin = Math.max(HOUR_START * 60, Math.min(HOUR_END * 60 - duration, initialStartMin + diffMins));
        finalEndMin = finalStartMin + duration;
      } else if (action === 'resize') {
        finalEndMin = Math.max(finalStartMin + 15, Math.min(HOUR_END * 60, initialEndMin + diffMins));
      }

      const pad = (n: number) => String(n).padStart(2, '0');
      const startISO = `${eventDate}T${pad(Math.floor(finalStartMin / 60))}:${pad(finalStartMin % 60)}:00${getWarsawOffset(eventDate)}`;
      const endISO = `${eventDate}T${pad(Math.floor(finalEndMin / 60))}:${pad(finalEndMin % 60)}:00${getWarsawOffset(eventDate)}`;

      const evId = ev.event_id || ev.id;
      try {
        await updateEventMutation.mutateAsync({
          userId: userId || '',
          accessToken: accessToken || '',
          event: {
            id: evId,
            summary: ev.summary || '',
            start: startISO,
            end: endISO,
            category: ev.category || undefined,
            description: ev.description || undefined,
            recurrence: ev.recurrence || undefined,
          },
        });
        setToastMessage('Zaktualizowano czas wydarzenia! 🕒');
      } catch (err) {
        console.error('Failed to save drag/resize changes:', err);
        setToastMessage('Nie udało się zapisać zmian.');
        // Revert cache to original values on failure
        queryClient.invalidateQueries({
          queryKey: calendarKeys.events(userId || '', visibleRange.rangeStart, visibleRange.rangeEnd),
        });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return { handleEventMouseDown };
}
