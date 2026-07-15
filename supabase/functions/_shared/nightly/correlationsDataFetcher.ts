import { aggregateStravaRuns } from '../correlationSeries.ts';

export interface PreparedCorrelationData {
  strainRows: any[];
  ouraRows: any[];
  ouraEnhRows: any[];
  nutrRows: any[];
  aggregateRows: any[];
  frictionRows: any[];
  foodRows: any[];
  workoutRows: any[];
  winsRows: any[];
  reconRows: any[];
  behaviorRows: any[];
  supplementRows: any[];
  stravaRows: any[];
  awRows: any[];
  bodyRows: any[];
}

/** Fetches raw data from 16 Supabase tables required for correlation analysis. */
async function fetchRawCorrelationData(supabase: any, userId: string, start90: string) {
  return await Promise.all([
    supabase.from('daily_strain').select('date, strain_score, recovery_score, fueling_score, cardio_load, strength_load, cns_load, leg_load, mental_load_score, illness_score, components').eq('user_id', userId).gte('date', start90).order('date'),
    supabase.from('oura_daily_summary').select('date, hrv_avg, rhr_avg, readiness_score, total_sleep_hours, sleep_score').eq('user_id', userId).gte('date', start90).order('date'),
    supabase.from('oura_enhanced').select('date, sleep_efficiency, sleep_latency_minutes, deep_sleep_hours, rem_sleep_hours, light_sleep_hours, sleep_average_heart_rate, sleep_average_hrv, sleep_lowest_heart_rate, restless_periods, temperature_deviation, spo2_percentage, vo2_max, stress_high_minutes, average_met_minutes, sedentary_minutes, bedtime_start').eq('user_id', userId).gte('date', start90).order('date'),
    supabase.from('daily_nutrition').select('date, calories, protein, carbs, fat, sugar, fiber, insulin_load, avg_food_quality').eq('user_id', userId).gte('date', start90).order('date'),
    supabase.from('vanguard_daily_aggregates').select('date, execution_score, identity_score, dopamine_load_index, screen_time_min, fragmentation_index').eq('user_id', userId).gte('date', start90).order('date'),
    supabase.from('friction_events').select('occurred_at, friction_type').eq('user_id', userId).gte('occurred_at', start90 + 'T00:00:00Z'),
    supabase.from('daily_food_entries').select('date, name, logged_at, calories').eq('user_id', userId).gte('date', start90).order('date'),
    supabase.from('vanguard_consolidated_activities').select('event_date, source_type, category, label, metric_value, metadata').eq('user_id', userId).gte('event_date', start90),
    supabase.from('daily_wins').select('date, mood_score, daily_rpe, done_1, done_2, done_3, done_4, done_5, task_1, task_2, task_3, task_4, task_5').eq('user_id', userId).gte('date', start90).order('date'),
    supabase.from('daily_reconciliations').select('date, day_score, phone_drift_morning').eq('user_id', userId).gte('date', start90),
    supabase.from('supplement_logs').select('date, supplement_id').eq('user_id', userId).gte('date', start90),
    supabase.from('supplements').select('id, slug').eq('user_id', userId),
    supabase.from('strava_activities_clean').select('start_date, sport_type, hr_avg, perceived_exertion, cadence_spm, suffer_score, distance, is_oura').eq('user_id', userId).gte('start_date', start90 + 'T00:00:00Z'),
    supabase.from('aw_daily_summary').select('date, productivity_ratio, phone_active_seconds').eq('user_id', userId).gte('date', start90),
    supabase.from('body_metrics').select('date, weight').eq('user_id', userId).gte('date', start90).order('date'),
    supabase.from('habit_logs').select('date, completed, habits(name)').eq('user_id', userId).gte('date', start90),
  ]);
}

/** Fetches and prepares 90-day time series data for correlation analysis. */
export async function fetchAndPrepareCorrelationData(
  supabase: any,
  userId: string,
  start90: string,
  todayWarsaw: string,
): Promise<{ data: PreparedCorrelationData; habitLogR: any }> {
  const [
    strainR, ouraR, ouraEnhR, nutrR, aggregatesR, frictionR, foodR, consolidatedR,
    winsR, reconR, suppLogR, suppR, stravaR, awR, bodyR, habitLogR,
  ] = await fetchRawCorrelationData(supabase, userId, start90);

  // Log queries failing (non-fatal, warning only)
  const queries = { strainR, ouraR, ouraEnhR, nutrR, aggregatesR, frictionR, foodR, consolidatedR, winsR, reconR, suppLogR, suppR, stravaR, awR, bodyR, habitLogR };
  for (const [name, res] of Object.entries(queries)) {
    if (res.error) {
      console.warn(`[correlations] query failed: ${name}: ${res.error.message}`);
    }
  }

  const consolidatedRows = consolidatedR.data ?? [];
  const workoutRows = consolidatedRows
    .filter((r: any) => r.source_type === 'workout_sessions')
    .map((r: any) => ({
      workout_day: r.event_date,
      hr_avg_bpm: r.metadata?.hr_avg_bpm ? Number(r.metadata.hr_avg_bpm) : null,
      hr_peak_bpm: r.metadata?.hr_peak_bpm ? Number(r.metadata.hr_peak_bpm) : null,
      hr_strain_score: r.metadata?.hr_strain_score ? Number(r.metadata.hr_strain_score) : null,
    }));

  const behaviorRows = consolidatedRows
    .filter((r: any) => r.source_type === 'behavior_log')
    .map((r: any) => ({
      date: r.event_date,
      behavior_key: r.category,
      value: r.metric_value ? Number(r.metric_value) : null,
    }));

  // §5.1 — days the user acknowledged as an unlabeled logging gap (illness/travel/other) are
  // excluded from the nutrition signal so a gap doesn't get misread as a fasting day.
  const acknowledgedGapDates = new Set(
    behaviorRows.filter((r: { behavior_key: string }) => r.behavior_key === 'przerwa_w_logowaniu').map((r: { date: string }) => r.date),
  );
  const excludeGapDays = <T extends { date: string }>(rows: T[]): T[] =>
    acknowledgedGapDates.size === 0 ? rows : rows.filter((r) => !acknowledgedGapDates.has(r.date));

  const slugMap = new Map((suppR.data ?? []).map((s: any) => [s.id, s.slug]));
  const supplementRows = (suppLogR.data ?? []).map((row: any) => ({
    date: row.date,
    slug: slugMap.get(row.supplement_id) ?? 'unknown',
  }));

  const stravaRows = aggregateStravaRuns(stravaR.data ?? [], todayWarsaw, start90);

  return {
    data: {
      strainRows: strainR.data ?? [],
      ouraRows: ouraR.data ?? [],
      ouraEnhRows: ouraEnhR.data ?? [],
      nutrRows: excludeGapDays(nutrR.data ?? []),
      aggregateRows: aggregatesR.data ?? [],
      frictionRows: frictionR.data ?? [],
      foodRows: excludeGapDays(foodR.data ?? []),
      workoutRows,
      winsRows: winsR.data ?? [],
      reconRows: (reconR.data ?? []).map((r: any) => ({ date: r.date, day_score: r.day_score, phone_drift_morning: r.phone_drift_morning })),
      behaviorRows,
      supplementRows,
      stravaRows,
      awRows: awR.data ?? [],
      bodyRows: bodyR.data ?? [],
    },
    habitLogR,
  };
}
