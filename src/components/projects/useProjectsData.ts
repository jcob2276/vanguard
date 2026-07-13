import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { desktopKeys, projectsKeys } from '../../lib/queryKeys';
import {
  listProjects,
  listProjectCheckpoints,
  listDreams,
  listActiveParentLearningSkills,
  listGoalKpis,
  ProjectCheckpoint,
} from '../../lib/projects/projects';
import { listTodoSections, listTodoItems, TodoItemRow, TodoSectionRow } from '../../lib/todo/todo';
import { fetchLongTermGoals } from '../../lib/goal/goalSpine';
import { useGoalSpineInvalidation } from '../../hooks/useGoalSpineInvalidation';
import { ProjectRow, GoalKpiRow } from './projectUtils';

export type { ProjectRow, GoalKpiRow };
export type DreamRow = Awaited<ReturnType<typeof listDreams>>[number];
type LongTermGoals = Awaited<ReturnType<typeof fetchLongTermGoals>>;

export type ProjectFormState = { name: string; goal: string; deadline: string; color: string; dream_id: string };

export type GoalCreatePreview = {
  project_name: string;
  affirmation?: string;
  kpis?: { name?: string; label?: string; description?: string; indicator?: string; unit?: string; target?: number }[];
  checkpoints?: { title?: string; name?: string; description?: string; milestone?: string; due_date?: string | null }[];
};

interface ProjectsDataResult {
  projects: ProjectRow[];
  sections: TodoSectionRow[];
  items: TodoItemRow[];
  checkpoints: ProjectCheckpoint[];
  dreams: DreamRow[];
  lifeGoals: LongTermGoals['declarations'];
  kpis: GoalKpiRow[];
  parentSkills: { id: string; label: string }[];
}



async function fetchProjectsData(userId: string): Promise<ProjectsDataResult> {
  const [p, s, i, c, dreamsData, longTerm, skillsData, rawKpis] = await Promise.all([
    listProjects(userId),
    listTodoSections(userId),
    listTodoItems(userId),
    listProjectCheckpoints(userId),
    listDreams(userId),
    fetchLongTermGoals(userId),
    listActiveParentLearningSkills(userId),
    listGoalKpis(userId),
  ]);

  const kpiMap = new Map<string, number | null>();
  for (const proj of longTerm.projects) {
    for (const k of proj.kpis ?? []) {
      kpiMap.set(k.id, k.current);
    }
  }

  const kpisWithCurrent = (rawKpis ?? []).map((k) => ({
    ...k,
    current_value: kpiMap.get(k.id) ?? null,
  }));

  return {
    projects: p ?? [],
    sections: s ?? [],
    items: i ?? [],
    checkpoints: c ?? [],
    dreams: dreamsData ?? [],
    lifeGoals: longTerm.declarations ?? null,
    kpis: kpisWithCurrent as GoalKpiRow[],
    parentSkills: (skillsData ?? []).map((sk) => ({ id: sk.id, label: sk.label })),
  };
}

export function useProjectsData(userId: string) {
  const queryClient = useQueryClient();
  const queryKey = projectsKeys.detail(userId);

  const { data: rawData, isLoading: loading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchProjectsData(userId),
    enabled: !!userId,
  });

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ── expanded/editing UI state lives here for convenience ──
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', goal: '', deadline: '', color: 'indigo', primary_skill_id: '' });
  const [newTask, setNewTask] = useState<{ projectId: string; title: string; recurrence: string } | null>(null);
  const [newCheckpoint, setNewCheckpoint] = useState<{ projectId: string; title: string; due_date: string } | null>(null);
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const [retroProject, setRetroProject] = useState<ProjectRow | null>(null);
  const [retroForm, setRetroForm] = useState({ good: '', improve: '', rating: 0 });

  const projects = rawData?.projects ?? [];
  const sections = rawData?.sections ?? [];
  const items = rawData?.items ?? [];
  const checkpoints = rawData?.checkpoints ?? [];
  const dreams = rawData?.dreams ?? [];
  const lifeGoals = rawData?.lifeGoals ?? null;
  const kpis = rawData?.kpis ?? [];
  const parentSkills = rawData?.parentSkills ?? [];

  useGoalSpineInvalidation(() => { void refetch(); });

  // Setter adapters — patch query cache directly for optimistic updates
  const setItems = useCallback((updater: TodoItemRow[] | ((prev: TodoItemRow[]) => TodoItemRow[])) => {
    queryClient.setQueryData<ProjectsDataResult>(queryKey, (old) => {
      if (!old) return old;
      const nextItems = typeof updater === 'function' ? updater(old.items) : updater;
      return { ...old, items: nextItems };
    });
  }, [queryClient, queryKey]);

  const setSections = useCallback((updater: TodoSectionRow[] | ((prev: TodoSectionRow[]) => TodoSectionRow[])) => {
    queryClient.setQueryData<ProjectsDataResult>(queryKey, (old) => {
      if (!old) return old;
      const nextSections = typeof updater === 'function' ? updater(old.sections) : updater;
      return { ...old, sections: nextSections };
    });
  }, [queryClient, queryKey]);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: desktopKeys.dashboard(userId) });
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [queryClient, queryKey, userId]);

  return {
    projects, sections, items, checkpoints, dreams,
    lifeGoals, kpis, parentSkills,
    loading, error, setError, busy,
    setItems, setSections,
    expandedId, setExpandedId,
    editingProjectId, setEditingProjectId,
    editForm, setEditForm,
    newTask, setNewTask,
    newCheckpoint, setNewCheckpoint,
    editingKpiId, setEditingKpiId,
    retroProject, setRetroProject,
    retroForm, setRetroForm,
    fetchAll: refetch, run,
  };
}
