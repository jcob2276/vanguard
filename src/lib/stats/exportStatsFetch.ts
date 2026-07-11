import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '../database.types';
import type { ExportStatsMarkdownParams } from './exportStatsTypes';
import { emptyRes, parseLocalDateToIso } from './exportStatsHelpers';

export interface ExportData {
  sessions: Tables<'workout_sessions'>[];
  bodyMetrics: Tables<'body_metrics'>[];
  food: Tables<'daily_food_entries'>[];
  foodError: { message: string } | null;
  nutritionSummary: Tables<'daily_nutrition'>[];
  journal: Tables<'daily_wins'>[];
  telegramLogs: { id: string; content: string | null; source: string | null; created_at: string | null; metadata: import('../database.types').Json | null }[];
  reviews: Tables<'weekly_reviews'>[];
  goals: Tables<'life_goals'> | null;
  habits: Tables<'habits'>[];
  habitLogs: Tables<'habit_logs'>[];
  ouraData: Tables<'oura_daily_summary'>[];
  ouraEnhanced: Tables<'oura_enhanced'>[];
  ouraDerived: { day: string; [key: string]: unknown }[];
  photos: Tables<'progress_photos'>[];
  locationHistory: Tables<'location_history'>[];
  fundament: Tables<'user_fundament'> | null;
  stravaData: { strava_id: number | null; name: string | null; sport_type: string | null; start_date: string | null; elapsed_time: number | null; moving_time: number | null; distance: number | null; total_elevation_gain: number | null; pace_sec_per_km: number | null; cadence_spm: number | null; hr_avg: number | null; hr_max: number | null; hr_source: string | null; hr_frozen: boolean | null; splits_with_hr: import('../database.types').Json | null; gear_name: string | null; gear_distance_km: number | null; has_pr: boolean | null; pause_seconds: number | null; is_oura: boolean | null; perceived_exertion: number | null; workout_type: number | null; best_efforts: import('../database.types').Json | null; gc_hr_zones: import('../database.types').Json | null; gc_weather: import('../database.types').Json | null; gc_training_effect_aerobic: number | null; gc_training_effect_anaerobic: number | null; gc_vo2max: number | null; gc_enriched_at: string | null }[];
  stravaRawData: { strava_id: number; raw_data: { description?: string; athlete_comment?: string } | null }[];
  awSummary: Tables<'aw_daily_summary'>[];
  phoneUsageData: Tables<'phone_usage_daily'>[];
}

export async function fetchExportData(
  supabase: SupabaseClient,
  session: { user: { id: string }; access_token: string },
  dateRange: { from: string; to: string },
  flags: Pick<ExportStatsMarkdownParams, 'includeNutrition' | 'includeJournal' | 'includeOura' | 'includeHabits' | 'includeWorkouts' | 'includeBody' | 'includeActivityWatch'>
): Promise<ExportData> {
  const { includeNutrition, includeJournal, includeOura, includeHabits, includeWorkouts, includeBody, includeActivityWatch } = flags;
  const exportStartIso = parseLocalDateToIso(dateRange.from, '00:00:00');
  const exportEndIso = parseLocalDateToIso(dateRange.to, '23:59:59.999');

  const [
    { data: sessions },
    { data: bodyMetrics },
    { data: food, error: foodError },
    { data: nutritionSummary },
    { data: journal },
    { data: telegramLogs },
    { data: reviews },
    { data: goals },
    { data: habits },
    { data: habitLogs },
    { data: ouraData },
    { data: ouraEnhanced },
    { data: ouraDerived },
    { data: photos },
    { data: locationHistory },
    { data: fundament },
    { data: stravaData },
    { data: stravaRawData },
    { data: awSummary },
    { data: phoneUsageData }
  ] = await Promise.all([
    includeWorkouts ? supabase.from('workout_sessions').select('*, exercise_logs(*)').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to).order('date', { ascending: true }) : Promise.resolve(emptyRes()),
    includeBody ? supabase.from('body_metrics').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to).order('date', { ascending: true }) : Promise.resolve(emptyRes()),
    includeNutrition ? supabase.from('daily_food_entries').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to).order('date', { ascending: true }) : Promise.resolve(emptyRes()),
    includeNutrition ? supabase.from('daily_nutrition').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to).order('date', { ascending: true }) : Promise.resolve(emptyRes()),
    includeJournal ? supabase.from('daily_wins').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to).order('date', { ascending: true }) : Promise.resolve(emptyRes()),
    includeJournal ? supabase.from('vanguard_stream').select('id, content, source, created_at, metadata').eq('user_id', session.user.id).eq('source', 'telegram').gte('created_at', exportStartIso).lte('created_at', exportEndIso).order('created_at', { ascending: true }) : Promise.resolve(emptyRes()),
    supabase.from('weekly_reviews').select('*').eq('user_id', session.user.id).gte('week_start', dateRange.from).lte('week_start', dateRange.to),
    supabase.from('life_goals').select('*').eq('user_id', session.user.id).maybeSingle(),
    includeHabits ? supabase.from('habits').select('*').eq('user_id', session.user.id) : Promise.resolve(emptyRes()),
    includeHabits ? supabase.from('habit_logs').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to) : Promise.resolve(emptyRes()),
    includeOura ? supabase.from('oura_daily_summary').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to) : Promise.resolve(emptyRes()),
    includeOura ? supabase.from('oura_enhanced').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to) : Promise.resolve(emptyRes()),
    includeOura ? supabase.from('oura_derived_daily').select('*').eq('user_id', session.user.id).gte('day', dateRange.from).lte('day', dateRange.to) : Promise.resolve(emptyRes()),
    supabase.from('progress_photos').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to),
    supabase.from('location_history').select('*').eq('user_id', session.user.id).gte('created_at', exportStartIso).lte('created_at', exportEndIso),
    supabase.from('user_fundament').select('*').eq('user_id', session.user.id).maybeSingle(),
    includeWorkouts ? supabase.from('strava_activities_clean').select('strava_id,name,sport_type,start_date,elapsed_time,moving_time,distance,total_elevation_gain,pace_sec_per_km,cadence_spm,hr_avg,hr_max,hr_source,hr_frozen,splits_with_hr,gear_name,gear_distance_km,has_pr,pause_seconds,is_oura,perceived_exertion,workout_type,best_efforts,gc_hr_zones,gc_weather,gc_training_effect_aerobic,gc_training_effect_anaerobic,gc_vo2max,gc_enriched_at').eq('user_id', session.user.id).eq('is_oura', false).gte('start_date', exportStartIso).lte('start_date', exportEndIso).order('start_date', { ascending: true }) : Promise.resolve(emptyRes()),
    includeWorkouts ? supabase.from('strava_activities').select('strava_id,raw_data').eq('user_id', session.user.id).gte('start_date', exportStartIso).lte('start_date', exportEndIso) : Promise.resolve(emptyRes()),
    includeActivityWatch ? supabase.from('aw_daily_summary').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to).order('date', { ascending: true }) : Promise.resolve(emptyRes()),
    supabase.from('phone_usage_daily').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to).order('date', { ascending: true })
  ]);

  return {
    sessions: (sessions ?? []) as Tables<'workout_sessions'>[],
    bodyMetrics: (bodyMetrics ?? []) as Tables<'body_metrics'>[],
    food: (food ?? []) as Tables<'daily_food_entries'>[],
    foodError: foodError,
    nutritionSummary: (nutritionSummary ?? []) as Tables<'daily_nutrition'>[],
    journal: (journal ?? []) as Tables<'daily_wins'>[],
    telegramLogs: (telegramLogs ?? []) as ExportData['telegramLogs'],
    reviews: (reviews ?? []) as Tables<'weekly_reviews'>[],
    goals: (goals ?? null) as Tables<'life_goals'> | null,
    habits: (habits ?? []) as Tables<'habits'>[],
    habitLogs: (habitLogs ?? []) as Tables<'habit_logs'>[],
    ouraData: (ouraData ?? []) as Tables<'oura_daily_summary'>[],
    ouraEnhanced: (ouraEnhanced ?? []) as Tables<'oura_enhanced'>[],
    ouraDerived: (ouraDerived ?? []) as ExportData['ouraDerived'],
    photos: (photos ?? []) as Tables<'progress_photos'>[],
    locationHistory: (locationHistory ?? []) as Tables<'location_history'>[],
    fundament: (fundament ?? null) as Tables<'user_fundament'> | null,
    stravaData: (stravaData ?? []) as ExportData['stravaData'],
    stravaRawData: (stravaRawData ?? []) as ExportData['stravaRawData'],
    awSummary: (awSummary ?? []) as Tables<'aw_daily_summary'>[],
    phoneUsageData: (phoneUsageData ?? []) as Tables<'phone_usage_daily'>[],
  };
}
