import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getWarsawDateString } from "./time.ts";

interface WorldStateMeta {
  source: string;
  freshness_hours: number;
  confidence: number;
  last_updated: string | null;
}

export interface WorldState {
  timestamp: string;
  date: string;
  user_id: string;
  biometrics: {
    sleep_hours: number | null;
    hrv_avg: number | null;
    readiness_score: number | null;
    oura_history: any[] | null;
    _meta: WorldStateMeta;
  };
  execution: {
    tasks_done: number | null;
    journal_present: boolean;
    today_win: any;
    _meta: WorldStateMeta;
  };
  system: {
    final_state: string | null;
    execution_score: number | null;
    identity_score: number | null;
    _meta: WorldStateMeta;
  };
  training: {
    strain_score: number | null;
    recovery_score: number | null;
    daily_status: string | null;
    main_limiter: string | null;
    has_workout_today: boolean;
    last_training_date: string | null;
    _meta: WorldStateMeta;
  };
  nutrition: {
    protein_today: number | null;
    calories_today: number | null;
    weekly_calories: number | null;
    _meta: WorldStateMeta;
  };
}

export async function fetchWorldState(
  supabase: SupabaseClient,
  userId: string,
  dateStr?: string,
  nowMsOverride?: number
): Promise<WorldState> {
  const date = dateStr || getWarsawDateString();
  const nowMs = nowMsOverride || Date.now();

  const calculateFreshness = (updatedAt: string | null) => {
    if (!updatedAt) return 999;
    const diffMs = nowMs - new Date(updatedAt).getTime();
    return Math.max(0, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(1)));
  };

  const calculateConfidence = (freshnessHours: number, thresholdHours: number) => {
    if (freshnessHours > thresholdHours) return 0.2; // Stale data
    return 1.0;
  };

  // 1. Oura Biometrics (30 days history)
  const { data: ouraData } = await supabase
    .from('oura_daily_summary')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(30);

  const oura = ouraData?.find((o: any) => o.date === date) || ouraData?.[0] || null;
  const ouraFreshness = calculateFreshness(oura?.updated_at);

  // 2. Daily Wins (Execution with tasks)
  const { data: wins } = await supabase
    .from('daily_wins')
    .select('*, daily_win_tasks(*)')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  const winsFreshness = calculateFreshness(wins?.updated_at);
  let tasksDone = 0;
  if (wins?.daily_win_tasks) {
    tasksDone = wins.daily_win_tasks.filter((t: any) => t.done).length;
  } else if (wins) {
    if (wins.done_1) tasksDone++;
    if (wins.done_2) tasksDone++;
    if (wins.done_3) tasksDone++;
    if (wins.done_4) tasksDone++;
    if (wins.done_5) tasksDone++;
  }

  // 3. Vanguard Aggregates (System State)
  const { data: aggregate } = await supabase
    .from('vanguard_daily_aggregates')
    .select('final_state, execution_score, identity_score, updated_at')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  const aggFreshness = calculateFreshness(aggregate?.updated_at);

  // 4. Daily Strain (Training & Recovery context)
  const { data: strain } = await supabase
    .from('daily_strain')
    .select('strain_score, recovery_score, daily_status, main_limiter, updated_at')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  const strainFreshness = calculateFreshness(strain?.updated_at);

  // 5. Workout sessions today & last training date
  const { data: workoutToday } = await supabase
    .from('workout_sessions')
    .select('id, updated_at')
    .eq('user_id', userId)
    .eq('date', date)
    .limit(1)
    .maybeSingle();

  const { data: lastWorkout } = await supabase
    .from('workout_sessions')
    .select('date')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 6. Nutrition details (Today + Weekly Calories)
  const { data: nutritionToday } = await supabase
    .from('daily_nutrition')
    .select('calories, protein, updated_at')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  const nutritionFreshness = calculateFreshness(nutritionToday?.updated_at);

  // Weekly calories calculation (Monday to today)
  const mondayDate = (() => {
    const d = new Date(date + 'T12:00:00Z');
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
  })();
  const monday = mondayDate.toISOString().split('T')[0];

  const { data: weeklyNutrition } = await supabase
    .from('daily_nutrition')
    .select('calories')
    .eq('user_id', userId)
    .gte('date', monday)
    .lte('date', date);

  const weeklyCalories = weeklyNutrition?.reduce((sum: number, n: any) => sum + (n.calories || 0), 0) || 0;

  return {
    timestamp: new Date().toISOString(),
    date,
    user_id: userId,
    biometrics: {
      sleep_hours: oura?.total_sleep_hours ?? null,
      hrv_avg: oura?.hrv_avg ?? null,
      readiness_score: oura?.readiness_score ?? null,
      oura_history: ouraData ?? null,
      _meta: {
        source: 'oura_daily_summary',
        freshness_hours: ouraFreshness,
        confidence: oura ? calculateConfidence(ouraFreshness, 24) : 0.0,
        last_updated: oura?.updated_at || null
      }
    },
    execution: {
      tasks_done: wins ? tasksDone : null,
      journal_present: !!wins?.journal_entry,
      today_win: wins ?? null,
      _meta: {
        source: 'daily_wins',
        freshness_hours: winsFreshness,
        confidence: wins ? calculateConfidence(winsFreshness, 12) : 0.0,
        last_updated: wins?.updated_at || null
      }
    },
    system: {
      final_state: aggregate?.final_state ?? null,
      execution_score: aggregate?.execution_score ?? null,
      identity_score: aggregate?.identity_score ?? null,
      _meta: {
        source: 'vanguard_daily_aggregates',
        freshness_hours: aggFreshness,
        confidence: aggregate ? calculateConfidence(aggFreshness, 24) : 0.0,
        last_updated: aggregate?.updated_at || null
      }
    },
    training: {
      strain_score: strain?.strain_score ?? null,
      recovery_score: strain?.recovery_score ?? null,
      daily_status: strain?.daily_status ?? null,
      main_limiter: strain?.main_limiter ?? null,
      has_workout_today: !!workoutToday,
      last_training_date: lastWorkout?.date || null,
      _meta: {
        source: 'daily_strain',
        freshness_hours: strainFreshness,
        confidence: strain ? calculateConfidence(strainFreshness, 24) : 0.0,
        last_updated: strain?.updated_at || null
      }
    },
    nutrition: {
      protein_today: nutritionToday?.protein ?? null,
      calories_today: nutritionToday?.calories ?? null,
      weekly_calories: weeklyCalories,
      _meta: {
        source: 'daily_nutrition',
        freshness_hours: nutritionFreshness,
        confidence: nutritionToday ? calculateConfidence(nutritionFreshness, 24) : 0.0,
        last_updated: nutritionToday?.updated_at || null
      }
    }
  };
}

export async function saveWorldState(
  supabase: SupabaseClient,
  userId: string,
  date: string,
  state: WorldState
): Promise<void> {
  const { error } = await supabase
    .from('vanguard_world_state')
    .upsert({
      user_id: userId,
      date,
      state_json: state,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,date' });

  if (error) {
    console.error(`[worldState] Failed to save world state for ${date}:`, error.message);
    throw error;
  }
}
