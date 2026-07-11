import type { EnrichedCheckpoint } from './checkpoints';
import type { PowerListWeekStats, WeekDirectionGoals } from './growth/growthWeek';

export type DirectionMustPin = {
  id: string;
  title: string;
  projectId: string | null;
  done: boolean;
  slot: 'must' | 'active';
};

export type DirectionUrgentTodo = {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  projectId: string | null;
  projectName: string | null;
};

export type DirectionProjectSummary = {
  id: string;
  name: string;
  goal: string | null;
  primarySkillId: string | null;
  kpis: { id: string; name: string; current: number | null; target: number | null }[];
};

export type DirectionFocus = {
  skillId: string | null;
  skillLabel: string | null;
  subskillLabel: string | null;
  targetLevel: number | null;
};

export type DirectionContextData = {
  weekStart: string;
  weekGoals: WeekDirectionGoals;
  /** Canonical week-goal resolution (goalSpine); optional for legacy test fixtures */
  weekGoalsMeta?: {
    source: 'week' | 'fallback' | 'empty';
    fallbackWeekStart: string | null;
  };
  checkpoints: {
    all: EnrichedCheckpoint[];
    overdue: EnrichedCheckpoint[];
    upcoming: EnrichedCheckpoint[];
  };
  mustPins: DirectionMustPin[];
  openMustPins: DirectionMustPin[];
  urgentTodos: DirectionUrgentTodo[];
  activeProjects: DirectionProjectSummary[];
  powerListStats: PowerListWeekStats;
  sprintGoal: string | null;
  sprintLabel: string | null;
  sprintFocusProjectIds: string[];
  monthTheme: string | null;
  monthLabel: string | null;
  bhagLine: string | null;
  focus: DirectionFocus;
  weekCheckpointsDone: number;
  weekCheckpointsDue: number;
  skills: { id: string; label: string; key: string }[];
  readinessScore?: number | null;
  recoveryScore?: number | null;
};

export type ProposedTaskSlot = {
  task: string;
  category: 'cialo' | 'duch' | 'konto' | 'general';
  checkpointId: string | null;
  projectId: string | null;
  pinId: string | null;
  todoId: string | null;
  targetValue: string | null;
  source: string;
};

const EMPTY_TASK_SLOT: ProposedTaskSlot = {
  task: '',
  category: 'general',
  checkpointId: null,
  projectId: null,
  pinId: null,
  todoId: null,
  targetValue: null,
  source: '',
};

export * from './dailyPlanKpiHints'
import { defaultPillarProject, suggestDailyKpiTarget, type PillarProjectBinding, type KpiHint } from './dailyPlanKpiHints'

function enrichProposalSlot(
  slot: ProposedTaskSlot,
  ctx: DirectionContextData,
): ProposedTaskSlot {
  if (!slot.task.trim()) return slot;

  const project = slot.projectId
    ? ctx.activeProjects.find((p) => p.id === slot.projectId)
    : null;
  const targetValue = slot.targetValue ?? suggestDailyKpiTarget(project?.kpis ?? []);

  return { ...slot, targetValue };
}

function enrichProposalSlotWithPillarProjects(
  slot: ProposedTaskSlot,
  pillarProjects: Array<{
    pillar: 'cialo' | 'duch' | 'konto';
    projectId: string;
    kpis: KpiHint[];
  }>,
): ProposedTaskSlot {
  if (!slot.task.trim() || slot.projectId) return slot;
  if (slot.category !== 'cialo' && slot.category !== 'duch' && slot.category !== 'konto') return slot;

  const match = pillarProjects.find((p) => p.pillar === slot.category);
  if (!match) return slot;

  return {
    ...slot,
    projectId: match.projectId,
    targetValue: slot.targetValue ?? suggestDailyKpiTarget(match.kpis),
  };
}

export function buildDailyPlanProposal(
  ctx: DirectionContextData,
  pillarBindings: PillarProjectBinding[] = [],
): ProposedTaskSlot[] {
  const out: ProposedTaskSlot[] = [];
  const focusIds = ctx.sprintFocusProjectIds ?? [];

  const lowEnergy =
    (ctx.readinessScore != null && ctx.readinessScore < 60) ||
    (ctx.recoveryScore != null && ctx.recoveryScore < 50);

  const maxSlots = lowEnergy ? 3 : 5;

  if (lowEnergy) {
    out.push({
      task: 'Regeneracja / Lekki dzień (niski recovery/readiness)',
      category: 'cialo',
      checkpointId: null,
      projectId: null,
      pinId: null,
      todoId: null,
      targetValue: null,
      source: 'low_energy_recovery',
    });
  }

  for (const pin of ctx.openMustPins.slice(0, 2)) {
    if (out.length >= maxSlots) break;
    if (out.some((s) => s.pinId === pin.id || s.task === pin.title)) continue;
    out.push({
      task: pin.title,
      category: 'general',
      checkpointId: null,
      projectId: pin.projectId,
      pinId: pin.id,
      todoId: null,
      targetValue: null,
      source: 'must_tygodnia',
    });
  }

  const pillarSlots: Array<{ key: keyof WeekDirectionGoals; category: 'cialo' | 'duch' | 'konto' }> = [
    { key: 'cialo', category: 'cialo' },
    { key: 'duch', category: 'duch' },
    { key: 'konto', category: 'konto' },
  ];
  for (const { key, category } of pillarSlots) {
    if (out.length >= maxSlots) break;
    const text = ctx.weekGoals[key];
    if (text?.trim() && !out.some((s) => s.task === text.trim())) {
      const binding = defaultPillarProject(category, pillarBindings, focusIds);
      out.push({
        task: text.trim(),
        category,
        checkpointId: null,
        projectId: binding?.projectId ?? null,
        pinId: null,
        todoId: null,
        targetValue: null,
        source: `cel_tygodnia_${category}`,
      });
    }
  }

  for (const cp of ctx.checkpoints.overdue.slice(0, 2)) {
    if (out.length >= maxSlots) break;
    if (out.some((s) => s.checkpointId === cp.id || s.task === cp.title)) continue;
    out.push({
      task: cp.title,
      category: pillarToCategory(cp.project.pillar),
      checkpointId: cp.id,
      projectId: cp.project_id,
      pinId: null,
      todoId: null,
      targetValue: null,
      source: 'checkpoint_po_terminie',
    });
  }

  const upcomingSorted = [...ctx.checkpoints.upcoming].sort((a, b) => a.daysLeft - b.daysLeft);
  for (const cp of upcomingSorted.slice(0, 2)) {
    if (out.length >= maxSlots) break;
    if (out.some((s) => s.checkpointId === cp.id || s.task === cp.title)) continue;
    out.push({
      task: cp.title,
      category: pillarToCategory(cp.project.pillar),
      checkpointId: cp.id,
      projectId: cp.project_id,
      pinId: null,
      todoId: null,
      targetValue: null,
      source: 'checkpoint_nadchodzacy',
    });
  }

  for (const todo of ctx.urgentTodos) {
    if (out.length >= maxSlots) break;
    if (out.some((s) => s.todoId === todo.id)) continue;
    out.push({
      task: todo.title,
      category: 'general',
      checkpointId: null,
      projectId: todo.projectId,
      pinId: null,
      todoId: todo.id,
      targetValue: null,
      source: 'todo_urgent',
    });
  }

  while (out.length < maxSlots) {
    out.push({
      ...EMPTY_TASK_SLOT,
      category: out.length < 3 ? (['cialo', 'duch', 'konto'] as const)[out.length] : 'general',
    });
  }

  return out.slice(0, maxSlots).map((slot) => {
    const withPillar = enrichProposalSlotWithPillarProjects(slot, pillarBindings);
    let enriched = enrichProposalSlot(withPillar, ctx);
    if (!enriched.targetValue && enriched.projectId) {
      const kpis =
        pillarBindings.find((b) => b.projectId === enriched.projectId)?.kpis ??
        ctx.activeProjects.find((p) => p.id === enriched.projectId)?.kpis ??
        [];
      const suggested = suggestDailyKpiTarget(kpis);
      if (suggested) enriched = { ...enriched, targetValue: suggested };
    }
    return enriched;
  });
}

function pillarToCategory(pillar: string | null): 'cialo' | 'duch' | 'konto' | 'general' {
  if (pillar === 'cialo' || pillar === 'duch' || pillar === 'konto') return pillar;
  return 'general';
}
