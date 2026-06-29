import { supabase } from './supabase';
import type { Database } from './database.types';
import { invalidateGoalSpineCache } from './goalSpine';
import { unwrap } from './supabaseUtils';

type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

export type ProjectCheckpoint = Database['public']['Tables']['project_checkpoints']['Row'];

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
  const row = unwrap(
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
  return unwrap(
    await supabase
      .from('project_checkpoints')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'dropped')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  );
}

export async function createProjectCheckpoint(
  userId: string,
  fields: { project_id: string; title: string; due_date?: string | null },
): Promise<ProjectCheckpoint> {
  return unwrap(
    await supabase
      .from('project_checkpoints')
      .insert({
        user_id: userId,
        project_id: fields.project_id,
        title: fields.title.trim(),
        due_date: fields.due_date || null,
      })
      .select()
      .single(),
  );
}

export async function updateProjectCheckpoint(
  id: string,
  patch: Partial<Pick<ProjectCheckpoint, 'title' | 'due_date' | 'status' | 'completed_at' | 'sort_order'>>,
): Promise<ProjectCheckpoint> {
  return unwrap(
    await supabase
      .from('project_checkpoints')
      .update(patch)
      .eq('id', id)
      .select()
      .single(),
  );
}

export async function deleteProjectCheckpoint(id: string): Promise<ProjectCheckpoint> {
  return unwrap(
    await supabase
      .from('project_checkpoints')
      .delete()
      .eq('id', id)
      .select()
      .single(),
  );
}
