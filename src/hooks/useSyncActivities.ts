import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { addDays } from '../components/calendar/calendarHelpers';
import type { CalendarEvent } from '../components/calendar/hooks/useCalendarWrite';

interface UseSyncActivitiesProps {
  userId: string | undefined;
  selectedDay: string;
  createEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<{ success: boolean; eventId?: string }>;
  fetchEvents: () => Promise<void>;
  setToastMessage: (msg: string | null) => void;
}

export function useSyncActivities({
  userId,
  selectedDay,
  createEvent,
  fetchEvents,
  setToastMessage,
}: UseSyncActivitiesProps) {
  const [syncingActivities, setSyncingActivities] = useState(false);

  const handleSyncActivities = async () => {
    if (!userId) return;
    setSyncingActivities(true);
    setToastMessage('Pobieram aktywności... 🔄');
    try {
      // 1. Fetch workout sessions with exercise logs
      const { data: sessions, error: sessionErr } = await supabase
        .from('workout_sessions')
        .select('*, exercise_logs(exercise_name)')
        .eq('user_id', userId)
        .order('workout_day', { ascending: false })
        .limit(30);

      if (sessionErr) throw sessionErr;

      // 2. Fetch Strava activities
      const { data: strava, error: stravaErr } = await supabase
        .from('strava_activities_clean')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: false })
        .limit(30);

      if (stravaErr) throw stravaErr;

      // 3. Fetch current calendar events for range
      const fromISO = addDays(selectedDay, -10) + 'T00:00:00Z';
      const toISO = addDays(selectedDay, 10) + 'T23:59:59Z';
      const { data: currentEvents, error: eventsErr } = await supabase
        .from('vanguard_calendar')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', fromISO)
        .lt('start_time', toISO);

      if (eventsErr) throw eventsErr;

      let createdCount = 0;
      let skippedCount = 0;

      const eventExists = (startTime: string, summarySub: string) => {
        const startSec = new Date(startTime).getTime();
        return currentEvents?.some((ev) => {
          const startEvSec = new Date(ev.start_time || '').getTime();
          const matchTime = Math.abs(startSec - startEvSec) < 5 * 60 * 1000; // 5 mins threshold
          const matchSummary = ev.summary?.toLowerCase()?.includes(summarySub.toLowerCase());
          return matchTime && matchSummary;
        });
      };

      // Sync Gym & Sauna
      if (sessions) {
        for (const session of sessions) {
          if (!session.start_time) continue;

          const isSauna = session.exercise_logs?.some(
            (el: any) => el.exercise_name?.toLowerCase() === 'sauna'
          );

          const summary = isSauna ? 'Sauna 🧖' : 'Siłownia 🏋️';
          const category = isSauna ? 'odpoczynek_regeneracja' : 'cialo_trening';
          const startISO = new Date(session.start_time).toISOString();

          let duration = session.duration_minutes || 60;
          if (session.end_time && session.start_time) {
            const diffMs = new Date(session.end_time).getTime() - new Date(session.start_time).getTime();
            if (diffMs > 0 && diffMs < 5 * 3600 * 1000) {
              duration = diffMs / (60 * 1000);
            }
          }

          const endISO = new Date(new Date(startISO).getTime() + duration * 60 * 1000).toISOString();

          if (eventExists(startISO, isSauna ? 'sauna' : 'siłownia')) {
            skippedCount++;
            continue;
          }

          await createEvent({
            summary,
            start: startISO,
            end: endISO,
            category,
          });
          createdCount++;
        }
      }

      // Sync Strava runs
      if (strava) {
        for (const act of strava) {
          if (!act.start_date) continue;

          const summary = `Bieg 🏃 (${act.name || 'Strava'})`;
          const startISO = new Date(act.start_date).toISOString();
          const durationSec = act.elapsed_time || 3600;
          const endISO = new Date(new Date(startISO).getTime() + durationSec * 1000).toISOString();

          if (eventExists(startISO, 'bieg')) {
            skippedCount++;
            continue;
          }

          await createEvent({
            summary,
            start: startISO,
            end: endISO,
            category: 'cialo_trening',
          });
          createdCount++;
        }
      }

      if (createdCount === 0) {
        setToastMessage('Wszystkie aktywności są już aktualne! 🏃🏋️🧖');
      } else {
        setToastMessage(`Zsynchronizowano aktywności: dodano ${createdCount} nowych wpisów! 🏃🏋️🧖`);
      }
      await fetchEvents();
    } catch (err: unknown) {
      console.error('Error syncing activities:', err);
      setToastMessage('Nie udało się zsynchronizować aktywności.');
    } finally {
      setSyncingActivities(false);
    }
  };

  return { syncingActivities, handleSyncActivities };
}
