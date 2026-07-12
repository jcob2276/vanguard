import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getWarsawDateString } from '../time.ts';
import { ewmaBaseline } from './baselines.ts';
import { byKey, type OuraDailySummaryRow, type OuraEnhancedRow, type OuraHrZonesDailyRow, type DailyNutritionRow, type WorkoutSessionRow, type StravaActivityRow, type DailyFoodEntryRow, type BehaviorLogRow, type DailyReconciliationRow } from './metricsTypes.ts';
import { buildIllnessDates, computePerDay } from './computePerDay.ts';

export const runComputeDailyStrain = async (
  supabase: SupabaseClient,
  scopedUserId: string | null,
  dateFrom: string | null,
  dateTo: string | null,
  days: number,
  algoVersion: number
): Promise<{ success: boolean; results: any[] }> => {
  let uq = supabase.from('user_settings').select('user_id').not('oura_token', 'is', null);
  if (scopedUserId) uq = uq.eq('user_id', scopedUserId);
  const { data: users, error: uErr } = await uq;
  if (uErr) throw uErr;

    const now = new Date();
    const todayWarsaw = getWarsawDateString(now);
    const toWarsaw = getWarsawDateString;
    const endStr = dateTo || toWarsaw(now);
    const startStr = dateFrom || toWarsaw(new Date(now.getTime() - days * 864e5));
    const startDate = new Date(startStr + 'T12:00:00Z');
    const start90 = toWarsaw(new Date(startDate.getTime() - 90 * 864e5));
    const start30 = toWarsaw(new Date(startDate.getTime() - 30 * 864e5));

    const computeForUser = async (u: { user_id: string }) => {
      const uid = u.user_id;
      try {
        const { data: bw } = await supabase.from('body_metrics').select('weight').eq('user_id', uid).not('weight', 'is', null).order('date', { ascending: false }).limit(1).maybeSingle();
        const weight = Number(bw?.weight) || 75;

        const { data: profile } = await supabase.from('nutrition_profile').select('birth_date, sex').eq('user_id', uid).maybeSingle();
        const sex: 'M' | 'F' = String(profile?.sex ?? 'M').toUpperCase() === 'F' ? 'F' : 'M';
        const ageYears = profile?.birth_date ? (now.getTime() - new Date(profile.birth_date).getTime()) / (365.25 * 86400000) : 30;

        const { data: base } = await supabase.from('oura_daily_summary').select('date, hrv_avg, rhr_avg, total_sleep_hours, sleep_score, readiness_score').eq('user_id', uid).gte('date', start90).lte('date', endStr).order('date');
        const baseByDate: Record<string, OuraDailySummaryRow> = {};
        const sleepByDate: Record<string, number> = {};
        for (const row of (base || []) as OuraDailySummaryRow[]) { baseByDate[row.date] = row; if (row.total_sleep_hours != null) sleepByDate[row.date] = Number(row.total_sleep_hours); }

        const { data: respBase } = await supabase.from('oura_enhanced').select('date, sleep_average_breath, temperature_deviation').eq('user_id', uid).gte('date', start90).lte('date', endStr).order('date');
        const respByDate: Record<string, number | null> = {};
        const skinTempByDate: Record<string, number | null> = {};
        for (const row of (respBase || []) as Record<string, unknown>[]) { respByDate[row.date as string] = row.sleep_average_breath != null ? Number(row.sleep_average_breath) : null; skinTempByDate[row.date as string] = row.temperature_deviation != null ? Number(row.temperature_deviation) : null; }

        const getBaselinesForDate = (targetDate: string) => {
          const hrvVals = (base || []).filter((r) => r.date < targetDate).map((r) => r.hrv_avg).filter((v): v is number => v != null);
          const rhrVals = (base || []).filter((r) => r.date < targetDate).map((r) => r.rhr_avg).filter((v): v is number => v != null);
          const sleepScoreVals = (base || []).filter((r) => r.date < targetDate).map((r) => r.sleep_score).filter((v): v is number => v != null);
          const respVals = (respBase || []).filter((r) => r.date < targetDate).map((r) => r.sleep_average_breath).filter((v): v is number => v != null);
          return {
            hrvEwma: ewmaBaseline(hrvVals, 5, 250, 5.0), rhrEwma: ewmaBaseline(rhrVals, 30, 120, 2.0),
            sleepScoreEwma: ewmaBaseline(sleepScoreVals, 0, 100, 5.0), respEwma: ewmaBaseline(respVals, 4, 40, 0.5),
            hrvBase: hrvVals.length ? hrvVals.reduce((x, y) => x + y, 0) / hrvVals.length : null,
            rhrBase: rhrVals.length ? rhrVals.reduce((x, y) => x + y, 0) / rhrVals.length : null,
          };
        };

        const { data: strainHistRows } = await supabase.from('daily_strain').select('date, strain_score').eq('user_id', uid).gte('date', start30).lte('date', endStr).order('date');
        const strainHistRunning: Array<{ date: string; strain_score: number | null }> = [...(strainHistRows || [])];

        const winStart = dateFrom ? toWarsaw(new Date(startDate.getTime() - 864e5)) : toWarsaw(new Date(now.getTime() - (days + 1) * 864e5));
        const [zonesR, enhR, summR, nutrR, wsR, stravaR, foodR, behaviorR, reconR] = await Promise.all([
          supabase.from('oura_hr_zones_daily').select('day, z1_regen_min, z2_tlenowa_min, z3_tempo_min, z4_prog_min, z5_max_min, hr_max').eq('user_id', uid).gte('day', winStart),
          supabase.from('oura_enhanced').select('date, steps, resilience_level').eq('user_id', uid).gte('date', winStart),
          supabase.from('oura_daily_summary').select('date, readiness_score, hrv_avg, rhr_avg, total_sleep_hours, sleep_score').eq('user_id', uid).gte('date', winStart),
          supabase.from('daily_nutrition').select('date, calories, protein, carbs').eq('user_id', uid).gte('date', winStart),
          supabase.from('workout_sessions').select('date, exercise_logs(exercise_name, rpe, rir, reps)').eq('user_id', uid).gte('date', winStart),
          supabase.from('strava_activities_clean').select('start_date, perceived_exertion, has_pr, sport_type, is_oura').eq('user_id', uid).eq('is_oura', false).gte('start_date', winStart + 'T00:00:00'),
          supabase.from('daily_food_entries').select('name, logged_at, date').eq('user_id', uid).gte('date', winStart).not('logged_at', 'is', null),
          supabase.from('behavior_log').select('date, behavior_key, value').eq('user_id', uid).gte('date', winStart),
          supabase.from('daily_reconciliations').select('date, day_score').eq('user_id', uid).gte('date', winStart),
        ]);

        const zones = byKey(zonesR.data as OuraHrZonesDailyRow[], (r) => r.day);
        const enh = byKey(enhR.data as OuraEnhancedRow[], (r) => r.date);
        const summ = byKey(summR.data as OuraDailySummaryRow[], (r) => r.date);
        const nutr = byKey(nutrR.data as DailyNutritionRow[], (r) => r.date);
        const workouts = byKey(wsR.data as WorkoutSessionRow[], (r) => r.date);
        const strava = byKey(stravaR.data as StravaActivityRow[], (r) => getWarsawDateString(new Date(r.start_date)));
        const food = byKey(foodR.data as DailyFoodEntryRow[], (r) => r.date);
        const recon = byKey(reconR.data as DailyReconciliationRow[], (r) => r.date);

        const illnessDates = buildIllnessDates(behaviorR.data || []);

        const dayList: string[] = [];
        for (let t = new Date(startStr).getTime(); t <= new Date(endStr).getTime(); t += 864e5) dayList.push(new Date(t).toISOString().split('T')[0]);

        const upserts = [];
        for (const date of dayList) {
          const { row, strain } = computePerDay({
            date, todayWarsaw, now, zones, enh, summ, nutr, workouts, strava, recon, food,
            baseByDate, respByDate, skinTempByDate, sleepByDate, strainHistRunning, illnessDates,
            weight, sex, ageYears, algoVersion, uid, getBaselinesForDate,
          });
          upserts.push(row);
          if (strain != null) strainHistRunning.push({ date, strain_score: strain });
        }

        if (upserts.length) {
          const { error: upErr } = await supabase.from('daily_strain').upsert(upserts, { onConflict: 'user_id,date' });
          if (upErr) return { user_id: uid, error: upErr.message };
        }
        return { user_id: uid, days: upserts.length, latest: upserts[upserts.length - 1] };
      } catch (error: any) {
        console.error(`[strain] user ${uid} failed`, error);
        return { user_id: uid, error: error.message || String(error) };
      }
    };

  const results = await Promise.all((users || []).map(computeForUser));
  const scopedError = scopedUserId && results.length === 1 && results[0]?.error;
  if (scopedError) {
    throw new Error(scopedError);
  }
  return { success: true, results };
};
