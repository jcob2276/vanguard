import type {
  DirectionMustPin,
  DirectionUrgentTodo,
  DirectionProjectSummary,
  DirectionFocus,
} from '../../../../lib/dailyPlanProposal';

interface PinRow {
  id: string;
  entity_type: string;
  entity_id: string | null;
  manual_title: string | null;
  done: boolean;
  slot: string;
  project_id: string | null;
}

interface LinkRow {
  id: string;
  title: string | null;
}

interface TodoRow {
  id: string;
  title: string;
  priority: string | null;
  due_date: string | null;
  section_id: string | null;
  status: string;
}

interface ProjectRow {
  id: string;
  name: string;
  goal: string | null;
  primary_skill_id?: string | null;
}

interface KpiRow {
  id: string;
  project_id: string | null;
  name: string;
  target: number | null;
}

interface FocusData {
  skill_id: string | null;
  target_level: number | null;
}

interface SkillRow {
  id: string;
  label: string;
  key: string;
}

function resolvePinTitle(
  pin: {
    entity_type: string;
    entity_id: string | null;
    manual_title: string | null;
  },
  links: Map<string, LinkRow>,
  todos: Map<string, TodoRow>
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
  pins: PinRow[],
  linksMap: Map<string, LinkRow>,
  todosMap: Map<string, TodoRow>
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
  todos: TodoRow[],
  sectionProject: Map<string, string | null>,
  projectsData: ProjectRow[]
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
  projectsData: ProjectRow[],
  allKpis: KpiRow[],
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
  focusData: FocusData | null,
  parentSkill: SkillRow | null | undefined,
  subskill: SkillRow | null | undefined
): DirectionFocus {
  return {
    skillId: focusData?.skill_id ?? null,
    skillLabel: parentSkill?.label ?? null,
    subskillLabel: subskill?.label ?? null,
    targetLevel: focusData?.target_level ?? null,
  };
}
