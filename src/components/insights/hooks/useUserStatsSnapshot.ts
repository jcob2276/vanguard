import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { getTodayWarsaw, shiftDateStr } from '../../../lib/date';

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

export function useUserStatsSnapshot(userId: string | undefined) {
  const [data, setData] = useState<UserStatsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const uid = userId;

    async function load() {
      setLoading(true);
      try {
        const [streamRes, todosRes] = await Promise.all([
          supabase
            .from('vanguard_stream')
            .select('id, created_at')
            .eq('user_id', uid)
            .order('created_at', { ascending: false })
            .limit(1000),
          supabase
            .from('todo_items')
            .select('id, completed_at')
            .eq('user_id', uid)
            .not('completed_at', 'is', null),
        ]);

        const streamRows = streamRes.data ?? [];
        const todoRows = todosRes.data ?? [];

        // Aggregate by date
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
        const totalCards = 0; // knowledge_insight_cards not tracked per day yet
        const totalCompletedTodos = todoRows.length;

        // streak
        let currentStreakDays = 0;
        const today = getTodayWarsaw();
        let check = today;
        while (byDate[check]) {
          currentStreakDays++;
          check = shiftDateStr(check, -1);
        }

        setData({ totalInputs, totalCards, totalCompletedTodos, activeDays, currentStreakDays, daily });
      } catch (e: unknown) {
      console.warn('[useUserStatsSnapshot] Failed to load user stats snapshot:', e);
    } finally {
        setLoading(false);
      }
    }

    load();
  }, [userId]);

  return { data, loading };
}
