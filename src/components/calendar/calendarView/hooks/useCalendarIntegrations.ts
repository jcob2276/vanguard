import { useAIScheduling } from '../../hooks/useAIScheduling';
import { useSyncOura } from '../../../../hooks/useSyncOura';
import { useSyncActivities } from '../../../../hooks/useSyncActivities';

interface UseCalendarIntegrationsOptions {
  userId: string | undefined;
  accessToken: string | undefined;
  selectedDay: string;
  events: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  focusTimeDefense: boolean;
  decompressionBuffer: boolean;
  inboxTodos: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  createEventMutation: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  updateEventMutation: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  scheduleTodoAt: (todo: any, day: string, startMin: number, durationMinutes?: number) => Promise<void>; // eslint-disable-line @typescript-eslint/no-explicit-any
  fetchEvents: () => Promise<void>;
  fetchAllTodos: () => Promise<void>;
  setToastMessage: (msg: string | null) => void;
}

export function useCalendarIntegrations({
  userId,
  accessToken,
  selectedDay,
  events,
  focusTimeDefense,
  decompressionBuffer,
  inboxTodos,
  createEventMutation,
  updateEventMutation,
  scheduleTodoAt,
  fetchEvents,
  fetchAllTodos,
  setToastMessage,
}: UseCalendarIntegrationsOptions) {
  const { isScheduling: isAISchedulingRunning, handleAISchedule: runAIScheduling } = useAIScheduling({
    userId,
    selectedDay,
    eventsForDay: (day) => events.filter((ev) => ev.start_time?.startsWith(day)),
    focusTimeDefense,
    decompressionBuffer,
    inboxTodos,
    createEvent: async (ev) => {
      const res = await createEventMutation.mutateAsync({
        userId: userId || '',
        accessToken: accessToken || '',
        event: ev,
      });
      return { success: true, eventId: res.eventId };
    },
    scheduleTodoAt: async (todo, day, startMin, durationMinutes) => {
      await scheduleTodoAt(todo, day, startMin, durationMinutes);
    },
    fetchEvents,
    fetchAllTodos,
    setToastMessage,
  });

  const { syncingOuraSleep: isSyncingOura, handleSyncOuraSleep: syncOura } = useSyncOura({
    userId,
    selectedDay,
    updateEvent: async (ev) => {
      await updateEventMutation.mutateAsync({
        userId: userId || '',
        accessToken: accessToken || '',
        event: ev,
      });
      return { success: true, eventId: ev.id };
    },
    createEvent: async (ev) => {
      const res = await createEventMutation.mutateAsync({
        userId: userId || '',
        accessToken: accessToken || '',
        event: ev,
      });
      return { success: true, eventId: res.eventId };
    },
    fetchEvents,
    setToastMessage,
  });

  const { syncingActivities: isSyncingActivities, handleSyncActivities: syncActivities } = useSyncActivities({
    userId,
    selectedDay,
    createEvent: async (ev) => {
      const res = await createEventMutation.mutateAsync({
        userId: userId || '',
        accessToken: accessToken || '',
        event: ev,
      });
      return { success: true, eventId: res.eventId };
    },
    fetchEvents,
    setToastMessage,
  });

  return {
    isAISchedulingRunning,
    runAIScheduling,
    isSyncingOura,
    syncOura,
    isSyncingActivities,
    syncActivities,
  };
}
