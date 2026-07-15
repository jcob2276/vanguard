import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { getTodayWarsaw, shiftDateStr } from '../../../lib/date';
import { userStatsKeys } from '../../../lib/queryKeys';

interface DailyStatPoint {
  date: string;
  inputs: number;
  cards: number;
  completedTodos: number;
}

export interface UserStatsSnapshot {
  totalInputs: number;
  totalCards: number;
  totalCompletedTodos: number;
  activeDays: number;
  currentStreakDays: number;
  daily: DailyStatPoint[];
}

async function fetchUserStatsSnapshot(userId: string): Promise<UserStatsSnapshot> {
  const [streamRes, todosRes] = await Promise.all([
    supabase
      .from('vanguard_stream')
      .select('id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('todo_items')
      .select('id, completed_at')
      .eq('user_id', userId)
      .not('completed_at', 'is', null),
  ]);

  const streamRows = streamRes.data ?? [];
  const todoRows = todosRes.data ?? [];

  const byDate: Record<string, DailyStatPoint> = {};
  for (const row of streamRows) {
    const d = (row.created_at ?? '').substring(0, 10);
    if (!d) continue;
    if (!byDate[d]) byDate[d] = { date: d, inputs: 0, cards: 0, completedTodos: 0 };
    byDate[d].inputs++;
  }
  for (const row of todoRows) {
    const d = (row.completed_at ?? '').substring(0, 10);
    if (!d) continue;
    if (!byDate[d]) byDate[d] = { date: d, inputs: 0, cards: 0, completedTodos: 0 };
    byDate[d].completedTodos++;
  }

  const daily = Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  const activeDays = Object.keys(byDate).length;
  const totalInputs = streamRows.length;
  const totalCards = 0;
  const totalCompletedTodos = todoRows.length;

  let currentStreakDays = 0;
  const today = getTodayWarsaw();
  let check = today;
  while (byDate[check]) {
    currentStreakDays++;
    check = shiftDateStr(check, -1);
  }

  return { totalInputs, totalCards, totalCompletedTodos, activeDays, currentStreakDays, daily };
}

export function useUserStatsSnapshot(userId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: userStatsKeys.snapshot(userId ?? ''),
    queryFn: () => fetchUserStatsSnapshot(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  return { data: data ?? null, loading: isLoading };
}
