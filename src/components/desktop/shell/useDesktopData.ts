import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { Tables } from '../../../lib/database.types';
import type { OuraRow, NutritionDayRow, WorkoutSessionSummary, LenieLogRow } from '../desktopUtils';
import type { PatternRow, WikiRow, KnowledgeRow } from '../general/IntelligencePanel';
import type { StrainData } from '../hero/CockpitBanner';
import { fetchDashboardFallback } from './hooks/useDesktopDataFallback';

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

export interface ProjectRow {
  id: string;
  name: string;
  status: string;
  goal: string | null;
  color: string | null;
  deadline: string | null;
  sense_status?: string | null;
}

export interface MoveRow {
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

export interface WinRow {
  [key: string]: unknown;
}

export interface MarathonRow {
  name: string;
  date: string;
  target_time: string | null;
  status: string;
}

export type HabitRow = Tables<'habits'>;
export type HabitLogRow = Tables<'habit_logs'>;
export type BodyMetricRow = { date: string | null; weight: number | null; waist: number | null; neck: number | null; hips: number | null; body_fat: number | null };

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
  /** Personal goals resolved from nutrition_targets + nutrition_profile. */
  personalTargets: { proteinFloorG: number; targetKcal: number | null; sleepTargetH: number } | null;
  refresh: () => Promise<void>;
}

import { desktopKeys } from '../../../lib/queryKeys';

export type DesktopQueryResult = Omit<DesktopDashboardData, 'loading' | 'refresh'>;

export function useDesktopData(userId: string | undefined): DesktopDashboardData {
  const queryClient = useQueryClient();

  const query = useQuery<DesktopQueryResult>({
    queryKey: desktopKeys.dashboard(userId || ''),
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');

      const [{ data, error }, { data: ntRow }, { data: profileRow }] = await Promise.all([
        supabase.rpc('get_desktop_dashboard_data', { p_user_id: userId }),
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
          personalTargets: fallback.personalTargets,
        } as DesktopQueryResult;
      }

      // The RPC's return shape is opaque to Postgres/Supabase codegen; we trust it matches
      // the same contract as fetchDashboardFallback above (that's why the fallback exists).
      const d = data as Record<string, unknown>;
      const bodyData = (d['body'] as BodyMetricRow[]) || [];
      let proteinFloorG = 140;
      if (ntRow?.protein_floor_g != null && Number(ntRow.protein_floor_g) > 0) {
        proteinFloorG = Number(ntRow.protein_floor_g);
      } else if (profileRow?.protein_g_per_kg != null && bodyData.length) {
        const latestWeight = bodyData[bodyData.length - 1]?.weight;
        if (latestWeight) proteinFloorG = Math.round(Number(latestWeight) * Number(profileRow.protein_g_per_kg));
      }
      const sleepTargetH = profileRow?.sleep_target_hours != null && Number(profileRow.sleep_target_hours) > 0
        ? Number(profileRow.sleep_target_hours) : 8.0;

      return {
        oura: (d['oura'] as OuraRow[]) || [],
        nutrition: (d['nutrition'] as NutritionDayRow[]) || [],
        sessions: (d['sessions'] as DesktopSessionRow[]) || [],
        body: bodyData,
        heightCm: profileRow?.height_cm != null ? Number(profileRow.height_cm) : null,
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
        personalTargets: {
          proteinFloorG,
          targetKcal: ntRow?.target_kcal != null ? Number(ntRow.target_kcal) : null,
          sleepTargetH,
        },
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
    personalTargets: null,
  };

  const d = query.data || fallbackData;

  return {
    loading: query.isLoading,
    ...d,
    refresh,
  };
}
