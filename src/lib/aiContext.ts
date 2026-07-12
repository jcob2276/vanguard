import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';
import {
  currentWeekStart,
  fetchGoalSpine,
  goalSpineAiSnapshot,
  strategicGapsFromSpine,
} from './goal/goalSpine.queries';

/**
 * Lightweight context for the "5 zwycięstw" question generator — only goal-chain
 * KPI gaps and open todos, no biometrics/history/VanguardCore. Avoids re-running
 * the full 16-query gatherUserContext fan-out for a feature that never reads it.
 */
export async function gatherDailyWinsContext(session: Session) {
  if (!session?.user?.id) return "Brak sesji użytkownika.";
  const userId = session.user.id;
  const weekStart = currentWeekStart();

  const settled = await Promise.allSettled([
    fetchGoalSpine(userId, weekStart),
    supabase.from('dreams').select('id, title, life_goal').eq('user_id', userId).eq('is_done', false),
    supabase.from('projects').select('dream_id').eq('user_id', userId).eq('status', 'active').not('dream_id', 'is', null),
    supabase.from('todo_items').select('title, priority, ai_bucket, due_date').eq('user_id', userId).eq('status', 'open').order('priority', { ascending: false }).limit(30),
  ]);
  const [goalSpineRes, dreamsRes, activeDreamProjectsRes, todosRes] = settled;

  const goalSpine = goalSpineRes.status === 'fulfilled' && goalSpineRes.value?.week !== undefined
    ? goalSpineRes.value
    : null;
  const dreamsData = dreamsRes.status === 'fulfilled' ? (dreamsRes.value.data ?? []) : [];
  const activeDreamIds = new Set(
    (activeDreamProjectsRes.status === 'fulfilled' ? (activeDreamProjectsRes.value.data ?? []) : [])
      .map((p: { dream_id?: string | null }) => p.dream_id)
      .filter(Boolean) as string[],
  );
  const todos = todosRes.status === 'fulfilled' ? (todosRes.value.data ?? []) : [];

  return {
    goal_spine: goalSpine ? goalSpineAiSnapshot(goalSpine) : null,
    strategic_gaps: goalSpine ? strategicGapsFromSpine(goalSpine, dreamsData, activeDreamIds) : null,
    open_todos: (todos ?? []).map((t) => ({
      title: t.title,
      priority: t.priority,
      bucket: t.ai_bucket ?? (t.due_date ? 'due:' + t.due_date : 'unclassified'),
    })),
  };
}
