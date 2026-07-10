import { useCallback } from 'react';
import { NETWORK_TIMEOUT_MS } from '../../../lib/constants';
import { invokeEdge } from '../../../lib/supabase';

import type { CalendarEvent } from '../../../lib/calendarApi';
export type { CalendarEvent };

export function useCalendarWrite({
  userId,
  accessToken,
}: {
  userId: string | undefined;
  accessToken: string | undefined;
}) {
  const call = useCallback(
    async (action: 'create' | 'update' | 'delete', event: CalendarEvent) => {
      const data = await invokeEdge<{ success: boolean; eventId?: string; error?: string }>('calendar-write', {
        body: { userId, action, event },
        signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
      });
      if (data.error) throw new Error(data.error || `calendar-write ${action} failed`);
      return data;
    },
    [userId],
  );

  const createEvent = useCallback(
    (event: Omit<CalendarEvent, 'id'>) => call('create', event),
    [call],
  );

  const updateEvent = useCallback(
    (event: CalendarEvent & { id: string }) => call('update', event),
    [call],
  );

  const deleteEvent = useCallback(
    (eventId: string) => call('delete', { id: eventId, summary: '', start: '', end: '' }),
    [call],
  );

  return { createEvent, updateEvent, deleteEvent };
}
