import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_SKILL_TREE } from './growthSkills';

/** Wstaw domyślne drzewo skilli (parent + subskills) dla użytkownika. */
export async function insertDefaultSkillTree(supabase: SupabaseClient, userId: string) {
  for (let i = 0; i < DEFAULT_SKILL_TREE.length; i++) {
    const node = DEFAULT_SKILL_TREE[i];
    const { data: parent, error: parentErr } = await supabase
      .from('learning_skills')
      .upsert({
        user_id: userId,
        key: node.key,
        label: node.label,
        sort_order: i,
        active: true,
        parent_id: null,
      }, { onConflict: 'user_id,key' })
      .select('id')
      .single();

    if (parentErr) throw parentErr;
    if (!parent?.id || node.subskills.length === 0) continue;

    const { error: subErr } = await supabase.from('learning_skills').upsert(
      node.subskills.map((sub, j) => ({
        user_id: userId,
        key: sub.key,
        label: sub.label,
        sort_order: j,
        active: true,
        parent_id: parent.id,
      })),
      { onConflict: 'user_id,key' }
    );
    if (subErr) throw subErr;
  }
}

/** Dezaktywuje wszystkie skilli usera i wstawia świeże drzewo. */
