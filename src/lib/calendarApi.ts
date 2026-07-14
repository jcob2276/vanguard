import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, invokeEdge } from './supabase';
import { warsawDayBoundsISO } from './date';

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
      return invokeEdge<{ success: boolean; eventId?: string }>('calendar-write', {
        body: { userId, action: 'create', event },
      });
    },
    onSuccess: () => {
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
      return invokeEdge<{ success: boolean }>('calendar-write', {
        body: { userId, action: 'update', event },
      });
    },
    onSuccess: () => {
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
      return invokeEdge<{ success: boolean }>('calendar-write', {
        body: {
          userId,
          action: 'delete',
          deleteScope,
          event: { id: eventId, summary: '', start: '', end: '' },
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.all });
    },
  });
}
