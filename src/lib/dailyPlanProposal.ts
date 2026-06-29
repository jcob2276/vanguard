import type { EnrichedCheckpoint } from './checkpoints';
import type { PowerListWeekStats, WeekDirectionGoals } from './growthWeek';
import type { LearningWeekPin } from './growth';

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
  focus: DirectionFocus;
  weekCheckpointsDone: number;
  weekCheckpointsDue: number;
  skills: { id: string; label: string; key: string }[];
};

export type ProposedTaskSlot = {
  task: string;
  category: 'cialo' | 'duch' | 'konto' | 'general';
  checkpointId: string | null;
  projectId: string | null;
  pinId: string | null;
  todoId: string | null;
  source: string;
};

export const EMPTY_TASK_SLOT: ProposedTaskSlot = {
  task: '',
  category: 'general',
  checkpointId: null,
  projectId: null,
  pinId: null,
  todoId: null,
  source: '',
};

export function buildDailyPlanProposal(ctx: DirectionContextData): ProposedTaskSlot[] {
  const out: ProposedTaskSlot[] = [];

  for (const cp of ctx.checkpoints.overdue.slice(0, 2)) {
    out.push({
      task: cp.title,
      category: pillarToCategory(cp.project.pillar),
      checkpointId: cp.id,
      projectId: cp.project_id,
      pinId: null,
      todoId: null,
      source: 'checkpoint_po_terminie',
    });
  }

  for (const pin of ctx.openMustPins.slice(0, 2)) {
    if (out.some((s) => s.pinId === pin.id || s.task === pin.title)) continue;
    out.push({
      task: pin.title,
      category: 'general',
      checkpointId: null,
      projectId: pin.projectId,
      pinId: pin.id,
      todoId: null,
      source: 'must_tygodnia',
    });
  }

  const pillarSlots: Array<{ key: keyof WeekDirectionGoals; category: 'cialo' | 'duch' | 'konto' }> = [
    { key: 'cialo', category: 'cialo' },
    { key: 'duch', category: 'duch' },
    { key: 'konto', category: 'konto' },
  ];
  for (const { key, category } of pillarSlots) {
    const text = ctx.weekGoals[key];
    if (text?.trim() && !out.some((s) => s.task === text.trim())) {
      out.push({
        task: text.trim(),
        category,
        checkpointId: null,
        projectId: null,
        pinId: null,
        todoId: null,
        source: `cel_tygodnia_${category}`,
      });
    }
  }

  for (const todo of ctx.urgentTodos) {
    if (out.length >= 5) break;
    if (out.some((s) => s.todoId === todo.id)) continue;
    out.push({
      task: todo.title,
      category: 'general',
      checkpointId: null,
      projectId: todo.projectId,
      pinId: null,
      todoId: todo.id,
      source: 'todo_urgent',
    });
  }

  while (out.length < 5) {
    out.push({ ...EMPTY_TASK_SLOT, category: out.length < 3 ? (['cialo', 'duch', 'konto'] as const)[out.length] : 'general' });
  }

  return out.slice(0, 5);
}

function pillarToCategory(pillar: string | null): 'cialo' | 'duch' | 'konto' | 'general' {
  if (pillar === 'cialo' || pillar === 'duch' || pillar === 'konto') return pillar;
  return 'general';
}
