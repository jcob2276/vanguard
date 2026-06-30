import { supabase } from './supabase';
import { getDaysAgoWarsaw } from './date';

export type ProjectEvidenceItem = {
  kind: 'win' | 'checkpoint' | 'kpi';
  date: string;
  label: string;
  detail?: string;
};

export async function fetchProjectEvidence(
  userId: string,
  projectId: string,
  days = 7,
): Promise<ProjectEvidenceItem[]> {
  const since = getDaysAgoWarsaw(days);
  const items: ProjectEvidenceItem[] = [];

  const [winsRes, newCpsRes, legacyCpsRes, kpisRes] = await Promise.all([
    supabase
      .from('daily_wins')
      .select('*')
      .eq('user_id', userId)
      .gte('date', since)
      .order('date', { ascending: false }),
    supabase
      .from('todo_items')
      .select('title, completed_at, status')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .eq('is_milestone', true)
      .eq('status', 'done')
      .gte('completed_at', `${since}T00:00:00`)
      .order('completed_at', { ascending: false }),
    supabase
      .from('project_checkpoints')
      .select('title, completed_at, status')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .eq('status', 'done')
      .gte('completed_at', `${since}T00:00:00`)
      .order('completed_at', { ascending: false }),
    supabase.from('goal_kpis').select('id, name').eq('user_id', userId).eq('project_id', projectId),
  ]);

  const cps = [...(newCpsRes.data ?? []), ...(legacyCpsRes.data ?? [])];

  const kpiIds = (kpisRes.data ?? []).map((k) => k.id);
  let snapshots: { recorded_at: string; value: number; kpi_id: string }[] = [];
  if (kpiIds.length > 0) {
    const { data: entries, error: entriesErr } = await supabase
      .from('kpi_entries')
      .select('week_start, value, kpi_id')
      .eq('user_id', userId)
      .in('kpi_id', kpiIds)
      .gte('week_start', since)
      .order('week_start', { ascending: false });

    if (entriesErr) throw entriesErr;
    snapshots = (entries ?? []).map((e) => ({
      recorded_at: e.week_start,
      value: Number(e.value ?? 0),
      kpi_id: e.kpi_id,
    }));
  }

  const kpiNameById = new Map((kpisRes.data ?? []).map((k) => [k.id, k.name ?? 'KPI']));

  for (const row of winsRes.data ?? []) {
    for (let i = 1; i <= 5; i++) {
      const task = row[`task_${i}` as keyof typeof row] as string | null;
      const done = row[`done_${i}` as keyof typeof row] as boolean | null;
      const projId = row[`task_${i}_project_id` as keyof typeof row] as string | null;
      if (!task?.trim() || !done) continue;
      if (projId === projectId) {
        items.push({
          kind: 'win',
          date: row.date ?? since,
          label: task,
          detail: '5 zwycięstw',
        });
      }
    }
  }

  for (const cp of cps) {
    if (!cp.completed_at) continue;
    items.push({
      kind: 'checkpoint',
      date: cp.completed_at.slice(0, 10),
      label: cp.title,
      detail: 'Checkpoint',
    });
  }

  for (const snap of snapshots) {
    items.push({
      kind: 'kpi',
      date: snap.recorded_at.slice(0, 10),
      label: kpiNameById.get(snap.kpi_id) ?? 'KPI',
      detail: String(snap.value),
    });
  }

  return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
}
