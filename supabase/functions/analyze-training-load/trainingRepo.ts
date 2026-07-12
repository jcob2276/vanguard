export async function fetchTrainingRawData(
  supabase: any,
  userId: string,
  w4Start: string,
  w0Start: string,
  today: string,
  addWarsawDays: (d: string, days: number) => string,
) {
  const [strainR, workoutsR, stravaR, ouraR, planR] = await Promise.all([
    supabase
      .from('daily_strain')
      .select('date,strain_score,cardio_load,strength_load')
      .eq('user_id', userId)
      .gte('date', w4Start)
      .lte('date', today)
      .order('date'),
    supabase
      .from('workout_sessions')
      .select('id,date,workout_day,session_notes,msp_passed,duration_minutes,exercise_logs(exercise_name,set_number,weight,reps,rir,rpe,muscle_tags,is_pws_or_msp)')
      .eq('user_id', userId)
      .gte('date', w4Start)
      .lte('date', today)
      .order('date'),
    supabase
      .from('strava_activities_clean')
      .select('start_date,name,sport_type,distance,moving_time,hr_avg,hr_max,perceived_exertion,has_pr,workout_type,gc_hr_zones,gc_weather,gc_laps,gc_training_effect_aerobic,gc_training_effect_anaerobic,gc_vo2max,gc_enriched_at')
      .eq('user_id', userId)
      .eq('is_oura', false)
      .gte('start_date', w4Start + 'T00:00:00')
      .lte('start_date', today + 'T23:59:59')
      .order('start_date'),
    supabase
      .from('oura_daily_summary')
      .select('date,hrv_avg,rhr_avg,readiness_score,total_sleep_hours')
      .eq('user_id', userId)
      .gte('date', w4Start)
      .lte('date', today)
      .order('date'),
    supabase
      .from('training_plan_workouts')
      .select('planned_date,workout_type,workout_name,target_distance_km,target_duration_min,target_pace_min_km,target_hr_max,goal')
      .eq('user_id', userId)
      .gte('planned_date', w0Start)
      .lte('planned_date', addWarsawDays(today, 7))
      .order('planned_date'),
  ]);

  const queryErrors: string[] = [];
  if (strainR.error) {
    console.error('[training] strain query failed:', strainR.error.message);
    queryErrors.push('strain');
  }
  if (workoutsR.error) {
    console.error('[training] workouts query failed:', workoutsR.error.message);
    queryErrors.push('workouts');
  }
  if (stravaR.error) {
    console.error('[training] strava query failed:', stravaR.error.message);
    queryErrors.push('strava');
  }
  if (ouraR.error) {
    console.error('[training] oura query failed:', ouraR.error.message);
    queryErrors.push('oura');
  }
  if (planR.error) {
    console.error('[training] plan query failed:', planR.error.message);
    queryErrors.push('training_plan');
  }

  return {
    strainAll: strainR.data || [],
    workoutsAll: workoutsR.data || [],
    stravaAll: stravaR.data || [],
    ouraAll: ouraR.data || [],
    planContext: planR.data || [],
    queryErrors,
  };
}
