import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { getTodayWarsaw, shiftDateStr } from './date';
import { biometricsKeys } from './queryKeys';

// ── QUERIES ──

export function useDailyStrainOura(userId: string) {
  return useQuery({
    queryKey: biometricsKeys.dailyStrainOura(userId),
    queryFn: async () => {
      const [{ data: strainRows, error: e1 }, { data: ouraRows, error: e2 }] = await Promise.all([
        supabase
          .from('daily_strain')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('oura_daily_summary')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(2),
      ]);

      if (e1) throw new Error(e1.message);
      if (e2) throw new Error(e2.message);

      let ouraRow = null;
      if (ouraRows?.length) {
        const todayStr = getTodayWarsaw();
        ouraRow = ouraRows.find((s) => s.date === todayStr) || ouraRows[0];
      }

      return {
        row: strainRows,
        oura: ouraRow,
      };
    },
    staleTime: 1000 * 60 * 30, // 30 mins cache
    enabled: !!userId,
  });
}

export function useWeeklyBodyPulse(userId: string) {
  const since = shiftDateStr(getTodayWarsaw(), -6);
  return useQuery({
    queryKey: biometricsKeys.weeklyPulse(userId, since),
    queryFn: async () => {
      const [strainResult, workoutResult] = await Promise.all([
        supabase
          .from('daily_strain')
          .select('date, recovery_score, strain_score, daily_status')
          .eq('user_id', userId)
          .gte('date', since)
          .order('date', { ascending: true }),
        supabase
          .from('workout_sessions')
          .select('id, date')
          .eq('user_id', userId)
          .gte('date', since),
      ]);
      if (strainResult.error) throw new Error(strainResult.error.message);
      if (workoutResult.error) throw new Error(workoutResult.error.message);
      const strain = strainResult.data ?? [];
      const recoveryValues = strain.flatMap((row) => row.recovery_score == null ? [] : [row.recovery_score]);
      const averageRecovery = recoveryValues.length
        ? Math.round(recoveryValues.reduce((sum, value) => sum + value, 0) / recoveryValues.length)
        : null;
      return {
        measuredDays: strain.length,
        averageRecovery,
        workoutCount: workoutResult.data?.length ?? 0,
        warningDays: strain.filter((row) => row.daily_status === 'red' || row.daily_status === 'yellow').length,
      };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 30,
  });
}

