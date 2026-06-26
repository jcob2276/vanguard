import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { getTodayWarsaw } from '../../lib/date';

async function fetchDashboardFallback(userId: string) {
  const today = getTodayWarsaw();
  const d60 = new Date(today + 'T12:00:00Z');
  d60.setUTCDate(d60.getUTCDate() - 60);
  const since60 = d60.toISOString().slice(0, 10);
  const d91 = new Date(today + 'T12:00:00Z');
  d91.setUTCDate(d91.getUTCDate() - 91);
  const since91 = d91.toISOString().slice(0, 10);

  const [
    oura,
    nutrition,
    sessionsRes,
    body,
    strain,
    strava,
    habits,
    habitLogs,
    profile,
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
    supabase.from('nutrition_profile').select('height_cm').eq('user_id', userId).maybeSingle(),
  ]);

  return {
    oura: oura.data || [],
    nutrition: nutrition.data || [],
    sessions: sessionsRes.data || [],
    body: body.data || [],
    heightCm: profile.data?.height_cm != null ? Number(profile.data.height_cm) : null,
    strain: strain.data || null,
    strava: strava.data || [],
    habits: habits.data || [],
    habitLogs: habitLogs.data || [],
  };
}

let globalCache: any = null;
let lastFetchTime = 0;

export function useDesktopData(userId: string | undefined) {
  const [s, setS] = useState<{
    loading: boolean;
    oura: any[];
    nutrition: any[];
    sessions: any[];
    body: any[];
    heightCm: number | null;
    strain: any | null;
    strava: any[];
    projects: any[];
    moves: any[];
    goals: any | null;
    sprintGoals: any[];
    stream: any[];
    patterns: any[];
    wins: any[];
    wiki: any[];
    knowledge: any[];
    lenieLogs: any[];
    habits: any[];
    habitLogs: any[];
  }>(() => {
    if (globalCache) return { ...globalCache, loading: false };
    return {
      loading: true,
      oura: [],
      nutrition: [],
      sessions: [],
      body: [],
      heightCm: null,
      strain: null,
      strava: [],
      projects: [],
      moves: [],
      goals: null,
      sprintGoals: [],
      stream: [],
      patterns: [],
      wins: [],
      wiki: [],
      knowledge: [],
      lenieLogs: [],
      habits: [],
      habitLogs: [],
    };
  });

  const load = useCallback(async (force = false) => {
    if (!userId) return;
    
    if (!force && globalCache && Date.now() - lastFetchTime < 5 * 60 * 1000) {
      setS({ ...globalCache, loading: false });
      return;
    }

    // Only set loading to true if we don't have cached data to prevent UI flashing
    if (!globalCache) {
      setS(p => ({ ...p, loading: true }));
    }
    
    const { data, error } = await supabase.rpc('get_desktop_dashboard_data', { p_user_id: userId });
    const { data: profile } = await supabase
      .from('nutrition_profile')
      .select('height_cm')
      .eq('user_id', userId)
      .maybeSingle();
      
    if (error) {
      console.error('Error loading dashboard data (RPC):', error);
      const fallback = await fetchDashboardFallback(userId);
      const fallbackData = {
        oura: fallback.oura,
        nutrition: fallback.nutrition,
        sessions: fallback.sessions,
        body: fallback.body,
        heightCm: fallback.heightCm,
        strain: fallback.strain,
        strava: fallback.strava,
        projects: [],
        moves: [],
        goals: null,
        sprintGoals: [],
        stream: [],
        patterns: [],
        wins: [],
        wiki: [],
        knowledge: [],
        lenieLogs: [],
        habits: fallback.habits,
        habitLogs: fallback.habitLogs,
      };
      globalCache = fallbackData;
      lastFetchTime = Date.now();
      setS({ ...fallbackData, loading: false });
      return;
    }
    
    const d = data as any;
    const finalData = {
      oura: d?.oura || [],
      nutrition: d?.nutrition || [],
      sessions: d?.sessions || [],
      body: d?.body || [],
      heightCm: profile?.height_cm != null ? Number(profile.height_cm) : null,
      strain: d?.strain || null,
      strava: d?.strava || [],
      projects: d?.projects || [],
      moves: d?.moves || [],
      goals: d?.goals || null,
      sprintGoals: d?.sprintGoals || [],
      stream: d?.stream || [],
      patterns: d?.patterns || [],
      wins: d?.wins || [],
      wiki: d?.wiki || [],
      knowledge: d?.knowledge || [],
      lenieLogs: d?.lenieLogs || [],
      habits: d?.habits || [],
      habitLogs: d?.habitLogs || [],
    };
    
    globalCache = finalData;
    lastFetchTime = Date.now();
    setS({ ...finalData, loading: false });
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...s, refresh: () => load(true) };
}
