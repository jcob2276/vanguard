import { differenceInDays } from 'date-fns';
import { formatWarsawDate, getTodayWarsaw, nowWarsaw } from './date';
import { supabase } from './supabase';

export type EnrichedCheckpoint = {
  id: string;
  project_id: string;
  title: string;
  due_date: string;
  status: string;
  project: {
    id: string;
    name: string;
    color: string | null;
    pillar: 'cialo' | 'duch' | 'konto' | null;
  };
  daysLate: number;
  daysLeft: number;
  isOverdue: boolean;
};

export async function fetchUpcomingCheckpoints(
  userId: string,
  horizonDays = 14,
): Promise<EnrichedCheckpoint[]> {
  const todayStr = getTodayWarsaw();
  const horizon = nowWarsaw();
  horizon.setDate(horizon.getDate() + horizonDays);
  const horizonStr = formatWarsawDate(horizon);

  const [{ data: cps }, { data: projs }, { data: dreams }] = await Promise.all([
    supabase
      .from('todo_items')
      .select('id, project_id, title, due_date, status')
      .eq('user_id', userId)
      .eq('is_milestone', true)
      .in('status', ['pending', 'open'])
      .lte('due_date', horizonStr)
      .order('due_date', { ascending: true }),
    supabase.from('projects').select('id, name, color, dream_id').eq('user_id', userId).eq('status', 'active'),
    supabase.from('dreams').select('id, life_goal').eq('user_id', userId),
  ]);

  if (!cps || !projs) return [];

  const dreamById: Record<string, { life_goal: string | null }> = {};
  (dreams ?? []).forEach((d) => {
    dreamById[d.id] = d;
  });

  const projMap: Record<string, EnrichedCheckpoint['project']> = {};
  projs.forEach((p) => {
    projMap[p.id] = {
      id: p.id,
      name: p.name,
      color: p.color,
      pillar: (p.dream_id ? dreamById[p.dream_id]?.life_goal : null) as EnrichedCheckpoint['project']['pillar'],
    };
  });

  return cps
    .map((cp) => {
      if (!cp.project_id) return null;
      const project = projMap[cp.project_id];
      if (!project || !cp.due_date) return null;
      const daysLeft = differenceInDays(new Date(cp.due_date), new Date(todayStr));
      const isOverdue = daysLeft < 0;
      return {
        id: cp.id,
        project_id: cp.project_id,
        title: cp.title,
        due_date: cp.due_date,
        status: cp.status,
        project,
        daysLeft: Math.max(0, daysLeft),
        daysLate: isOverdue ? Math.abs(daysLeft) : 0,
        isOverdue,
      };
    })
    .filter((cp): cp is EnrichedCheckpoint => cp != null);
}

export async function markCheckpointDone(checkpointId: string): Promise<void> {
  // Try to update todo_items first
  const { data: todoUpdated, error: todoError } = await supabase
    .from('todo_items')
    .update({ status: 'done', completed_at: nowWarsaw().toISOString() })
    .eq('id', checkpointId)
    .select('id')
    .maybeSingle();

  if (todoError) throw new Error(todoError.message);

  // Fallback to legacy project_checkpoints if not found in todo_items
  if (!todoUpdated) {
    const { error: cpError } = await supabase
      .from('project_checkpoints')
      .update({ status: 'done', completed_at: nowWarsaw().toISOString() })
      .eq('id', checkpointId);
    if (cpError) throw new Error(cpError.message);
  }
}
