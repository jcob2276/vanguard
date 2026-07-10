import { useCallback, useEffect, useState } from 'react';
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

export function useProjectsData(userId: string) {
  const [projects, setProjects]   = useState<ProjectRow[]>([]);
  const [sections, setSections]   = useState<TodoSectionRow[]>([]);
  const [items, setItems]         = useState<TodoItemRow[]>([]);
  const [checkpoints, setCheckpoints] = useState<ProjectCheckpoint[]>([]);
  const [dreams, setDreams]       = useState<DreamRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [busy, setBusy]           = useState(false);
  const [lifeGoals, setLifeGoals] = useState<LongTermGoals['declarations'] | null>(null);
  const [kpis, setKpis]           = useState<GoalKpiRow[]>([]);
  const [parentSkills, setParentSkills] = useState<{ id: string; label: string }[]>([]);

  // ── expanded/editing UI state lives here for convenience ──
  const [expandedId, setExpandedId]           = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editForm, setEditForm]               = useState({ name: '', goal: '', deadline: '', color: 'indigo', primary_skill_id: '' });
  const [newTask, setNewTask]                 = useState<{ projectId: string; title: string; recurrence: string } | null>(null);
  const [newCheckpoint, setNewCheckpoint]     = useState<{ projectId: string; title: string; due_date: string } | null>(null);
  const [editingKpiId, setEditingKpiId]       = useState<string | null>(null);
  const [retroProject, setRetroProject]       = useState<ProjectRow | null>(null);
  const [retroForm, setRetroForm]             = useState({ good: '', improve: '', rating: 0 });

  const fetchAll = useCallback(async () => {
    try {
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

      setProjects(p ?? []);
      setSections(s ?? []);
      setItems(i ?? []);
      setCheckpoints(c ?? []);
      setDreams(dreamsData ?? []);
      setLifeGoals(longTerm.declarations ?? null);
      setKpis(kpisWithCurrent);
      setParentSkills((skillsData ?? []).map((sk) => ({ id: sk.id, label: sk.label })));
    } catch (err: unknown) { setError((err as Error).message); }
  }, [userId]);

  useEffect(() => {
    (async () => { setLoading(true); await fetchAll(); setLoading(false); })();
  }, [fetchAll]);

  useGoalSpineInvalidation(fetchAll);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); await fetchAll(); }
    catch (err: unknown) { setError((err as Error).message); }
    finally { setBusy(false); }
  }, [fetchAll]);

  return {
    // raw data
    projects, sections, items, checkpoints, dreams,
    lifeGoals, kpis, parentSkills,
    // status
    loading, error, setError, busy,
    // setters needed by handlers
    setItems, setSections,
    // UI state
    expandedId, setExpandedId,
    editingProjectId, setEditingProjectId,
    editForm, setEditForm,
    newTask, setNewTask,
    newCheckpoint, setNewCheckpoint,
    editingKpiId, setEditingKpiId,
    retroProject, setRetroProject,
    retroForm, setRetroForm,
    // core operations
    fetchAll, run,
  };
}
