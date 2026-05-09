import { format, subDays } from 'date-fns';
import { detectState, calculateIdentityScore, discoverPatterns, OPERATING_STATES } from './stateEngine';

export async function gatherUserContext(supabase, userId) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
  
  // 1. Fetch all relevant data in parallel (No Waterfalls)
  const [
    { data: oura },
    { data: dailyWins },
    { data: nutrition },
    { data: workout },
    { data: fundament },
    { data: settings },
    { data: screenTime }
  ] = await Promise.all([
    supabase.from('oura_daily_summary').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(7),
    supabase.from('daily_wins').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(14),
    supabase.from('daily_nutrition').select('protein').eq('date', today).maybeSingle(),
    supabase.from('workout_sessions').select('id').eq('date', today).maybeSingle(),
    supabase.from('life_goals').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('user_settings').select('disciplined_streak').eq('user_id', userId).maybeSingle(),
    supabase.from('screen_time_details').select('*').eq('user_id', userId).gte('date', weekAgo)
  ]);

  const todayWin = dailyWins?.find(d => d.date === today);
  const streak = settings?.disciplined_streak || 0;

  // 2. Run Interpretation Layer
  const currentStateKey = detectState({
    todayWin,
    oura: oura?.[0],
    workoutToday: !!workout,
    streak,
    protein: nutrition?.protein || 0
  });

  const identityScore = calculateIdentityScore({
    todayWin,
    hasWorkoutToday: !!workout,
    protein: nutrition?.protein || 0,
    ouraToday: oura?.[0],
    streak
  });

  const patterns = discoverPatterns(dailyWins || [], [], oura || []);

  // 3. Aggregate Screen Time by App (Across devices and days)
  const aggregatedScreenTime = Object.values((screenTime || []).reduce((acc, curr) => {
    if (!acc[curr.app_name]) {
      acc[curr.app_name] = { app: curr.app_name, total_minutes: 0 };
    }
    acc[curr.app_name].total_minutes += Math.round(curr.duration_seconds / 60);
    return acc;
  }, {})).sort((a, b) => b.total_minutes - a.total_minutes).slice(0, 15);

  // 4. Compress Context for AI
  return {
    system_state: {
      label: OPERATING_STATES[currentStateKey].label,
      description: OPERATING_STATES[currentStateKey].description,
      identity_score: identityScore,
      streak: streak
    },
    user_philosophy: {
      physical: fundament?.goal_cialo,
      spiritual: fundament?.goal_duch,
      financial: fundament?.goal_konto
    },
    detected_patterns: patterns.map(p => p.text),
    top_apps_last_7_days: aggregatedScreenTime,
    recent_performance: dailyWins?.slice(0, 7).map(w => ({
      date: w.date,
      result: w.result === 'Z' ? 'WIN' : 'LOSS',
      tasks: [
        { name: w.task_1, done: w.done_1 },
        { name: w.task_2, done: w.done_2 },
        { name: w.task_3, done: w.done_3 },
        { name: w.task_4, done: w.done_4 },
        { name: w.task_5, done: w.done_5 }
      ].filter(t => t.name)
    }))
  };
}


