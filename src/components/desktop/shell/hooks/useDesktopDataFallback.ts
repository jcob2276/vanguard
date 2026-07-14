import { supabase } from '../../../../lib/supabase';
import { getTodayWarsaw, shiftDateStr } from '../../../../lib/date';

function mapTodoToMove(row: {
  id: string;
  title: string;
  status: string;
  completed_at: string | null;
  due_date: string | null;
  project_id: string | null;
}) {
  return {
    id: row.id,
    title: row.title,
    status: row.status === 'open' ? 'todo' : row.status,
    completed_at: row.completed_at,
    planned_for: row.due_date,
    project_id: row.project_id,
  };
}

export async function fetchDashboardFallback(userId: string) {
  const today = getTodayWarsaw();
  const since60 = shiftDateStr(today, -60);
  const since91 = shiftDateStr(today, -91);

  const [
    oura,
    nutrition,
    sessionsRes,
    body,
    strain,
    strava,
    habits,
    habitLogs,
    projectsRes,
    movesRes,
    goalsRes,
    sprintGoalsRes,
    marathonRes,
    nutritionTargetsRes,
    profileRes,
  ] = await Promise.all([
    supabase.from('oura_daily_summary').select('date, hrv_avg, rhr_avg, total_sleep_hours, readiness_score, sleep_score')
      .eq('user_id', userId).gte('date', since60).order('date', { ascending: true }),
    supabase.from('daily_nutrition').select('date, calories, protein')
      .eq('user_id', userId).gte('date', since60).order('date', { ascending: true }),
    supabase.from('workout_sessions').select('id, date, workout_day, session_rpe, exercise_logs(exercise_name, weight, reps, muscle_tags, is_pws_or_msp, rir, rpe)')
      .eq('user_id', userId).gte('date', since91).order('date', { ascending: true }),
    supabase.from('body_metrics').select('date, weight, waist, neck, hips, body_fat')
      .eq('user_id', userId).gte('date', since91).order('date', { ascending: true }),
    supabase.from('daily_strain').select('daily_status, main_limiter, strain_score, recovery_score, fueling_score, fueling_provisional')
      .eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('strava_activities_clean').select('sport_type, distance, moving_time, start_date, best_efforts')
      .eq('user_id', userId).gte('start_date', since91 + 'T00:00:00').order('start_date', { ascending: true }),
    supabase.from('habits').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('habit_logs').select('*').eq('user_id', userId).gte('date', since60),
    supabase.from('projects').select('id, name, status, goal, color, deadline')
      .eq('user_id', userId).in('status', ['active', 'paused']).order('created_at', { ascending: false }),
    supabase.from('todo_items').select('id, title, status, completed_at, due_date, project_id')
      .eq('user_id', userId).neq('status', 'dropped').eq('is_milestone', false)
      .order('updated_at', { ascending: false }).limit(80),
    supabase.from('life_goals').select('goal_cialo, goal_duch, goal_konto, date_cialo, date_duch, date_konto')
      .eq('user_id', userId).maybeSingle(),
    supabase.from('sprint_goals').select('id, personal_year, sprint_number, goal_text')
      .eq('user_id', userId).order('personal_year', { ascending: true }).order('sprint_number', { ascending: true }),
    supabase.from('marathons').select('name, date, target_time, status')
      .eq('user_id', userId).eq('status', 'upcoming').order('date', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('nutrition_targets')
      .select('protein_floor_g, target_kcal')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('nutrition_profile')
      .select('height_cm, sleep_target_hours, protein_g_per_kg')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const ntRow = nutritionTargetsRes?.data;
  const profileRow = profileRes?.data;

  // Resolve personal targets (same logic as _shared/personalTargets.ts for the edge layer)
  let proteinFloorG = 140;
  if (ntRow?.protein_floor_g != null && Number(ntRow.protein_floor_g) > 0) {
    proteinFloorG = Number(ntRow.protein_floor_g);
  } else if (profileRow?.protein_g_per_kg != null && body.data?.length) {
    const latestWeight = body.data[body.data.length - 1]?.weight;
    if (latestWeight) proteinFloorG = Math.round(Number(latestWeight) * Number(profileRow.protein_g_per_kg));
  }
  const sleepTargetH = profileRow?.sleep_target_hours != null && Number(profileRow.sleep_target_hours) > 0
    ? Number(profileRow.sleep_target_hours) : 8.0;

  return {
    oura: oura.data || [],
    nutrition: nutrition.data || [],
    sessions: sessionsRes.data || [],
    body: body.data || [],
    heightCm: profileRow?.height_cm != null ? Number(profileRow.height_cm) : null,
    strain: strain.data || null,
    strava: strava.data || [],
    habits: habits.data || [],
    habitLogs: habitLogs.data || [],
    projects: projectsRes.data || [],
    moves: (movesRes.data || []).map(mapTodoToMove),
    goals: goalsRes.data || null,
    sprintGoals: sprintGoalsRes.data || [],
    marathon: marathonRes.data || null,
    personalTargets: {
      proteinFloorG,
      targetKcal: ntRow?.target_kcal != null ? Number(ntRow.target_kcal) : null,
      sleepTargetH,
    },
  };
}
