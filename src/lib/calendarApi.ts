import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, invokeEdge } from './supabase';
import { warsawDayBoundsISO } from './date';
import { isOfflineError, queueOfflineWrite } from './offlineQueue';
import type { Database } from './database.types';

type VanguardCalendarRow = Database['public']['Tables']['vanguard_calendar']['Row'];

export interface CalendarEvent {
  id?: string;
  summary: string;
  start: string; // ISO datetime "2026-07-03T10:00:00+02:00"
  end: string;
  description?: string;
  category?: string;
  recurrence?: string[];
}
import { calendarKeys } from './queryKeys';

// ── QUERIES ──

export function useCalendarEvents(
  userId: string,
  rangeStart: string,
  rangeEnd: string
) {
  return useQuery({
    queryKey: calendarKeys.events(userId, rangeStart, rangeEnd),
    queryFn: async () => {
      const { fromISO } = warsawDayBoundsISO(rangeStart);
      const { fromISO: toISO } = warsawDayBoundsISO(rangeEnd);

      const { data, error } = await supabase
        .from('vanguard_calendar')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', fromISO)
        .lt('start_time', toISO)
        .order('start_time', { ascending: true });

      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!userId && !!rangeStart && !!rangeEnd,
  });
}

// ── MUTATIONS ──

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      event,
    }: {
      userId: string;
      accessToken?: string;
      event: Omit<CalendarEvent, 'id'>;
    }) => {
      try {
        const res = await invokeEdge('calendar-write', {
          body: { userId, action: 'create', event },
        });
        return res as { success: boolean; eventId: string };
      } catch (err: unknown) {
        if (!isOfflineError(err)) throw err;
        const tempId = `offline-${crypto.randomUUID()}`;
        await queueOfflineWrite(
          'edge:calendar-write',
          { userId, action: 'create', event: { ...event, id: tempId } },
          `Utworzenie wydarzenia: ${event.summary}`
        );
        return { success: true, eventId: tempId };
      }
    },
    onSuccess: (data, variables) => {
      if (data && data.eventId) {
        const localEvent: VanguardCalendarRow = {
          id: data.eventId,
          event_id: data.eventId,
          user_id: variables.userId,
          summary: variables.event.summary,
          start_time: variables.event.start,
          end_time: variables.event.end,
          category: variables.event.category ?? 'vanguard',
          created_at: new Date().toISOString(),
        };
        queryClient.setQueriesData<VanguardCalendarRow[]>(
          { queryKey: ['calendar', 'events'] },
          (prev) => {
            if (!prev) return [localEvent];
            if (prev.some(e => e.event_id === localEvent.event_id || e.id === localEvent.id)) return prev;
            return [...prev, localEvent].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
          }
        );
      }
      queryClient.invalidateQueries({ queryKey: calendarKeys.all });
    },
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      event,
    }: {
      userId: string;
      accessToken?: string;
      event: CalendarEvent & { id: string };
    }) => {
      try {
        const res = await invokeEdge('calendar-write', {
          body: { userId, action: 'update', event },
        });
        return res as { success: boolean; eventId: string };
      } catch (err: unknown) {
        if (!isOfflineError(err)) throw err;
        await queueOfflineWrite(
          'edge:calendar-write',
          { userId, action: 'update', event },
          `Aktualizacja wydarzenia: ${event.summary}`
        );
        return { success: true, eventId: event.id };
      }
    },
    onSuccess: (data, variables) => {
      queryClient.setQueriesData<VanguardCalendarRow[]>(
        { queryKey: ['calendar', 'events'] },
        (prev) => {
          if (!prev) return [];
          return prev.map(e => {
            const isMatch = e.event_id === variables.event.id || e.id === variables.event.id;
            if (isMatch) {
              return {
                ...e,
                summary: variables.event.summary,
                start_time: variables.event.start,
                end_time: variables.event.end,
                category: variables.event.category ?? e.category,
              };
            }
            return e;
          }).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
        }
      );
      queryClient.invalidateQueries({ queryKey: calendarKeys.all });
    },
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      eventId,
      deleteScope = 'this',
    }: {
      userId: string;
      accessToken?: string;
      eventId: string;
      deleteScope?: 'this' | 'all';
    }) => {
      try {
        const res = await invokeEdge('calendar-write', {
          body: {
            userId,
            action: 'delete',
            deleteScope,
            event: { id: eventId, summary: '', start: '', end: '' },
          },
        });
        return res as { success: boolean };
      } catch (err: unknown) {
        if (!isOfflineError(err)) throw err;
        await queueOfflineWrite(
          'edge:calendar-write',
          {
            userId,
            action: 'delete',
            deleteScope,
            event: { id: eventId, summary: '', start: '', end: '' },
          },
          'Usunięcie wydarzenia'
        );
        return { success: true };
      }
    },
    onSuccess: (data, variables) => {
      queryClient.setQueriesData<VanguardCalendarRow[]>(
        { queryKey: ['calendar', 'events'] },
        (prev) => {
          if (!prev) return [];
          const baseId = variables.eventId;
          return prev.filter(e => {
            const evId = e.event_id || e.id;
            if (variables.deleteScope === 'all') {
              const seriesId = evId.split('_')[0];
              return seriesId !== baseId;
            }
            return evId !== baseId;
          });
        }
      );
      queryClient.invalidateQueries({ queryKey: calendarKeys.all });
    },
  });
}
