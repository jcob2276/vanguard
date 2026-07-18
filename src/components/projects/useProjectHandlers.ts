import { useCallback, useRef } from 'react';
import {
  updateProject,
  deleteProject,
  linkSectionToProject,
  createProjectCheckpoint,
  updateProjectCheckpoint,
  deleteProjectCheckpoint,
  upsertKpiEntry,
  ProjectCheckpoint,
  type ProjectUpdate,
} from '../../lib/projects/projects';
import { createTodoSection, createTodoItem, setTodoStatus, TodoItemRow } from '../../lib/todo/todo';
import { getTodayWarsaw } from '../../lib/date';
import { getWeekStartWarsaw } from '../../lib/growth/growth';
import { notify, confirmDialog } from '../../lib/notify';
import { STATUS_NEXT } from './projectUtils';
import type { useProjectsData, ProjectRow } from './useProjectsData';

function useProjectCrudHandlers(
  userId: string,
  data: ReturnType<typeof useProjectsData>,
) {
  const {
    run, sections,
    setEditingProjectId, setRetroProject, setRetroForm,
    editForm, retroProject, retroForm,
  } = data;

  const ensureProjectSection = useCallback(async (project: ProjectRow, currentSection: { id: string } | null) => {
    if (currentSection?.id) return currentSection;
    const reusable = sections.find(s => s.name === project.name && !s.project_id);
    if (reusable?.id) {
      await linkSectionToProject(reusable.id, project.id);
      return reusable;
    }
    const section = await createTodoSection(userId, project.name);
    await linkSectionToProject(section.id, project.id);
    return section;
  }, [sections, userId]);

  const handleDelete = useCallback((id: string) => {
    void confirmDialog('Usunąć projekt? Zadania w sekcji zostają.').then((ok) => {
      if (!ok) return;
      run(() => deleteProject(id));
    });
  }, [run]);

  const handleStatusCycle = useCallback((project: ProjectRow) => {
    const next = STATUS_NEXT[project.status];
    if (next === 'done') {
      setRetroProject(project);
      setRetroForm({ good: '', improve: '', rating: 0 });
    } else {
      run(() => updateProject(project.id, { status: next }));
    }
  }, [run, setRetroProject, setRetroForm]);

  const handleRetroSubmit = useCallback(async (skip = false) => {
    if (!retroProject) return;
    const patch: ProjectUpdate = { status: 'done' };
    if (!skip) {
      if (retroForm.good.trim())    patch.retrospective_good    = retroForm.good.trim();
      if (retroForm.improve.trim()) patch.retrospective_improve = retroForm.improve.trim();
      if (retroForm.rating > 0)     patch.retrospective_rating  = retroForm.rating;
    }
    await run(() => updateProject(retroProject.id, patch));
    setRetroProject(null);
  }, [retroProject, retroForm, run, setRetroProject]);

  const startEditProject = useCallback((project: ProjectRow) => {
    setEditingProjectId(project.id);
    data.setEditForm({
      name: project.name || '',
      goal: project.goal || '',
      deadline: project.deadline || '',
      color: project.color || 'indigo',
      primary_skill_id: project.primary_skill_id || '',
    });
  }, [setEditingProjectId, data]);

  const handleSaveProject = useCallback((project: ProjectRow) => {
    if (!editForm.name.trim()) return;
    run(async () => {
      await updateProject(project.id, {
        name: editForm.name.trim(),
        goal: editForm.goal.trim() || null,
        deadline: editForm.deadline || null,
        color: editForm.color,
        primary_skill_id: editForm.primary_skill_id || null,
      });
      setEditingProjectId(null);
    });
  }, [editForm, run, setEditingProjectId]);

  return {
    ensureProjectSection,
    handleDelete,
    handleStatusCycle,
    handleRetroSubmit,
    startEditProject,
    handleSaveProject,
  };
}

function useProjectTaskKpiHandlers(
  userId: string,
  data: ReturnType<typeof useProjectsData>,
  ensureProjectSection: ReturnType<typeof useProjectCrudHandlers>['ensureProjectSection'],
) {
  const {
    run, setItems,
    setNewTask, setNewCheckpoint, setEditingKpiId,
    newTask, newCheckpoint,
  } = data;

  const handleAddTask = useCallback((project: ProjectRow, section: { id: string } | null) => {
    if (!newTask?.title.trim()) return;
    run(async () => {
      const projectSection = await ensureProjectSection(project, section);
      await createTodoItem(userId, {
        title: newTask.title.trim(),
        section_id: projectSection?.id ?? null,
        priority: 'normal',
        tagsText: '',
        recurrence: newTask!.recurrence || undefined,
      });
      setNewTask(null);
    });
  }, [newTask, run, ensureProjectSection, userId, setNewTask]);

  const handleAddCheckpoint = useCallback((projectId: string) => {
    if (!newCheckpoint?.title.trim()) return;
    run(async () => {
      await createProjectCheckpoint(userId, {
        project_id: projectId,
        title: newCheckpoint.title.trim(),
        due_date: newCheckpoint.due_date || null,
      });
      setNewCheckpoint(null);
    });
  }, [newCheckpoint, run, userId, setNewCheckpoint]);

  const handleToggleCheckpoint = useCallback((checkpoint: ProjectCheckpoint) => {
    const done = checkpoint.status === 'done';
    run(() => updateProjectCheckpoint(checkpoint.id, {
      status: done ? 'open' : 'done',
      completed_at: done ? null : new Date().toISOString(),
    }));
  }, [run]);

  const deleteCheckpoint = useCallback((id: string) => run(() => deleteProjectCheckpoint(id)), [run]);

  const updateProjectStatus = useCallback((project: ProjectRow, status: string) =>
    run(() => updateProject(project.id, { status })), [run]);

  const handleToggleTask = useCallback((item: TodoItemRow) => {
    const next = item.status === 'done' ? 'open' : 'done';
    run(() => setTodoStatus(item, next));
  }, [run]);

  const handleToggleTaskDone = useCallback(async (task: TodoItemRow) => {
    data.setError(null);
    setItems(prev => prev.map(i => i.id === task.id ? { ...i, status: 'done', completed_at: new Date().toISOString() } : i));
    try {
      await setTodoStatus(task, 'done');
      notify('Zadanie ukończone', 'success');
    } catch (e: unknown) {
      data.setError((e as Error).message || 'Nie udało się ukończyć zadania');
      setItems(prev => prev.map(i => i.id === task.id ? { ...i, status: task.status, completed_at: task.completed_at } : i));
    }
  }, [setItems, data]);

  const savingKpiRef = useRef<string | null>(null);
  const handleUpdateKpiValue = useCallback((kpiId: string, raw: string) => {
    if (savingKpiRef.current === kpiId) return;
    const num = parseFloat(raw);
    if (isNaN(num)) { setEditingKpiId(null); return; }
    savingKpiRef.current = kpiId;
    const weekStart = getWeekStartWarsaw(getTodayWarsaw());
    run(async () => {
      try {
        await upsertKpiEntry(userId, kpiId, weekStart, num);
        setEditingKpiId(null);
      } finally {
        savingKpiRef.current = null;
      }
    });
  }, [run, userId, setEditingKpiId]);

  return {
    handleAddTask,
    handleAddCheckpoint,
    handleToggleCheckpoint,
    deleteCheckpoint,
    updateProjectStatus,
    handleToggleTask,
    handleToggleTaskDone,
    handleUpdateKpiValue,
  };
}

export function useProjectHandlers(
  userId: string,
  data: ReturnType<typeof useProjectsData>,
) {
  const crud = useProjectCrudHandlers(userId, data);
  const taskKpi = useProjectTaskKpiHandlers(userId, data, crud.ensureProjectSection);
  return { ...crud, ...taskKpi };
}
