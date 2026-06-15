import { supabase } from './supabase';

function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
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

export async function createProject(userId: string, fields: {
  name: string;
  goal?: string;
  deadline?: string;
  color?: string;
}) {
  return unwrap(
    await supabase
      .from('projects')
      .insert({ user_id: userId, ...fields })
      .select()
      .single(),
  );
}

export async function updateProject(id: string, patch: Record<string, unknown>) {
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
