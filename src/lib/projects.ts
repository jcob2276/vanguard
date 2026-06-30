import { supabase } from './supabase';
import type { Database } from './database.types';
import { invalidateGoalSpineCache } from './goalSpine';
import { unwrap } from './supabaseUtils';

type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

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
  const row = unwrap(
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
  const { data } = await supabase.from('projects').select('user_id').eq('id', id).maybeSingle();
  const result = unwrap(await supabase.from('projects').delete().eq('id', id));
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
  const row = unwrap<Database['public']['Tables']['todo_items']['Row']>(
    await supabase
      .from('todo_items')
      .insert({
        user_id: userId,
        project_id: fields.project_id,
        title: fields.title.trim(),
        due_date: fields.due_date || null,
        is_milestone: true,
        priority: 'high',
      })
      .select()
      .single(),
  );

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
  const todoRow = unwrap<Database['public']['Tables']['todo_items']['Row']>(
    await supabase
      .from('todo_items')
      .update({
        title: patch.title !== undefined ? patch.title.trim() : undefined,
        due_date: patch.due_date,
        status: patch.status === 'done' ? 'done' : (patch.status === 'pending' || patch.status === 'open') ? 'open' : undefined,
        completed_at: patch.completed_at,
        sort_order: patch.sort_order !== undefined ? patch.sort_order : undefined,
      })
      .eq('id', id)
      .select()
      .single(),
  );

  return {
    id: todoRow.id,
    user_id: todoRow.user_id,
    project_id: todoRow.project_id || '',
    title: todoRow.title,
    due_date: todoRow.due_date,
    status: todoRow.status === 'done' ? 'done' : 'pending',
    completed_at: todoRow.completed_at,
    sort_order: todoRow.sort_order,
    created_at: todoRow.created_at,
    updated_at: todoRow.updated_at,
  };
}

export async function deleteProjectCheckpoint(id: string): Promise<ProjectCheckpoint> {
  const todoRow = unwrap<Database['public']['Tables']['todo_items']['Row']>(
    await supabase
      .from('todo_items')
      .delete()
      .eq('id', id)
      .select()
      .single(),
  );

  return {
    id: todoRow.id,
    user_id: todoRow.user_id,
    project_id: todoRow.project_id || '',
    title: todoRow.title,
    due_date: todoRow.due_date,
    status: todoRow.status === 'done' ? 'done' : 'pending',
    completed_at: todoRow.completed_at,
    sort_order: todoRow.sort_order,
    created_at: todoRow.created_at,
    updated_at: todoRow.updated_at,
  };
}
