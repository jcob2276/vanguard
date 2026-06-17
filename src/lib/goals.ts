import { supabase } from './supabase';
import { unwrap } from './supabaseUtils';

export type Goal = {
  id: string;
  user_id: string;
  dream_id: string | null;
  title: string;
  pillar: string | null;
  description: string | null;
  target_date: string | null;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export async function listGoals(userId: string): Promise<Goal[]> {
  const { data } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function createGoal(
  userId: string,
  fields: { title: string; dream_id?: string | null; pillar?: string | null; description?: string | null; target_date?: string | null },
): Promise<Goal> {
  return unwrap(
    await supabase
      .from('goals')
      .insert({ user_id: userId, title: fields.title.trim(), dream_id: fields.dream_id || null, pillar: fields.pillar || null, description: fields.description || null, target_date: fields.target_date || null })
      .select()
      .single(),
  );
}

export async function deleteGoal(id: string): Promise<void> {
  await supabase.from('goals').delete().eq('id', id);
}
