import { getTodayWarsaw } from '../date';
import { supabase } from '../supabase';
import type {
  WeeklyReviewRow,
  GoalSpine,
  GoalKpiRow,
  ProjectWeekKpi,
} from './goalSpine.types';
import { queryClient } from '../queryClient';
import { goalSpineKeys } from '../queryKeys';
import { currentWeekStart } from './goalSpine.derive';
import {
  loadMonthlySlice,
  fetchWeekGoals,
  fetchSprintContext,
  fetchLongTermGoals,
  fetchSprintReview,
} from './goalSpine.loaders';

export * from './goalSpine.derive';
export * from './goalSpine.loaders';

export async function fetchWeeklyReviewFull(
  userId: string,
  weekStart: string,
): Promise<WeeklyReviewRow | null> {
  return queryClient.fetchQuery({
    queryKey: goalSpineKeys.review(userId, weekStart),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_reviews')
        .select('*')
        .eq('user_id', userId)
        .eq('week_start', weekStart)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export async function fetchLatestCompletedWeeklyReviewDate(userId: string): Promise<string | null> {
  return queryClient.fetchQuery({
    queryKey: goalSpineKeys.reviewLatestCompletedDate(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_reviews')
        .select('review_completed_at')
        .eq('user_id', userId)
        .not('review_completed_at', 'is', null)
        .order('review_completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.review_completed_at ?? null;
    },
  });
}

export async function fetchGoalSpine(
  userId: string,
  weekStart: string = currentWeekStart(),
  today?: string,
): Promise<GoalSpine> {
  const currentToday = today ?? getTodayWarsaw();
  return queryClient.fetchQuery({
    queryKey: goalSpineKeys.full(userId, weekStart, currentToday),
    queryFn: async () => {
      const [week, sprint, longTerm, sprintReview, month] = await Promise.all([
        fetchWeekGoals(userId, weekStart),
        fetchSprintContext(userId),
        fetchLongTermGoals(userId),
        fetchSprintReview(userId),
        loadMonthlySlice(userId, today),
      ]);
      return { weekStart, sprint, month, week, longTerm, sprintReview };
    },
  });
}

export async function fetchProjectWeekKpis(
  userId: string,
  projectIds: string[],
  weekStart: string,
): Promise<Record<string, ProjectWeekKpi[]>> {
  if (projectIds.length === 0) return {};
  const sortedIds = projectIds.slice().sort();
  return queryClient.fetchQuery({
    queryKey: goalSpineKeys.projectKpis(userId, weekStart, sortedIds),
    queryFn: async () => {
      const { data: kpis, error: kpiErr } = await supabase
        .from('goal_kpis')
        .select('*')
        .eq('user_id', userId)
        .in('project_id', projectIds);
      if (kpiErr) throw kpiErr;

      const kpiIds = (kpis ?? []).map((k) => k.id);
      let entries: { kpi_id: string; value: number | null }[] = [];
      if (kpiIds.length > 0) {
        const { data, error } = await supabase
          .from('kpi_entries')
          .select('kpi_id, value')
          .eq('user_id', userId)
          .eq('week_start', weekStart)
          .in('kpi_id', kpiIds);
        if (error) throw error;
        entries = data ?? [];
      }
      const valueByKpi = new Map(entries.map((e) => [e.kpi_id, e.value]));

      const byProject: Record<string, ProjectWeekKpi[]> = {};
      for (const kpi of (kpis ?? []) as GoalKpiRow[]) {
        if (!kpi.project_id) continue;
        (byProject[kpi.project_id] ??= []).push({ kpi, thisWeekValue: valueByKpi.get(kpi.id) ?? null });
      }
      return byProject;
    },
  });
}

export async function fetchKpisForProject(userId: string, projectId: string): Promise<GoalKpiRow[]> {
  return queryClient.fetchQuery({
    queryKey: goalSpineKeys.projectKpisFor(userId, projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goal_kpis')
        .select('*')
        .eq('user_id', userId)
        .eq('project_id', projectId);
      if (error) throw error;
      return (data ?? []) as GoalKpiRow[];
    },
  });
}

const invalidateListeners = new Set<() => void>();

export function invalidateGoalSpineCache(userId: string): void {
  void queryClient.invalidateQueries({ queryKey: goalSpineKeys.forUser(userId) });
  invalidateListeners.forEach((fn) => fn());
}

export function onGoalSpineInvalidated(listener: () => void): () => void {
  invalidateListeners.add(listener);
  return () => invalidateListeners.delete(listener);
}
