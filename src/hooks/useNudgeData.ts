import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getTodayWarsaw } from '../lib/date';
import { getWeekStartWarsaw } from '../lib/growth';

export function useNudgeData(userId: string | undefined) {
  const [reviewOverdueDays, setReviewOverdueDays] = useState<number | null>(null);
  const [urgentTodoCount, setUrgentTodoCount] = useState(0);
  const [unreadLinkCount, setUnreadLinkCount] = useState(0);
  const [staleNoteCount, setStaleNoteCount] = useState(0);
  const [pendingGrowthMustCount, setPendingGrowthMustCount] = useState(0);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const run = async () => {
      try {
        const today = getTodayWarsaw();
        const weekStart = getWeekStartWarsaw(today);
        const staleCutoff = new Date(Date.now() - 30 * 86400000).toISOString();
        const [
          { data: reviews },
          { count: urgentCount },
          { count: unreadCount },
          { count: staleCount },
          { count: growthMustCount },
        ] = await Promise.all([
          supabase.from('weekly_kpi_reviews').select('week_start').eq('user_id', userId).order('week_start', { ascending: false }).limit(1),
          supabase.from('todo_items').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'open').or(`priority.eq.urgent,and(due_date.lte.${today},due_date.not.is.null)`),
          supabase.from('vanguard_links').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'unread'),
          supabase.from('vanguard_notes').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_archived', false).lt('updated_at', staleCutoff),
          supabase
            .from('learning_week_pins')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('week_start', weekStart)
            .eq('slot', 'must')
            .eq('done', false),
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
        if (unreadCount != null) setUnreadLinkCount(unreadCount);
        if (staleCount != null) setStaleNoteCount(staleCount);
        if (growthMustCount != null) setPendingGrowthMustCount(growthMustCount);
      } catch (e) {
        console.error('fetchNudgeData failed', e);
      }
    };
    run();
  }, [userId, key]);

  const refresh = useCallback(() => setKey(k => k + 1), []);

  return { reviewOverdueDays, urgentTodoCount, unreadLinkCount, staleNoteCount, pendingGrowthMustCount, refresh };
}
