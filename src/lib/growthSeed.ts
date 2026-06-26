import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_SKILL_TREE } from './growthSkills';

/** Wstaw domyślne drzewo skilli (parent + subskills) dla użytkownika. */
export async function insertDefaultSkillTree(supabase: SupabaseClient, userId: string) {
  for (let i = 0; i < DEFAULT_SKILL_TREE.length; i++) {
    const node = DEFAULT_SKILL_TREE[i];
    const { data: parent, error: parentErr } = await supabase
      .from('learning_skills')
      .insert({
        user_id: userId,
        key: node.key,
        label: node.label,
        sort_order: i,
        active: true,
        parent_id: null,
      })
      .select('id')
      .single();

    if (parentErr) throw parentErr;
    if (!parent?.id || node.subskills.length === 0) continue;

    const { error: subErr } = await supabase.from('learning_skills').insert(
      node.subskills.map((sub, j) => ({
        user_id: userId,
        key: sub.key,
        label: sub.label,
        sort_order: j,
        active: true,
        parent_id: parent.id,
      })),
    );
    if (subErr) throw subErr;
  }
}

/** Dezaktywuje wszystkie skilli usera i wstawia świeże drzewo. */
export async function restoreDefaultSkillTree(supabase: SupabaseClient, userId: string) {
  await supabase.from('learning_skills').update({ active: false }).eq('user_id', userId);
  await insertDefaultSkillTree(supabase, userId);
}
