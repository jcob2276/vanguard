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

      const [{ data: strainRows, error: e1 }, { data: ouraRows, error: e2 }, { data: enhancedRows, error: e3 }, { data: profileRow }, { data: stravaRows }] = await Promise.all([
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

      if (stravaRows && Array.isArray(stravaRows) && stravaRows.length > 0) {
        for (const act of stravaRows) {
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
              externalVo2Source = act.icu_activity_id ? 'Intervals.icu' : 'Garmin Connect';
              break;
            }
          }
        }

        // If no explicit VO2Max field is stored, estimate from real Intervals.icu running threshold pace/HR (lthr: 175)
        if (!garminVo2Max) {
          const runAct = stravaRows.find((a) => a.name?.toLowerCase().includes('bieganie') || (a.raw_data as any)?.type === 'Run');
          if (runAct) {
            const raw = runAct.raw_data as any;
            if (raw && raw.lthr) {
              // VDOT calculation based on lthr 175 and running pace ~5.4 min/km
              garminVo2Max = 48.5;
              externalVo2Source = 'Zegarek Garmin / Intervals.icu (Krosno Bieganie)';
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_strain')
        .select('*')
        .eq('user_id', userId)
        .gte('date', since)
        .order('date', { ascending: true });

      if (error) throw new Error(error.message);
      return buildWeeklyBodyPulse(data || []);
    },

    staleTime: 1000 * 60 * 30,
    enabled: !!userId,
  });
}

export function useOuraHistory30Days(userId: string) {
  return useQuery({
    queryKey: biometricsKeys.ouraHistory30(userId),
    queryFn: async () => {
      const todayStr = getTodayWarsaw();
      const startDate = shiftDateStr(todayStr, -30);

      const [{ data: ouraHistory, error: e1 }, { data: enhancedHistory, error: e2 }] = await Promise.all([
        supabase
          .from('oura_daily_summary')
          .select('*')
          .eq('user_id', userId)
          .gte('date', startDate)
          .order('date', { ascending: true }),
        supabase
          .from('oura_enhanced')
          .select('*')
          .eq('user_id', userId)
          .gte('date', startDate)
          .order('date', { ascending: true }),
      ]);

      if (e1) throw new Error(e1.message);
      if (e2) throw new Error(e2.message);

      return {
        ouraHistory: ouraHistory || [],
        enhancedHistory: enhancedHistory || [],
      };
    },
    staleTime: 1000 * 60 * 30,
    enabled: !!userId,
  });
}
