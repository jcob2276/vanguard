import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { getTodayWarsaw, shiftDateStr } from './date';
import { biometricsKeys } from './queryKeys';

// ── QUERIES ──

export function useDailyStrainOura(userId: string) {
  return useQuery({
    queryKey: biometricsKeys.dailyStrainOura(userId),
    queryFn: async () => {
      const todayStr = getTodayWarsaw();
      const yesterdayStr = shiftDateStr(todayStr, -1);

      const [{ data: strainRows, error: e1 }, { data: ouraRows, error: e2 }, { data: enhancedRows, error: e3 }] = await Promise.all([
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
          .in('date', [todayStr, yesterdayStr]),
        supabase
          .from('oura_enhanced')
          .select('*')
          .eq('user_id', userId)
          .in('date', [todayStr, yesterdayStr]),
      ]);

      if (e1) throw new Error(e1.message);
      if (e2) throw new Error(e2.message);
      if (e3) throw new Error(e3.message);

      const ouraRow = ouraRows?.find((s) => s.date === todayStr) ?? ouraRows?.[0] ?? null;
      const ouraYesterdayRow = ouraRows?.find((s) => s.date === yesterdayStr) ?? null;
      const enhancedRow = enhancedRows?.find((s) => s.date === todayStr) ?? enhancedRows?.[0] ?? null;
      const enhancedYesterdayRow = enhancedRows?.find((s) => s.date === yesterdayStr) ?? null;

      return {
        row: strainRows,
        oura: ouraRow,
        ouraYesterday: ouraYesterdayRow,
        enhanced: enhancedRow,
        enhancedYesterday: enhancedYesterdayRow,
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
