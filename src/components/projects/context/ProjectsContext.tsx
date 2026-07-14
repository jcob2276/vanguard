import { useState, useMemo, useCallback } from 'react';
import { useProjectsData, ProjectRow, GoalKpiRow } from '../useProjectsData';
import { useProjectHandlers } from '../useProjectHandlers';
import { PILLARS, PillarId, ProjectStats, calculateHealthScore } from '../projectUtils';
import { COLOR_TO_PILLAR } from '../../../lib/projects/pillars';
import { formatWarsawDate, getTodayWarsaw } from '../../../lib/date';
import { differenceInDays } from 'date-fns';
import { ProjectCheckpoint } from '../../../lib/projects/projects';
import { ProjectsContext, type PillarFilter, type StatusFilter, type ProjectsContextType } from './projectsContextStore';

const emptyStats: ProjectStats = {
  section: null, openItems: [], doneItems: [], total: 0, progress: 0,
  lastActivity: null, daysSince: null, slipping: false, daysLeft: null,
};

export function ProjectsProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [pillarFilter, setPillarFilter] = useState<PillarFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pausedOpen, setPausedOpen]     = useState(false);
  const [doneOpen, setDoneOpen]         = useState(false);
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState({ name: '', goal: '', deadline: '', color: 'indigo', dream_id: '' });
  const [goalCreateOpen, setGoalCreateOpen] = useState(false);

  const data     = useProjectsData(userId);
  const handlers = useProjectHandlers(userId, data);

  const {
    projects, sections, items, checkpoints, dreams,
    lifeGoals, kpis, parentSkills, expandedId, setExpandedId,
    editingProjectId, setEditingProjectId, editForm, setEditForm,
    newTask, setNewTask, newCheckpoint, setNewCheckpoint,
    editingKpiId, setEditingKpiId, retroProject, setRetroProject,
    retroForm, setRetroForm, loading, error, setError, busy,
    setItems, setSections, run,
  } = data;

  const dreamById = useMemo(() => Object.fromEntries(dreams.map(d => [d.id, d])), [dreams]);

  const stats = useMemo<Record<string, ProjectStats>>(() => {
    const sectionByProject: Record<string, typeof sections[number]> = {};
    sections.forEach(s => { if (s.project_id) sectionByProject[s.project_id] = s; });
    return Object.fromEntries(projects.map(p => {
      const section      = sectionByProject[p.id] ?? null;
      const sectionItems = section ? items.filter(i => i.section_id === section.id) : [];
      const doneItems    = sectionItems.filter(i => i.status === 'done');
      const openItems    = sectionItems.filter(i => i.status === 'open');
      const total        = sectionItems.length;
      const progress     = total === 0 ? 0 : Math.round((doneItems.length / total) * 100);
      const lastTs       = sectionItems.length > 0
        ? Math.max(...sectionItems.map(i => new Date(i.updated_at ?? i.created_at).getTime()))
        : null;
      const lastActivity = lastTs ? new Date(lastTs) : null;
      const todayDate    = new Date(getTodayWarsaw() + 'T12:00:00Z');
      const daysSince    = lastActivity ? differenceInDays(todayDate, new Date(formatWarsawDate(lastActivity) + 'T12:00:00Z')) : null;
      const slipping     = p.status === 'active' && (daysSince === null ? false : daysSince > 7);
      const daysLeft     = p.deadline ? differenceInDays(new Date(p.deadline + 'T12:00:00Z'), todayDate) : null;
      return [p.id, { section, openItems, doneItems, total, progress, lastActivity, daysSince, slipping, daysLeft }];
    }));
  }, [projects, sections, items]);

  const checkpointsByProject = useMemo(() => {
    const grouped: Record<string, ProjectCheckpoint[]> = {};
    checkpoints.forEach(cp => (grouped[cp.project_id] ??= []).push(cp));
    return grouped;
  }, [checkpoints]);

  const kpisByProject = useMemo(() => {
    const grouped: Record<string, GoalKpiRow[]> = {};
    kpis.forEach(k => { if (k.project_id) (grouped[k.project_id] ??= []).push(k); });
    return grouped;
  }, [kpis]);

  const projectPillar = useCallback((project: ProjectRow): PillarId | null => {
    const lifeGoal = project.dream_id ? dreamById[project.dream_id]?.life_goal : null;
    return (lifeGoal && PILLARS.includes(lifeGoal as PillarId)) ? (lifeGoal as PillarId) : (COLOR_TO_PILLAR[project.color] ?? null);
  }, [dreamById]);

  const matchesPillar = useCallback((p: ProjectRow) => pillarFilter === 'all' || projectPillar(p) === pillarFilter, [pillarFilter, projectPillar]);

  const matchesSearch = useCallback((p: ProjectRow) => {
    if (!searchQuery) return true;
    return p.name.toLowerCase().includes(searchQuery.toLowerCase());
  }, [searchQuery]);

  const sortByHealth = useCallback((a: ProjectRow, b: ProjectRow) => {
    const ha = calculateHealthScore(a, stats[a.id] ?? emptyStats, kpisByProject[a.id] ?? []);
    const hb = calculateHealthScore(b, stats[b.id] ?? emptyStats, kpisByProject[b.id] ?? []);
    return ha - hb;
  }, [stats, kpisByProject]);

  const activeFiltered  = useMemo(() => projects.filter(p => p.status === 'active' && matchesPillar(p) && matchesSearch(p)).sort(sortByHealth), [projects, matchesPillar, matchesSearch, sortByHealth]);
  const pausedFiltered  = useMemo(() => projects.filter(p => p.status === 'paused' && matchesPillar(p) && matchesSearch(p)), [projects, matchesPillar, matchesSearch]);
  const doneFiltered    = useMemo(() => projects.filter(p => p.status === 'done'   && matchesPillar(p) && matchesSearch(p)), [projects, matchesPillar, matchesSearch]);
  const activeProjects  = useMemo(() => projects.filter(p => p.status === 'active'), [projects]);
  const directionalGoalCount = useMemo(() => PILLARS.filter(pillar => Boolean(lifeGoals?.[`goal_${pillar}`])).length, [lifeGoals]);

  const focusProject = useMemo(() => {
    if (!activeFiltered.length) return null;
    let worst = activeFiltered[0];
    let worstScore = calculateHealthScore(worst, stats[worst.id] ?? emptyStats, kpisByProject[worst.id] ?? []);
    for (const p of activeFiltered) {
      const score = calculateHealthScore(p, stats[p.id] ?? emptyStats, kpisByProject[p.id] ?? []);
      if (score < worstScore) { worst = p; worstScore = score; }
    }
    return worstScore < 60 ? worst : null;
  }, [activeFiltered, stats, kpisByProject]);

  const contextValue = useMemo<ProjectsContextType>(() => ({
    projects, sections, items, checkpoints, dreams,
    lifeGoals, kpis, parentSkills, expandedId, setExpandedId,
    editingProjectId, setEditingProjectId, editForm, setEditForm,
    newTask, setNewTask, newCheckpoint, setNewCheckpoint,
    editingKpiId, setEditingKpiId, retroProject, setRetroProject,
    retroForm, setRetroForm, loading, error, setError, busy,
    setItems, setSections, run,
    handlers,
    pillarFilter,
    setPillarFilter,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    pausedOpen,
    setPausedOpen,
    doneOpen,
    setDoneOpen,
    showForm,
    setShowForm,
    form,
    setForm,
    goalCreateOpen,
    setGoalCreateOpen,
    dreamById,
    stats,
    checkpointsByProject,
    kpisByProject,
    projectPillar,
    activeFiltered,
    pausedFiltered,
    doneFiltered,
    activeProjects,
    directionalGoalCount,
    focusProject,
    userId,
  }), [
    projects, sections, items, checkpoints, dreams,
    lifeGoals, kpis, parentSkills, expandedId, setExpandedId,
    editingProjectId, setEditingProjectId, editForm, setEditForm,
    newTask, setNewTask, newCheckpoint, setNewCheckpoint,
    editingKpiId, setEditingKpiId, retroProject, setRetroProject,
    retroForm, setRetroForm, loading, error, setError, busy,
    setItems, setSections, run,
    handlers, pillarFilter, statusFilter, searchQuery, pausedOpen, doneOpen, showForm, form, goalCreateOpen,
    dreamById, stats, checkpointsByProject, kpisByProject, projectPillar,
    activeFiltered, pausedFiltered, doneFiltered, activeProjects, directionalGoalCount,
    focusProject, userId,
  ]);

  return (
    <ProjectsContext.Provider value={contextValue}>
      {children}
    </ProjectsContext.Provider>
  );
}
