import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { addDays } from '../components/calendar/calendarHelpers';

interface UseSyncOuraProps {
  userId: string | undefined;
  selectedDay: string;
  updateEvent: (ev: Record<string, unknown>) => Promise<Record<string, unknown>>;
  createEvent: (ev: Record<string, unknown>) => Promise<Record<string, unknown>>;
  fetchEvents: () => Promise<void>;
  setToastMessage: (msg: string | null) => void;
}

export function useSyncOura({
  userId,
  selectedDay,
  updateEvent,
  createEvent,
  fetchEvents,
  setToastMessage,
}: UseSyncOuraProps) {
  const [syncingOuraSleep, setSyncingOuraSleep] = useState(false);

  const handleSyncOuraSleep = async () => {
    if (!userId) return;
    setSyncingOuraSleep(true);
    setToastMessage('Pobieram dane snu z Oura... 🔄');
    try {
      // Fetch Oura daily summaries
      const { data: ouraRows, error: ouraErr } = await supabase
        .from('oura_daily_summary')
        .select('date, bedtime_timestamp, total_sleep_hours')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(14);

      if (ouraErr) throw ouraErr;
      if (!ouraRows || ouraRows.length === 0) {
        setToastMessage('Brak danych snu w oura_daily_summary! ❌');
        setSyncingOuraSleep(false);
        return;
      }

      // Fetch current calendar events for the active range
      const fromISO = addDays(selectedDay, -7) + 'T00:00:00Z';
      const toISO = addDays(selectedDay, 7) + 'T23:59:59Z';
      const { data: currentEvents, error: eventsErr } = await supabase
        .from('vanguard_calendar')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', fromISO)
        .lt('start_time', toISO);

      if (eventsErr) throw eventsErr;

      let updatedCount = 0;
      let createdCount = 0;

      for (const row of ouraRows) {
        if (!row.bedtime_timestamp || !row.total_sleep_hours) continue;

        // Oura stores bedtime_timestamp in UTC/Warsaw timezone context
        const startISO = new Date(row.bedtime_timestamp).toISOString();
        const endISO = new Date(
          new Date(row.bedtime_timestamp).getTime() + row.total_sleep_hours * 3600 * 1000
        ).toISOString();

        // Oura date represents the morning of wake up (e.g. "2026-07-04" for sleep ending July 4th morning)
        const wakeDateStr = row.date;

        // Find existing "Sen" / "Sleep" event that ends on this date
        const existingEvent = currentEvents?.find((ev) => {
          const isSen = ev.summary?.toLowerCase() === 'sen' || ev.summary?.toLowerCase()?.includes('sen ') || ev.summary?.toLowerCase() === 'sleep';
          if (!isSen) return false;
          const evEndDateStr = ev.end_time?.split('T')[0];
          return evEndDateStr === wakeDateStr;
        });

        if (existingEvent) {
          await updateEvent({
            id: existingEvent.event_id || existingEvent.id,
            summary: 'Sen 🛌',
            start: startISO,
            end: endISO,
            category: 'odpoczynek_regeneracja',
          });
          updatedCount++;
        } else {
          await createEvent({
            summary: 'Sen 🛌',
            start: startISO,
            end: endISO,
            category: 'odpoczynek_regeneracja',
          });
          createdCount++;
        }
      }

      if (updatedCount === 0 && createdCount === 0) {
        setToastMessage('Dane snu Oura są już aktualne! 🛌✨');
      } else {
        setToastMessage(`Zsynchronizowano sen: zaktualizowano ${updatedCount}, dodano ${createdCount}! 🛌✨`);
      }
      await fetchEvents();
    } catch (err: unknown) {
      console.error('Error syncing Oura sleep:', err);
      setToastMessage('Nie udało się zsynchronizować snu z Oura.');
    } finally {
      setSyncingOuraSleep(false);
    }
  };

  return { syncingOuraSleep, handleSyncOuraSleep };
}
