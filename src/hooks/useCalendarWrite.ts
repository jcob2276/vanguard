import { useCallback } from 'react';
import { NETWORK_TIMEOUT_MS } from '../lib/constants';

import type { CalendarEvent } from '../lib/calendarApi';
export type { CalendarEvent };

export function useCalendarWrite({
  userId,
  accessToken,
}: {
  userId: string | undefined;
  accessToken: string | undefined;
}) {
  const base = import.meta.env.VITE_SUPABASE_URL as string;

  const call = useCallback(
    async (action: 'create' | 'update' | 'delete', event: CalendarEvent) => {
      const res = await fetch(`${base}/functions/v1/calendar-write`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ userId, action, event }),
        signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `calendar-write ${action} failed`);
      return data as { success: boolean; eventId?: string };
    },
    [base, accessToken, userId],
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
