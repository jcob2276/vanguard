import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { getTodayWarsaw, shiftDateStr } from '../../../lib/date';
import type { Tables } from '../../../lib/database.types';
import type { OuraRow, NutritionDayRow, WorkoutSessionSummary, LenieLogRow } from '../desktopUtils';
import type { PatternRow, WikiRow, KnowledgeRow } from '../general/IntelligencePanel';
import type { StrainData } from '../hero/CockpitBanner';

export interface DesktopSessionRow extends WorkoutSessionSummary {
  id: string;
  workout_day: string | null;
  session_rpe: number | null;
}

export interface StravaActivityRow {
  sport_type: string;
  distance: number | null;
  moving_time: number | null;
  start_date: string;
  best_efforts: unknown;
}

interface ProjectRow {
  id: string;
  name: string;
  status: string;
  goal: string | null;
  color: string | null;
  deadline: string | null;
  sense_status?: string | null;
}

interface MoveRow {
  id: string;
  title: string;
  status: string;
  completed_at: string | null;
  planned_for: string | null;
  project_id: string | null;
}

export interface GoalsRow {
  goal_cialo: string | null;
  goal_duch: string | null;
  goal_konto: string | null;
  date_cialo: string | null;
  date_duch: string | null;
  date_konto: string | null;
}

export interface SprintGoalRow {
  id: string;
  personal_year: number;
  sprint_number: number;
  goal_text: string | null;
}

interface WinRow {
  [key: string]: unknown;
}

interface MarathonRow {
  name: string;
  date: string;
  target_time: string | null;
  status: string;
}

export type HabitRow = Tables<'habits'>;
export type HabitLogRow = Tables<'habit_logs'>;
type BodyMetricRow = { date: string | null; weight: number | null; waist: number | null; neck: number | null; hips: number | null; body_fat: number | null };

interface DesktopDashboardData {
  loading: boolean;
  oura: OuraRow[];
  nutrition: NutritionDayRow[];
  sessions: DesktopSessionRow[];
  body: BodyMetricRow[];
  heightCm: number | null;
  strain: StrainData | null;
  strava: StravaActivityRow[];
  projects: ProjectRow[];
  moves: MoveRow[];
  goals: GoalsRow | null;
  sprintGoals: SprintGoalRow[];
  stream: unknown[];
  patterns: PatternRow[];
  wins: WinRow[];
  wiki: WikiRow[];
  knowledge: KnowledgeRow[];
  lenieLogs: LenieLogRow[];
  habits: HabitRow[];
  habitLogs: HabitLogRow[];
  marathon: MarathonRow | null;
  refresh: () => Promise<void>;
}

export const desktopKeys = {
  all: ['desktop'] as const,
  dashboard: (userId: string) => [...desktopKeys.all, 'dashboard', userId] as const,
};

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

async function fetchDashboardFallback(userId: string) {
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
    profile,
    projectsRes,
    movesRes,
    goalsRes,
    sprintGoalsRes,
    marathonRes,
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
    projects: projectsRes.data || [],
    moves: (movesRes.data || []).map(mapTodoToMove),
    goals: goalsRes.data || null,
    sprintGoals: sprintGoalsRes.data || [],
    marathon: marathonRes.data || null,
  };
}

type DesktopQueryResult = Omit<DesktopDashboardData, 'loading' | 'refresh'>;

export function useDesktopData(userId: string | undefined): DesktopDashboardData {
  const queryClient = useQueryClient();

  const query = useQuery<DesktopQueryResult>({
    queryKey: desktopKeys.dashboard(userId || ''),
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');

      const { data, error } = await supabase.rpc('get_desktop_dashboard_data', { p_user_id: userId });
      const { data: profile } = await supabase
        .from('nutrition_profile')
        .select('height_cm')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[useDesktopData] RPC failed, using direct fallback:', error.message);
        const fallback = await fetchDashboardFallback(userId);
        // fetchDashboardFallback's inferred column types are a structural match for
        // DesktopQueryResult but aren't declared against it directly; assert the contract.
        return {
          oura: fallback.oura,
          nutrition: fallback.nutrition,
          sessions: fallback.sessions,
          body: fallback.body,
          heightCm: fallback.heightCm,
          strain: fallback.strain,
          strava: fallback.strava,
          projects: fallback.projects,
          moves: fallback.moves,
          goals: fallback.goals,
          sprintGoals: fallback.sprintGoals,
          stream: [],
          patterns: [],
          wins: [],
          wiki: [],
          knowledge: [],
          lenieLogs: [],
          habits: fallback.habits,
          habitLogs: fallback.habitLogs,
          marathon: fallback.marathon,
        } as DesktopQueryResult;
      }

      // The RPC's return shape is opaque to Postgres/Supabase codegen; we trust it matches
      // the same contract as fetchDashboardFallback above (that's why the fallback exists).
      const d = data as Record<string, unknown>;
      return {
        oura: (d['oura'] as OuraRow[]) || [],
        nutrition: (d['nutrition'] as NutritionDayRow[]) || [],
        sessions: (d['sessions'] as DesktopSessionRow[]) || [],
        body: (d['body'] as BodyMetricRow[]) || [],
        heightCm: profile?.height_cm != null ? Number(profile.height_cm) : null,
        strain: (d['strain'] as StrainData) || null,
        strava: (d['strava'] as StravaActivityRow[]) || [],
        projects: (d['projects'] as ProjectRow[]) || [],
        moves: (d['moves'] as MoveRow[]) || [],
        goals: (d['goals'] as GoalsRow) || null,
        sprintGoals: (d['sprintGoals'] as SprintGoalRow[]) || [],
        stream: (d['stream'] as unknown[]) || [],
        patterns: (d['patterns'] as PatternRow[]) || [],
        wins: (d['wins'] as WinRow[]) || [],
        wiki: (d['wiki'] as WikiRow[]) || [],
        knowledge: (d['knowledge'] as KnowledgeRow[]) || [],
        lenieLogs: (d['lenieLogs'] as LenieLogRow[]) || [],
        habits: (d['habits'] as HabitRow[]) || [],
        habitLogs: (d['habitLogs'] as HabitLogRow[]) || [],
        marathon: (d['marathon'] as MarathonRow) || null,
      };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes stale time
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: desktopKeys.dashboard(userId || '') });
  };

  const fallbackData: DesktopQueryResult = {
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
    marathon: null,
  };

  const d = query.data || fallbackData;

  return {
    loading: query.isLoading,
    ...d,
    refresh,
  };
}
