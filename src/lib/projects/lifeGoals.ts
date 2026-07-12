import { differenceInDays, parseISO } from 'date-fns';
import { Shield, Wallet, Zap, type LucideIcon } from 'lucide-react';
import { getTodayWarsaw } from '../date';
import type { Tables } from '../database.types';
import { COLOR_TO_PILLAR, type PillarId } from './pillars';

type LifeGoalPillarId = PillarId;
type LifeGoalKey = 'goal_cialo' | 'goal_duch' | 'goal_konto';
type LifeGoalDateKey = 'date_cialo' | 'date_duch' | 'date_konto';

export type LifeGoalDisplayRow = {
  id: LifeGoalPillarId;
  goalKey: LifeGoalKey;
  dateKey: LifeGoalDateKey;
  label: string;
  title: string;
  subtitle?: string | null;
  days: number | null;
  icon: LucideIcon;
  card: string;
  text: string;
  badge: string;
  source?: 'project';
  projectId?: string;
  kpis?: Array<{ id: string; name: string; current: number | null; target: number | null; unit?: string | null }>;
};

type ProjectGoalSource = Pick<
  Tables<'projects'>,
  'id' | 'name' | 'goal' | 'deadline' | 'color' | 'dream_id' | 'status'
>;
type DreamPillarSource = Pick<Tables<'dreams'>, 'id' | 'life_goal'>;

function projectPillar(
  project: ProjectGoalSource,
  dreamById: Record<string, DreamPillarSource>,
): LifeGoalPillarId | null {
  const fromDream = project.dream_id ? dreamById[project.dream_id]?.life_goal : null;
  if (fromDream === 'cialo' || fromDream === 'duch' || fromDream === 'konto') return fromDream;
  return COLOR_TO_PILLAR[project.color] ?? null;
}

const LIFE_GOAL_PILLARS: Array<{
  id: LifeGoalPillarId;
  goalKey: LifeGoalKey;
  dateKey: LifeGoalDateKey;
  label: string;
  icon: LucideIcon;
  card: string;
  text: string;
  badge: string;
}> = [
  {
    id: 'cialo',
    goalKey: 'goal_cialo',
    dateKey: 'date_cialo',
    label: 'Ciało',
    icon: Shield,
    card: 'border-emerald-500/15 bg-emerald-500/[0.04]',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'duch',
    goalKey: 'goal_duch',
    dateKey: 'date_duch',
    label: 'Duch',
    icon: Zap,
    card: 'border-indigo-500/15 bg-indigo-500/[0.04]',
    text: 'text-indigo-600 dark:text-indigo-400',
    badge: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'konto',
    goalKey: 'goal_konto',
    dateKey: 'date_konto',
    label: 'Konto',
    icon: Wallet,
    card: 'border-amber-500/15 bg-amber-500/[0.04]',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
  },
];

type KpiWithCurrent = Pick<Tables<'goal_kpis'>, 'id' | 'project_id' | 'name' | 'target' | 'unit'> & {
  current_value: number | null;
};

export function lifeGoalDisplayRowsFromProjects(
  projects: ProjectGoalSource[],
  dreams: DreamPillarSource[],
  kpis: KpiWithCurrent[] = [],
): LifeGoalDisplayRow[] {
  const dreamById = Object.fromEntries(dreams.map((d) => [d.id, d]));
  const today = getTodayWarsaw();
  const pillarOrder: Record<LifeGoalPillarId, number> = { cialo: 0, duch: 1, konto: 2 };

  const active = projects.filter((p) => p.status === 'active');
  const sorted = [...active].sort((a, b) => {
    const pa = projectPillar(a, dreamById);
    const pb = projectPillar(b, dreamById);
    const oa = pa ? pillarOrder[pa] : 99;
    const ob = pb ? pillarOrder[pb] : 99;
    if (oa !== ob) return oa - ob;
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  return sorted.flatMap((project) => {
    const pillarId = projectPillar(project, dreamById);
    if (!pillarId) return [];
    const pillar = LIFE_GOAL_PILLARS.find((p) => p.id === pillarId);
    if (!pillar) return [];

    const goalText = project.goal?.trim();
    const name = project.name?.trim();
    if (!goalText && !name) return [];

    const title = goalText || name!;
    const subtitle = goalText && name && goalText !== name ? name : null;
    const days = project.deadline
      ? differenceInDays(parseISO(project.deadline), parseISO(today))
      : null;

    const projectKpis = kpis
      .filter((k) => k.project_id === project.id)
      .map((k) => ({
        id: k.id,
        name: k.name,
        current: k.current_value,
        target: k.target,
        unit: k.unit,
      }));

    return [{
      ...pillar,
      title,
      subtitle,
      days,
      source: 'project' as const,
      projectId: project.id,
      kpis: projectKpis,
    }];
  });
}

