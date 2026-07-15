import { useSyncOura } from '../../../../hooks/useSyncOura';
import { useSyncActivities } from '../../../../hooks/useSyncActivities';
import type { useCreateCalendarEvent, useUpdateCalendarEvent } from '../../../../lib/calendarApi';

interface UseCalendarIntegrationsOptions {
  userId: string | undefined;
  accessToken: string | undefined;
  selectedDay: string;
  createEventMutation: ReturnType<typeof useCreateCalendarEvent>;
  updateEventMutation: ReturnType<typeof useUpdateCalendarEvent>;
  fetchEvents: () => Promise<void>;
  setToastMessage: (msg: string | null) => void;
}

export function useCalendarIntegrations({
  userId,
  accessToken,
  selectedDay,
  createEventMutation,
  updateEventMutation,
  fetchEvents,
  setToastMessage,
}: UseCalendarIntegrationsOptions) {
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
    isSyncingOura,
    syncOura,
    isSyncingActivities,
    syncActivities,
  };
}
