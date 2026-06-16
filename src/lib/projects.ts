import { supabase } from './supabase';
import type { Database } from './database.types';

type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('Data is null');
  return data;
}

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
  return unwrap(
    await supabase
      .from('projects')
      .insert({ user_id: userId, ...fields })
      .select()
      .single(),
  );
}

export async function updateProject(id: string, patch: ProjectUpdate) {
  return unwrap(
    await supabase
      .from('projects')
      .update(patch)
      .eq('id', id)
      .select()
      .single(),
  );
}

export async function deleteProject(id: string) {
  return unwrap(
    await supabase.from('projects').delete().eq('id', id),
  );
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
