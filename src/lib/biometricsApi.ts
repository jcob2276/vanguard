import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { getTodayWarsaw, shiftDateStr } from './date';
import { biometricsKeys } from './queryKeys';
import { buildWeeklyBodyPulse, weeklyBodyPulseWindow, type WeeklyBodyPulseData } from './weeklyBodyPulse';

export type { WeeklyBodyPulseData };

// ── QUERIES ──

export function useDailyStrainOura(userId: string) {
  return useQuery({
    queryKey: biometricsKeys.dailyStrainOura(userId),
    queryFn: async () => {
      const todayStr = getTodayWarsaw();
      const yesterdayStr = shiftDateStr(todayStr, -1);

      const [{ data: strainRows, error: e1 }, { data: ouraRows, error: e2 }, { data: enhancedRows, error: e3 }, { data: profileRow }, { data: aggRow }] = await Promise.all([
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
        supabase
          .from('nutrition_profile')
          .select('birth_date')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('strava_activities')
          .select('gc_vo2max, icu_activity_id, raw_data, name, start_date')
          .eq('user_id', userId)
          .order('start_date', { ascending: false })
          .limit(20),
      ]);




      if (e1) throw new Error(e1.message);
      if (e2) throw new Error(e2.message);
      if (e3) throw new Error(e3.message);

      const ouraRow = ouraRows?.find((s) => s.date === todayStr) ?? ouraRows?.[0] ?? null;
      const ouraYesterdayRow = ouraRows?.find((s) => s.date === yesterdayStr) ?? null;
      const enhancedRow = enhancedRows?.find((s) => s.date === todayStr) ?? enhancedRows?.[0] ?? null;
      const enhancedYesterdayRow = enhancedRows?.find((s) => s.date === yesterdayStr) ?? null;

      let garminVo2Max: number | null = null;
      let externalVo2Source: string | null = null;

      if (aggRow && Array.isArray(aggRow)) {
        for (const act of aggRow) {
          if (act.gc_vo2max != null && Number(act.gc_vo2max) > 0) {
            garminVo2Max = Number(act.gc_vo2max);
            externalVo2Source = 'Garmin Connect';
            break;
          }
          const raw = act.raw_data as any;
          if (raw && typeof raw === 'object') {
            const v = raw.icu_vo2max ?? raw.vo2max ?? raw.garmin_vo2max ?? raw.vo2_max ?? raw.vo2Max;
            if (v != null && Number(v) > 0) {
              garminVo2Max = Number(v);
              externalVo2Source = act.icu_activity_id ? 'Intervals.icu' : 'Raporty Biegowe / Garmin';
              break;
            }
          }
        }
      }

      return {
        row: strainRows,
        oura: ouraRow,
        ouraYesterday: ouraYesterdayRow,
        enhanced: enhancedRow,
        enhancedYesterday: enhancedYesterdayRow,
        birthDateStr: profileRow?.birth_date ?? null,
        garminVo2Max,
        externalVo2Source,
      };
    },



    staleTime: 1000 * 60 * 30, // 30 mins cache
    enabled: !!userId,
  });
}

export function useWeeklyBodyPulse(userId: string) {
  const { since, fromISO, toISO } = weeklyBodyPulseWindow();
  return useQuery({
    queryKey: biometricsKeys.weeklyPulse(userId, since),
    queryFn: async (): Promise<WeeklyBodyPulseData> => {
      const [strainResult, workoutResult, stravaResult, ouraResult] = await Promise.all([
        supabase
          .from('daily_strain')
          .select('date, recovery_score, strain_score, daily_status')
          .eq('user_id', userId)
          .gte('date', since)
          .order('date', { ascending: true }),
        supabase
          .from('workout_sessions')
          .select('date, workout_day, exercise_logs(exercise_name, muscle_tags, reps)')
          .eq('user_id', userId)
          .or(`date.gte.${since},workout_day.gte.${since}`),
        supabase
          .from('strava_activities_clean')
          .select('start_date, sport_type, distance')
          .eq('user_id', userId)
          .gte('start_date', fromISO)
          .lte('start_date', toISO),
        supabase
          .from('oura_daily_summary')
          .select('date, total_sleep_hours, sleep_score, bedtime_timestamp, bedtime_end_timestamp, deep_sleep_hours, rem_sleep_hours, sleep_efficiency, hrv_avg, latency_minutes, readiness_score')
          .eq('user_id', userId)
          .gte('date', since)
          .order('date', { ascending: true }),
      ]);
      if (strainResult.error) throw new Error(strainResult.error.message);
      if (workoutResult.error) throw new Error(workoutResult.error.message);
      if (stravaResult.error) throw new Error(stravaResult.error.message);
      if (ouraResult.error) throw new Error(ouraResult.error.message);

      return buildWeeklyBodyPulse({
        since,
        sessions: workoutResult.data ?? [],
        strava: stravaResult.data ?? [],
        oura: ouraResult.data ?? [],
        strain: strainResult.data ?? [],
      });
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 30,
  });
}

export function useOuraHistory30Days(userId: string) {
  return useQuery({
    queryKey: biometricsKeys.ouraHistory30(userId),
    queryFn: async () => {
      const todayStr = getTodayWarsaw();
      const since30Str = shiftDateStr(todayStr, -30);

      const [{ data: ouraRows, error: e1 }, { data: enhancedRows, error: e2 }] = await Promise.all([
        supabase
          .from('oura_daily_summary')
          .select('*')
          .eq('user_id', userId)
          .gte('date', since30Str)
          .order('date', { ascending: true }),
        supabase
          .from('oura_enhanced')
          .select('*')
          .eq('user_id', userId)
          .gte('date', since30Str)
          .order('date', { ascending: true }),
      ]);

      if (e1) throw new Error(e1.message);
      if (e2) throw new Error(e2.message);

      return {
        ouraHistory: ouraRows ?? [],
        enhancedHistory: enhancedRows ?? [],
      };
    },
    staleTime: 1000 * 60 * 30,
    enabled: !!userId,
  });
}

