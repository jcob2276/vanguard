import { supabase } from './supabase';
import { listTodoSections } from './todo';
import { listProjects } from './projects';

export interface SectionGoalMaps {
  sectionGoalMap: Record<string, string>;
  sectionDreamMap: Record<string, string>;
}

/** Pure section->project->dream chain, factored out so Todo and Calendar render the same goal chip from the same data. */
export function buildSectionGoalMaps(
  sections: Array<{ id: string; project_id: string | null }>,
  projects: Array<{ id: string; dream_id: string | null }>,
  dreams: Array<{ id: string; title: string; life_goal: string | null }>,
): SectionGoalMaps {
  const sectionGoalMap: Record<string, string> = {};
  const sectionDreamMap: Record<string, string> = {};
  for (const sec of sections) {
    if (!sec.project_id) continue;
    const proj = projects.find((p) => p.id === sec.project_id);
    if (!proj || !proj.dream_id) continue;
    const dream = dreams.find((d) => d.id === proj.dream_id);
    if (!dream) continue;
    if (dream.life_goal) sectionGoalMap[sec.id] = dream.life_goal;
    if (dream.title) sectionDreamMap[sec.id] = dream.title;
  }
  return { sectionGoalMap, sectionDreamMap };
}

export async function fetchGoalLineage(userId: string): Promise<SectionGoalMaps> {
  const [sections, projects, { data: dreams }] = await Promise.all([
    listTodoSections(userId),
    listProjects(userId),
    supabase.from('dreams').select('id, title, life_goal').eq('user_id', userId),
  ]);
  return buildSectionGoalMaps(sections, projects as any, (dreams as any) || []);
}
