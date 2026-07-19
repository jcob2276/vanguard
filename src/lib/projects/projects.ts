import { supabase } from '../supabase';
import type { Database } from '../database.types';
import { invalidateGoalSpineCache } from '../goal/goalSpine.queries';
import { unwrap, unwrapMaybe } from '../supabaseUtils';
import { createTodoItem, updateTodoItem, deleteTodoItem } from '../todo/todo';

type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

export type ProjectCheckpoint = {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  due_date: string | null;
  status: string;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export async function listProjects(userId: string) {
  return unwrap(
    await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  );
}

export async function createProject(userId: string, fields: Omit<ProjectInsert, 'user_id'>) {
  const row = unwrap<Database['public']['Tables']['projects']['Row']>(
    await supabase
      .from('projects')
      .insert({ user_id: userId, ...fields })
      .select()
      .single(),
  );
  invalidateGoalSpineCache(userId);
  return row;
}

export async function updateProject(id: string, patch: ProjectUpdate) {
  const row = unwrap<Database['public']['Tables']['projects']['Row']>(
    await supabase
      .from('projects')
      .update(patch)
      .eq('id', id)
      .select()
      .single(),
  );
  if (row.user_id) invalidateGoalSpineCache(row.user_id);
  return row;
}

export async function deleteProject(id: string) {
  const data = unwrapMaybe<{ user_id: string | null }>(await supabase.from('projects').select('user_id').eq('id', id).maybeSingle());
  const result = unwrapMaybe(await supabase.from('projects').delete().eq('id', id));
  if (data?.user_id) invalidateGoalSpineCache(data.user_id);
  return result;
}

export async function linkSectionToProject(sectionId: string, projectId: string | null) {
  return unwrap(
    await supabase
      .from('todo_sections')
      .update({ project_id: projectId })
      .eq('id', sectionId)
      .select()
      .single(),
  );
}

export async function listProjectCheckpoints(userId: string): Promise<ProjectCheckpoint[]> {
  const { data: todos } = await supabase
    .from('todo_items')
    .select('*')
    .eq('user_id', userId)
    .eq('is_milestone', true)
    .neq('status', 'dropped');

  const merged: ProjectCheckpoint[] = (todos ?? []).map((t) => ({
    id: t.id,
    user_id: t.user_id,
    project_id: t.project_id || '',
    title: t.title,
    due_date: t.due_date,
    status: t.status === 'done' ? 'done' : 'pending',
    completed_at: t.completed_at,
    sort_order: t.sort_order,
    created_at: t.created_at,
    updated_at: t.updated_at,
  }));

  merged.sort((a, b) => {
    if (a.due_date && b.due_date) {
      return a.due_date.localeCompare(b.due_date);
    }
    if (a.due_date) return 1;
    if (b.due_date) return -1;

    const sortA = a.sort_order ?? 0;
    const sortB = b.sort_order ?? 0;
    if (sortA !== sortB) return sortA - sortB;

    return a.created_at.localeCompare(b.created_at);
  });

  return merged;
}

export async function createProjectCheckpoint(
  userId: string,
  fields: { project_id: string; title: string; due_date?: string | null },
): Promise<ProjectCheckpoint> {
  const row = await createTodoItem(userId, {
    project_id: fields.project_id,
    title: fields.title,
    due_date: fields.due_date || undefined,
    is_milestone: true,
    priority: 'high',
  });

  return {
    id: row.id,
    user_id: row.user_id,
    project_id: row.project_id || '',
    title: row.title,
    due_date: row.due_date,
    status: row.status === 'done' ? 'done' : 'pending',
    completed_at: row.completed_at,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function updateProjectCheckpoint(
  id: string,
  patch: Partial<Pick<ProjectCheckpoint, 'title' | 'due_date' | 'status' | 'completed_at' | 'sort_order'>>,
): Promise<ProjectCheckpoint> {
  const todoRow = await updateTodoItem(id, {
    title: patch.title !== undefined ? patch.title.trim() : undefined,
    due_date: patch.due_date,
    status: patch.status === 'done' ? 'done' : (patch.status === 'pending' || patch.status === 'open') ? 'open' : undefined,
    completed_at: patch.completed_at,
    sort_order: patch.sort_order !== undefined ? patch.sort_order : undefined,
  });

  return {
    id: todoRow?.id || id,
    user_id: todoRow?.user_id || '',
    project_id: todoRow?.project_id || '',
    title: todoRow?.title || patch.title || '',
    due_date: todoRow?.due_date || patch.due_date || null,
    status: todoRow?.status === 'done' ? 'done' : 'pending',
    completed_at: todoRow?.completed_at || patch.completed_at || null,
    sort_order: todoRow?.sort_order ?? patch.sort_order ?? 999,
    created_at: todoRow?.created_at || new Date().toISOString(),
    updated_at: todoRow?.updated_at || new Date().toISOString(),
  };
}

export async function deleteProjectCheckpoint(id: string): Promise<ProjectCheckpoint> {
  const { data: row } = await supabase
    .from('todo_items')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  await deleteTodoItem(id);

  const fallbackRow = row || {
    id,
    user_id: '',
    project_id: '',
    title: '',
    due_date: null,
    status: 'dropped',
    completed_at: null,
    sort_order: 999,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return {
    id: fallbackRow.id,
    user_id: fallbackRow.user_id,
    project_id: fallbackRow.project_id || '',
    title: fallbackRow.title,
    due_date: fallbackRow.due_date,
    status: fallbackRow.status === 'done' ? 'done' : 'pending',
    completed_at: fallbackRow.completed_at,
    sort_order: fallbackRow.sort_order,
    created_at: fallbackRow.created_at,
    updated_at: fallbackRow.updated_at,
  };
}

export async function listDreams(userId: string) {
  const { data, error } = await supabase
    .from('dreams')
    .select('id, title, category, life_goal')
    .eq('user_id', userId);
  if (error) throw error;
  return data || [];
}

export async function listActiveParentLearningSkills(userId: string) {
  const { data, error } = await supabase
    .from('learning_skills')
    .select('id, label')
    .eq('user_id', userId)
    .eq('active', true)
    .is('parent_id', null)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function listGoalKpis(userId: string) {
  const { data, error } = await supabase
    .from('goal_kpis')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function upsertKpiEntry(userId: string, kpiId: string, weekStart: string, value: number): Promise<void> {
  const { error } = await supabase
    .from('kpi_entries')
    .upsert(
      { user_id: userId, kpi_id: kpiId, week_start: weekStart, value },
      { onConflict: 'kpi_id,week_start' }
    );
  if (error) throw error;
}

export async function createGoalKpi(
  userId: string,
  projectId: string,
  pillar: string,
  name: string,
  unit: string,
  target: number | null,
  sortOrder: number
): Promise<void> {
  const { error } = await supabase.from('goal_kpis').insert({
    user_id: userId,
    project_id: projectId,
    pillar,
    name,
    unit,
    target,
    higher_is_better: true,
    sort_order: sortOrder,
  });
  if (error) throw error;
}

