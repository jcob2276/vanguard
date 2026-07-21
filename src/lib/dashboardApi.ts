import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { getTodayWarsaw, getDaysAgoWarsaw, warsawDayBoundsISO } from './date';
import { VanguardCore, computeSignals } from './vanguardCore';
import { syncCalendar } from './syncApi';
import { parseWorldState } from './db-json-guards';
import type { Tables } from './database.types';

type TodayWinRow = Tables<'daily_wins'> & { daily_win_tasks?: Tables<'daily_win_tasks'>[] };

// Mirror of the WorldState interface from supabase/functions/_shared/worldState.ts
export type WorldState = {
  biometrics: { readiness_score: number | null; oura_history: unknown[] | null };
  execution:  { today_win: TodayWinRow | null };
  training:   { has_workout_today: boolean };
  nutrition:  { weekly_calories: number | null; protein_today: number | null };
};

export interface DashboardData {
  weeklyCalories: number;
  todayWin: TodayWinRow | null;
  proteinToday: number;
  hasWorkoutToday: boolean;
  ouraToday: unknown[];
  readiness: number;
}

import { dashboardKeys } from './queryKeys';

/**
 * Gym sessions (workout_sessions) OR Strava/Garmin runs (strava_activities_clean).
 * Cached world_state historically only checked gym — runs were invisible to Dziś → TRENING.
 */
async function fetchHasWorkoutToday(userId: string, today: string): Promise<boolean> {
  const { fromISO, toISO } = warsawDayBoundsISO(today);

  const [gymRes, stravaRes] = await Promise.all([
    supabase
      .from('workout_sessions')
      .select('id')
      .eq('user_id', userId)
      .or(`date.eq.${today},workout_day.eq.${today}`)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('strava_activities_clean')
      .select('strava_id')
      .eq('user_id', userId)
      .eq('is_oura', false)
      .gte('start_date', fromISO)
      .lte('start_date', toISO)
      .limit(1)
      .maybeSingle(),
  ]);

  return !!(gymRes.data || stravaRes.data);
}

/**
 * Fetch dashboard data: checks cached world state first, falls back to live queries and vanguard core state determination.
 */
async function fetchDashboardData(userId: string): Promise<DashboardData> {
  const today = getTodayWarsaw();
  const dayOfWeek = new Date(today + 'T12:00:00Z').getUTCDay();
  const daysToMonday = (dayOfWeek + 6) % 7;
  const monday = getDaysAgoWarsaw(daysToMonday);

  // 1. Fetch from cached world state table first
  const { data: wsRow } = await supabase
    .from('vanguard_world_state')
    .select('state_json')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (wsRow?.state_json) {
    const state = parseWorldState(wsRow.state_json);
    if (!state) {
      // state_json has unexpected structure — DB schema may have changed.
      // Fall through to live computation below.
      console.warn('[dashboardApi] world state JSON failed validation — falling back to live computation');
    } else {
      // today_win + training status live so Strava/gym updates show without waiting for world_state rebuild
      const [{ data: liveTodayWin }, hasWorkoutToday] = await Promise.all([
        supabase
          .from('daily_wins')
          .select('*, daily_win_tasks(*)')
          .eq('user_id', userId)
          .eq('date', today)
          .maybeSingle(),
        fetchHasWorkoutToday(userId, today),
      ]);

      return {
        weeklyCalories: state.nutrition?.weekly_calories ?? 0,
        todayWin: liveTodayWin ?? state.execution?.today_win ?? null,
        proteinToday: state.nutrition?.protein_today ?? 0,
        hasWorkoutToday,
        ouraToday: state.biometrics?.oura_history ?? [],
        readiness: state.biometrics?.readiness_score ?? 0,
      };
    }
  }

  // 2. Fallback to live computation if cached row is missing or there's an error
  console.debug('[dashboardApi] Cached world state missing, falling back to live calculation');

  const [
    nutritionRes,
    tDataRes,
    protDataRes,
    hasWorkoutToday,
    ouraDataRes,
    lastWorkoutRes
  ] = await Promise.all([
    supabase.from('daily_nutrition').select('calories').eq('user_id', userId).gte('date', monday),
    supabase.from('daily_wins').select('*, daily_win_tasks(*)').eq('user_id', userId).eq('date', today).maybeSingle(),
    supabase.from('daily_nutrition').select('protein').eq('user_id', userId).eq('date', today).maybeSingle(),
    fetchHasWorkoutToday(userId, today),
    supabase.from('oura_daily_summary').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(30),
    supabase.from('workout_sessions').select('date').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle()
  ]);

  const nutrition = nutritionRes.data;
  const tData = tDataRes.data;
  const protData = protDataRes.data;
  const ouraData = ouraDataRes.data;
  const lastWorkout = lastWorkoutRes.data;

  const totalCal = nutrition?.reduce((sum, n) => sum + (n.calories || 0), 0) || 0;

  // --- NEW VANGUARD CORE ENGINE ---
  const core = new VanguardCore(userId, supabase);

  const signals = computeSignals(
    ouraData?.[0] || null,
    tData,
    { protein: protData?.protein || 0 },
    lastWorkout?.date || null
  );

  await core.determineState(signals);

  return {
    weeklyCalories: totalCal,
    todayWin: tData,
    proteinToday: protData?.protein || 0,
    hasWorkoutToday,
    ouraToday: ouraData || [],
    readiness: ouraData?.[0]?.readiness_score || 0,
  };
}

/**
 * Custom React Query hook for accessing dashboard data
 */
export function useDashboardQuery(userId: string | null) {
  return useQuery({
    queryKey: dashboardKeys.main(userId || ''),
    queryFn: () => fetchDashboardData(userId || ''),
    enabled: !!userId,
  });
}

/**
 * Fetch the start time of the last calendar event to check sync status
 */
export async function getLastCalendarEventStartTime(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('vanguard_calendar')
    .select('start_time')
    .eq('user_id', userId)
    .lte('start_time', new Date().toISOString())
    .order('start_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.start_time ?? null;
}

/**
 * Triggers calendar synchronization for the user
 */
export async function syncUserCalendar(userId: string): Promise<void> {
  await syncCalendar(userId);
}
