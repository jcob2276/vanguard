import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getTodayWarsaw } from '../lib/date';
import type { Session } from '@supabase/supabase-js';

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

export function useUserStatsSnapshot(session: Session) {
  const [data, setData] = useState<UserStatsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;

    async function load() {
      setLoading(true);
      try {
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
          const [y, m, d] = check.split('-').map(Number);
          const prev = new Date(Date.UTC(y, m - 1, d));
          prev.setUTCDate(prev.getUTCDate() - 1);
          check = prev.toISOString().split('T')[0];
        }

        setData({ totalInputs, totalCards, totalCompletedTodos, activeDays, currentStreakDays, daily });
      } catch (e: unknown) {
      console.error('[Background Error]', e);
    } finally {
        setLoading(false);
      }
    }

    load();
  }, [session?.user?.id]);

  return { data, loading };
}
