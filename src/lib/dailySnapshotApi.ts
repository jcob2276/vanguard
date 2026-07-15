import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { shiftDateStr } from './date';

interface DailySnapshot {
  mode?: string;
  one_clear_move?: string;
  top3?: string[];
  tension_action?: { action?: string };
  day_score?: number | null;
  date?: string;
  [key: string]: unknown;
}

export interface DailySnapshotData {
  snap: DailySnapshot | null;
  dayScore: number | null;
  strainState: { daily_status: string | null; main_limiter: string | null } | null;
  midday: { status: string | null; blocker: string | null } | null;
  rescueStreak: number;
}

const dailySnapshotKeys = {
  all: ['dailySnapshot'] as const,
  forUser: (userId: string, today: string) => [...dailySnapshotKeys.all, userId, today] as const,
};

async function fetchDailySnapshot(userId: string, today: string): Promise<DailySnapshotData> {
  const yesterday = shiftDateStr(today, -1);
  const ago14 = shiftDateStr(today, -14);

  const [recRes, strainRes, historyRes] = await Promise.all([
    supabase
      .from('daily_reconciliations')
      .select('date, planning_summary, day_score, midday_status, midday_blocker')
      .eq('user_id', userId)
      .in('date', [today, yesterday])
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('daily_strain')
      .select('date, daily_status, main_limiter')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle(),
    supabase
      .from('daily_reconciliations')
      .select('date, planning_summary')
      .eq('user_id', userId)
      .gte('date', ago14)
      .order('date', { ascending: false }),
  ]);

  const rec = recRes.data;
  const strain = strainRes.data;
  const history = historyRes.data;

  const snap = rec?.planning_summary
    ? { ...(rec.planning_summary as Record<string, unknown>), day_score: rec.day_score, date: rec.date }
    : null;
  const dayScore = rec?.day_score ?? null;
  const strainState = strain ? { daily_status: strain.daily_status, main_limiter: strain.main_limiter } : null;
  const midday = (rec?.midday_status || rec?.midday_blocker)
    ? { status: rec.midday_status, blocker: rec.midday_blocker }
    : null;

  let rescueStreak = 0;
  for (const row of history ?? []) {
    const mode = (row.planning_summary as { mode?: string })?.mode;
    if (mode === 'rescue') rescueStreak++;
    else break;
  }

  return { snap, dayScore, strainState, midday, rescueStreak };
}

export function useDailySnapshotQuery(userId: string | undefined, today: string) {
  return useQuery({
    queryKey: dailySnapshotKeys.forUser(userId || '', today),
    queryFn: () => fetchDailySnapshot(userId as string, today),
    enabled: !!userId,
  });
}

export function useSaveDayScoreMutation(userId: string | undefined, today: string) {
  const queryClient = useQueryClient();
  const queryKey = dailySnapshotKeys.forUser(userId || '', today);

  return useMutation({
    mutationFn: async (score: number) => {
      if (!userId) throw new Error('Missing userId');
      const { error } = await supabase.from('daily_reconciliations').upsert(
        { user_id: userId, date: today, status: 'answered', mode: 'checkin', day_score: score },
        { onConflict: 'user_id,date', ignoreDuplicates: false },
      );
      if (error) throw error;
      return score;
    },
    onMutate: async (score) => {
      if (!userId) return;
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<DailySnapshotData>(queryKey);
      queryClient.setQueryData<DailySnapshotData | undefined>(
        queryKey,
        (prev) => (prev ? { ...prev, dayScore: score } : prev),
      );
      return { previous };
    },
    onError: (err, _score, context) => {
      console.warn('[DailySnapshotCard] saveScore failed:', err instanceof Error ? err.message : err);
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
  });
}
