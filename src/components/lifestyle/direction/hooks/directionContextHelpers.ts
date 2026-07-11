/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  DirectionMustPin,
  DirectionUrgentTodo,
  DirectionProjectSummary,
  DirectionFocus,
} from '../../../../lib/dailyPlanProposal';

export function resolvePinTitle(
  pin: {
    entity_type: string;
    entity_id: string | null;
    manual_title: string | null;
  },
  links: Map<string, { title: string | null }>,
  todos: Map<string, { title: string }>
): string {
  if (pin.manual_title?.trim()) return pin.manual_title.trim();
  if (pin.entity_type === 'link' && pin.entity_id) {
    return links.get(pin.entity_id)?.title?.trim() || 'Link z Keep';
  }
  if (pin.entity_type === 'todo' && pin.entity_id) {
    return todos.get(pin.entity_id)?.title?.trim() || 'Zadanie';
  }
  return 'MUST tygodnia';
}

export function mapMustPins(
  pins: any[],
  linksMap: Map<string, any>,
  todosMap: Map<string, any>
): DirectionMustPin[] {
  return pins.map((p) => ({
    id: p.id,
    title: resolvePinTitle(p, linksMap, todosMap),
    projectId: p.project_id,
    done: !!p.done,
    slot: p.slot as 'must' | 'active',
  }));
}

export function mapUrgentTodos(
  todos: any[],
  sectionProject: Map<string, string | null>,
  projectsData: any[]
): DirectionUrgentTodo[] {
  return todos
    .filter((t) => t.priority === 'urgent' || t.priority === 'high')
    .map((t) => {
      const projectId = t.section_id ? sectionProject.get(t.section_id) ?? null : null;
      const project = projectsData.find((p) => p.id === projectId);
      return {
        id: t.id,
        title: t.title,
        priority: t.priority ?? 'normal',
        due_date: t.due_date,
        projectId: projectId ?? null,
        projectName: project?.name ?? null,
      };
    })
    .slice(0, 8);
}

export function mapActiveProjects(
  projectsData: any[],
  allKpis: any[],
  latestKpiValues: Map<string, number | null>
): DirectionProjectSummary[] {
  return projectsData.map((p) => ({
    id: p.id,
    name: p.name,
    goal: p.goal,
    primarySkillId: p.primary_skill_id ?? null,
    kpis: allKpis
      .filter((k) => k.project_id === p.id)
      .map((k) => ({
        id: k.id,
        name: k.name ?? 'KPI',
        current: latestKpiValues.get(k.id) ?? null,
        target: k.target ?? null,
      })),
  }));
}

export function mapDirectionFocus(
  focusData: any,
  parentSkill: any,
  subskill: any
): DirectionFocus {
  return {
    skillId: focusData?.skill_id ?? null,
    skillLabel: parentSkill?.label ?? null,
    subskillLabel: subskill?.label ?? null,
    targetLevel: focusData?.target_level ?? null,
  };
}
