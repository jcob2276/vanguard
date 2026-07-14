import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { fetchLatestCompletedWeeklyReviewDate } from './goal/goalSpine';
import { getTodayWarsaw } from './date';
import { getWeekStartWarsaw } from './growth/growth';

export interface NudgeCounts {
  reviewOverdueDays: number | null;
  urgentTodoCount: number;
  unreadLinkCount: number;
  staleNoteCount: number;
  pendingGrowthMustCount: number;
}

import { nudgeKeys } from './queryKeys';

// ── QUERIES ──

async function fetchNudgeCounts(userId: string): Promise<NudgeCounts> {
  const today = getTodayWarsaw();
  const weekStart = getWeekStartWarsaw(today);
  const staleCutoff = new Date(Date.now() - 30 * 86400000).toISOString();

  const [
    lastReviewCompletedAt,
    { count: urgentCount },
    { count: unreadCount },
    { count: staleCount },
    { count: growthMustCount },
  ] = await Promise.all([
    fetchLatestCompletedWeeklyReviewDate(userId),
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

  let reviewOverdueDays: number;
  if (lastReviewCompletedAt) {
    const d1 = new Date(today + 'T12:00:00Z');
    const d2 = new Date(lastReviewCompletedAt);
    reviewOverdueDays = Math.round((d1.getTime() - d2.getTime()) / 86400000);
  } else {
    reviewOverdueDays = 999;
  }

  return {
    reviewOverdueDays,
    urgentTodoCount: urgentCount ?? 0,
    unreadLinkCount: unreadCount ?? 0,
    staleNoteCount: staleCount ?? 0,
    pendingGrowthMustCount: growthMustCount ?? 0,
  };
}

export function useNudgeCounts(userId: string | undefined) {
  return useQuery({
    queryKey: nudgeKeys.counts(userId || ''),
    queryFn: () => fetchNudgeCounts(userId as string),
    enabled: !!userId,
  });
}
