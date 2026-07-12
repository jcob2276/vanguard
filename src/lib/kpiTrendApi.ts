import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { getPastWeekStarts } from './date';

export interface KpiSnapshot {
  recorded_at: string;
  value: number;
}

const kpiTrendKeys = {
  all: ['kpiTrend'] as const,
  history: (userId: string, kpiId: string, currentWeekStart: string) =>
    [...kpiTrendKeys.all, userId, kpiId, currentWeekStart] as const,
};

async function fetchKpiHistory(userId: string, kpiId: string, currentWeekStart: string): Promise<KpiSnapshot[]> {
  const lastWeeks = getPastWeekStarts(currentWeekStart, 8);
  const { data: entries, error } = await supabase
    .from('kpi_entries')
    .select('week_start, value')
    .eq('user_id', userId)
    .eq('kpi_id', kpiId)
    .in('week_start', lastWeeks)
    .order('week_start', { ascending: true });

  if (error) {
    console.error('[KpiTrendSparkline] failed to fetch entries', error);
    return [];
  }

  return (entries ?? []).map((e) => ({
    recorded_at: e.week_start,
    value: Number(e.value ?? 0),
  }));
}

export function useKpiHistoryQuery(userId: string, kpiId: string, currentWeekStart: string) {
  return useQuery({
    queryKey: kpiTrendKeys.history(userId, kpiId, currentWeekStart),
    queryFn: () => fetchKpiHistory(userId, kpiId, currentWeekStart),
    enabled: !!userId && !!kpiId,
  });
}

export function useIncrementKpiMutation(userId: string, kpiId: string, currentWeekStart: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (next: number) => {
      const { error: incErr } = await supabase.rpc('increment_kpi_entry_for_week', {
        p_kpi_id: kpiId,
        p_week_start: currentWeekStart,
        p_delta: 1,
      });

      if (incErr) {
        // Fallback: direct upsert if the atomic RPC fails
        const { error: upsertErr } = await supabase
          .from('kpi_entries')
          .upsert(
            { user_id: userId, kpi_id: kpiId, week_start: currentWeekStart, value: next },
            { onConflict: 'kpi_id,week_start' },
          );
        if (upsertErr) throw upsertErr;
      }
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData<KpiSnapshot[]>(
        kpiTrendKeys.history(userId, kpiId, currentWeekStart),
        (prev = []) => {
          const copy = [...prev];
          if (copy.length > 0 && copy[copy.length - 1].recorded_at === currentWeekStart) {
            copy[copy.length - 1] = { ...copy[copy.length - 1], value: next };
            return copy;
          }
          return [...copy, { recorded_at: currentWeekStart, value: next }];
        },
      );
    },
  });
}
