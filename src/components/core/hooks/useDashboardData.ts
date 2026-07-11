import { getTodayWarsaw, formatWarsawDate } from '../../../lib/date';
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { startOfWeek } from 'date-fns';
import { VanguardCore, computeSignals } from '../../../lib/vanguardCore';
import type { Tables } from '../../../lib/database.types';
import { NETWORK_TIMEOUT_MS } from '../../../lib/constants';
import { useGoalSpineInvalidation } from '../../../hooks/useGoalSpineInvalidation';
import { Session } from '@supabase/supabase-js';
import type { WorldState } from '../../../../supabase/functions/_shared/worldState';

export const mobileDashboardKeys = {
  all: ['mobileDashboard'] as const,
  main: (userId: string) => [...mobileDashboardKeys.all, 'main', userId] as const,
};

type DashboardData = {
  weeklyCalories: number;
  todayWin: (Tables<'daily_wins'> & { daily_win_tasks?: Tables<'daily_win_tasks'>[] }) | null;
  proteinToday: number;
  hasWorkoutToday: boolean;
  ouraToday: Tables<'oura_daily_summary'>[];
  readiness: number;
  loading: boolean;
  error?: string;
};

export function useDashboardData() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUserId(session.user.id);
    });
  }, []);

  const query = useQuery({
    queryKey: mobileDashboardKeys.main(userId || ''),
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');

      const today = getTodayWarsaw();
      const todayDate = new Date(today + 'T12:00:00Z');
      const mondayDate = startOfWeek(todayDate, { weekStartsOn: 1 });
      const monday = formatWarsawDate(mondayDate);

      // 1. Fetch from cached world state table first!
      const { data: wsRow } = await supabase
        .from('vanguard_world_state')
        .select('state_json')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      if (wsRow?.state_json) {
        const state = wsRow.state_json as unknown as WorldState;
        // serve today_win live so updates reflect immediately on refresh()
        const { data: liveTodayWin } = await supabase
          .from('daily_wins')
          .select('*, daily_win_tasks(*)')
          .eq('user_id', userId)
          .eq('date', today)
          .maybeSingle();

        return {
          weeklyCalories: state.nutrition?.weekly_calories ?? 0,
          todayWin: liveTodayWin ?? state.execution?.today_win ?? null,
          proteinToday: state.nutrition?.protein_today ?? 0,
          hasWorkoutToday: state.training?.has_workout_today ?? false,
          ouraToday: state.biometrics?.oura_history ?? [],
          readiness: state.biometrics?.readiness_score ?? 0,
        };
      }

      // 2. Fallback to live computation if cached row is missing or there's an error
      console.log('[useDashboardData] Cached world state missing, falling back to live calculation');

      const [
        nutritionRes,
        tDataRes,
        protDataRes,
        workoutTodayRes,
        ouraDataRes,
        lastWorkoutRes
      ] = await Promise.all([
        supabase.from('daily_nutrition').select('calories').eq('user_id', userId).gte('date', monday),
        supabase.from('daily_wins').select('*, daily_win_tasks(*)').eq('user_id', userId).eq('date', today).maybeSingle(),
        supabase.from('daily_nutrition').select('protein').eq('user_id', userId).eq('date', today).maybeSingle(),
        supabase.from('workout_sessions').select('id').eq('user_id', userId).eq('date', today).limit(1).maybeSingle(),
        supabase.from('oura_daily_summary').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(30),
        supabase.from('workout_sessions').select('date').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle()
      ]);

      const nutrition = nutritionRes.data;
      const tData = tDataRes.data;
      const protData = protDataRes.data;
      const workoutToday = workoutTodayRes.data;
      const ouraData = ouraDataRes.data;
      const lastWorkout = lastWorkoutRes.data;

      const totalCal = nutrition?.reduce((sum, n) => sum + (n.calories || 0), 0) || 0;

      // --- NOWY SILNIK VANGUARD CORE ---
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
        hasWorkoutToday: !!workoutToday,
        ouraToday: ouraData || [],
        readiness: ouraData?.[0]?.readiness_score || 0,
      };
    },
    enabled: !!userId,
  });

  const refresh = useCallback(async () => {
    if (userId) {
      await queryClient.invalidateQueries({ queryKey: mobileDashboardKeys.main(userId) });
    }
  }, [queryClient, userId]);

  const autoSyncCalendar = async (session: Session) => {
    try {
      const { data: lastEvent } = await supabase
        .from('vanguard_calendar')
        .select('start_time')
        .eq('user_id', session.user.id)
        .lte('start_time', new Date().toISOString())
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      const lastSync = lastEvent?.start_time ? new Date(lastEvent.start_time).getTime() : 0;

      if (lastEvent && lastSync < twoHoursAgo) {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync?service=calendar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ userId: session.user.id }),
          signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
        });
      }
    } catch (_e: unknown) {
      // silent
    }
  };

  useEffect(() => {
    if (userId) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) autoSyncCalendar(session);
      });
    }
  }, [userId]);

  useGoalSpineInvalidation(refresh);

  const fallbackData = {
    weeklyCalories: 0,
    todayWin: null,
    proteinToday: 0,
    hasWorkoutToday: false,
    ouraToday: [],
    readiness: 0,
  };

  const d = query.data || fallbackData;

  return {
    ...d,
    loading: query.isLoading,
    refresh,
  };
}
