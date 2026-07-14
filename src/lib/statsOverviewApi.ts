import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Tables } from './database.types';
import { calculateProjection } from './stats/statsCalculations';
import { bodyTrend } from './health/bodyMetrics';

type BodyMetricRow = Tables<'body_metrics'>;
type ExerciseLogRow = Tables<'exercise_logs'>;
type WorkoutSessionRow = Tables<'workout_sessions'> & { exercise_logs?: ExerciseLogRow[]; duration?: number | string };
type TrendPoint = { cur: number | null; prev: number | null };
type TrendsState = Partial<Record<'weight' | 'waist' | 'readiness' | 'sleep' | 'protein', TrendPoint>>;
type ProjectionResult = { value: string; change: string } | null;
type ProjectionState = Partial<Record<'weight' | 'waist', ProjectionResult>>;

export interface StatsOverviewData {
  bodyData: BodyMetricRow[];
  recentSessions: WorkoutSessionRow[];
  heightCm: number | null;
  trends: TrendsState;
  projections: ProjectionState | null;
}

import { statsOverviewKeys } from './queryKeys';

async function fetchStatsOverview(userId: string): Promise<StatsOverviewData> {
  const [
    { data: body },
    { data: sessions },
    { data: oura },
    { data: profile },
  ] = await Promise.all([
    supabase.from('body_metrics').select('*').eq('user_id', userId).order('date', { ascending: true }),
    supabase.from('workout_sessions').select('*, exercise_logs(*)').eq('user_id', userId).order('date', { ascending: false }),
    supabase.from('oura_daily_summary').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(60),
    supabase.from('nutrition_profile').select('height_cm').eq('user_id', userId).maybeSingle(),
  ]);

  const heightCm = profile?.height_cm != null ? Number(profile.height_cm) : null;

  const recentSessions = (sessions ?? []).map(s => ({
    ...s,
    duration: s.start_time && s.end_time ? Math.round((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000) : '--',
  }));

  const trends: TrendsState = {};
  const ouraRaw = oura || [];
  const bodyData = body ?? [];

  if (bodyData.length >= 2) {
    const weightTrend = bodyTrend(bodyData, 'weight');
    const waistTrend = bodyTrend(bodyData, 'waist');
    if (weightTrend) trends.weight = weightTrend;
    if (waistTrend) trends.waist = waistTrend;
  }
  if (ouraRaw.length >= 2) {
    trends.readiness = { cur: ouraRaw[0].readiness_score, prev: ouraRaw[1].readiness_score };
    trends.sleep = { cur: ouraRaw[0].total_sleep_hours, prev: ouraRaw[1].total_sleep_hours };
  }

  const projections: ProjectionState | null = bodyData.length >= 3
    ? { weight: calculateProjection(bodyData, 'weight'), waist: calculateProjection(bodyData, 'waist') }
    : null;

  return { bodyData, recentSessions, heightCm, trends, projections };
}

export function useStatsOverviewQuery(userId: string | undefined) {
  return useQuery({
    queryKey: statsOverviewKeys.forUser(userId || ''),
    queryFn: () => fetchStatsOverview(userId as string),
    enabled: !!userId,
  });
}
