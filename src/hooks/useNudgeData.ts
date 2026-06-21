import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getTodayWarsaw } from '../lib/date';

export function useNudgeData(userId: string | undefined) {
  const [reviewOverdueDays, setReviewOverdueDays] = useState<number | null>(null);
  const [urgentTodoCount, setUrgentTodoCount] = useState(0);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const run = async () => {
      try {
        const today = getTodayWarsaw();
        const [{ data: reviews }, { count: urgentCount }] = await Promise.all([
          supabase.from('weekly_kpi_reviews').select('week_start').eq('user_id', userId).order('week_start', { ascending: false }).limit(1),
          supabase.from('todo_items').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'open').or(`priority.eq.urgent,and(due_date.lte.${today},due_date.not.is.null)`),
        ]);
        if (reviews) {
          if ((reviews as any[]).length > 0) {
            const lastDay = (reviews as any[])[0].week_start as string;
            const d1 = new Date(today + 'T12:00:00Z');
            const d2 = new Date(lastDay + 'T12:00:00Z');
            setReviewOverdueDays(Math.round((d1.getTime() - d2.getTime()) / 86400000));
          } else {
            setReviewOverdueDays(999);
          }
        }
        if (urgentCount != null) setUrgentTodoCount(urgentCount);
      } catch (e) {
        console.error('fetchNudgeData failed', e);
      }
    };
    run();
  }, [userId, key]);

  const refresh = useCallback(() => setKey(k => k + 1), []);

  return { reviewOverdueDays, urgentTodoCount, refresh };
}
