import { useCallback, useMemo, useState } from 'react';
import { Plus, FolderKanban, ChevronDown, ChevronRight } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { formatWarsawDate, getTodayWarsaw } from '../../lib/date';
import { PILLARS, PillarId, ProjectStats, calculateHealthScore } from './projectUtils';
import { COLOR_TO_PILLAR } from '../../lib/projects/pillars';
import DataStateNotice from '../core/DataStateNotice';
import LifeGoalsCard from './LifeGoalsCard';
import GoalCreateModal from './GoalCreateModal';
import RetroModal from './RetroModal';
import { PriorityTasksPanel } from './PriorityTasksPanel';
import { FocusProjectBanner } from './FocusProjectBanner';
import { PillarFilterTabs } from './PillarFilterTabs';
import { ProjectCreateForm } from './ProjectCreateForm';
import { ProjectCardWrapper } from './ProjectCardWrapper';
import { useProjectsData, ProjectRow, GoalKpiRow } from './useProjectsData';
import { useProjectHandlers } from './useProjectHandlers';
import { ProjectCheckpoint } from '../../lib/projects/projects';

import { useSession } from '../../store/useStore';

type PillarFilter = PillarId | 'all';

const emptyStats: ProjectStats = {
  section: null, openItems: [], doneItems: [], total: 0, progress: 0,
  lastActivity: null, daysSince: null, slipping: false, daysLeft: null,
};

export default function Projects({
  onNavigateTo,
  reviewOverdueDays = null,
}: {
  onNavigateTo?: (view: string) => void;
  reviewOverdueDays?: number | null;
}) {
  const session = useSession();
  const userId = session?.user.id || '';
  const [pillarFilter, setPillarFilter] = useState<PillarFilter>('all');
  const [pausedOpen, setPausedOpen]     = useState(false);
  const [doneOpen, setDoneOpen]         = useState(false);
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState({ name: '', goal: '', deadline: '', color: 'indigo', dream_id: '' });
  const [goalCreateOpen, setGoalCreateOpen] = useState(false);

  const data     = useProjectsData(userId);
  const handlers = useProjectHandlers(userId, data);

  const {
    projects, sections, items, checkpoints, dreams,
    lifeGoals, kpis, parentSkills,
    loading, error,
    busy,
    expandedId, setExpandedId,
    editingProjectId, setEditingProjectId,
    editForm, setEditForm,
    newTask, setNewTask,
    newCheckpoint, setNewCheckpoint,
    editingKpiId, setEditingKpiId,
    retroProject,
    retroForm, setRetroForm,
  } = data;

  // ── Derived data ──
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

  const sortByHealth = useCallback((a: ProjectRow, b: ProjectRow) => {
    const ha = calculateHealthScore(a, stats[a.id] ?? emptyStats, kpisByProject[a.id] ?? []);
    const hb = calculateHealthScore(b, stats[b.id] ?? emptyStats, kpisByProject[b.id] ?? []);
    return ha - hb;
  }, [stats, kpisByProject]);

  const activeFiltered  = useMemo(() => projects.filter(p => p.status === 'active' && matchesPillar(p)).sort(sortByHealth), [projects, matchesPillar, sortByHealth]);
  const pausedFiltered  = useMemo(() => projects.filter(p => p.status === 'paused' && matchesPillar(p)), [projects, matchesPillar]);
  const doneFiltered    = useMemo(() => projects.filter(p => p.status === 'done'   && matchesPillar(p)), [projects, matchesPillar]);
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

  // Shared card props bundle (avoids repetition for 3 lists)
  const cardProps = {
    expandedId, setExpandedId, stats, checkpointsByProject, kpisByProject, busy,
    editingProjectId, editForm, setEditForm, setEditingProjectId, newCheckpoint, setNewCheckpoint,
    editingKpiId, setEditingKpiId, newTask, setNewTask, userId, parentSkills, projectPillar,
    startEditProject: handlers.startEditProject,
    handleSaveProject: handlers.handleSaveProject,
    handleAddCheckpoint: handlers.handleAddCheckpoint,
    handleToggleCheckpoint: handlers.handleToggleCheckpoint,
    deleteCheckpoint: handlers.deleteCheckpoint,
    handleUpdateKpiValue: handlers.handleUpdateKpiValue,
    handleToggleTask: handlers.handleToggleTask,
    handleAddTask: handlers.handleAddTask,
    handleStatusCycle: handlers.handleStatusCycle,
    updateProjectStatus: handlers.updateProjectStatus,
    handleDelete: handlers.handleDelete,
  };

  if (loading) return <DataStateNotice tone="loading" title="Ładowanie projektów" detail="" />;

  return (
    <div className="space-y-5">
      {error && <DataStateNotice tone="warning" title="Błąd" detail={error} />}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-bold tracking-tight text-text-primary">Projekty</h2>
          <p className="text-[12px] text-text-muted">{activeProjects.length} aktywnych · {directionalGoalCount} kierunki</p>
        </div>
        <div className="flex items-center gap-2">
          {onNavigateTo && !(reviewOverdueDays !== null && reviewOverdueDays >= 7) && (
            <button
              onClick={() => onNavigateTo('tydzien')}
              className="rounded-full border border-border-custom bg-surface/50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-text-muted hover:text-primary hover:border-primary/30 transition-all cursor-pointer"
            >
              Podsumowanie
            </button>
          )}
          <button
            onClick={() => setGoalCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[12px] font-semibold text-white shadow-md shadow-primary/20"
          >
            <Plus size={14} /> Nowy cel
          </button>
        </div>
      </div>

      <LifeGoalsCard userId={userId} lifeGoals={lifeGoals} />
      <PriorityTasksPanel items={items} onToggleDone={handlers.handleToggleTaskDone} />
      <PillarFilterTabs pillarFilter={pillarFilter} onChange={setPillarFilter} />

      {showForm && (
        <ProjectCreateForm
          form={form} busy={busy}
          onChange={patch => setForm(f => ({ ...f, ...patch }))}
          onSubmit={() => handlers.handleCreate(form, setShowForm, setForm)}
        />
      )}

      <FocusProjectBanner
        focusProject={focusProject}
        activeFilteredFirst={activeFiltered[0]}
        stats={stats}
        kpisByProject={kpisByProject}
        onOpen={id => setExpandedId(prev => prev === id ? null : id)}
      />

      {activeFiltered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-[24px] bg-surface/50">
          <FolderKanban size={28} className="text-text-muted/30 mb-3" />
          <p className="text-[14px] font-semibold text-text-secondary">Brak aktywnych projektów</p>
          <p className="text-[12px] text-text-muted mt-1">Kliknij „Nowy cel&quot; żeby zacząć.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeFiltered.map(p => <ProjectCardWrapper key={p.id} project={p} {...cardProps} />)}
        </div>
      )}

      {pausedFiltered.length > 0 && (
        <div className="rounded-[18px] border border-border-custom/60 overflow-hidden">
          <button onClick={() => setPausedOpen(o => !o)} className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface-solid/50 transition-colors">
            {pausedOpen ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
            <span className="text-[12px] font-semibold text-text-secondary">Pauza ({pausedFiltered.length})</span>
          </button>
          {pausedOpen && <div className="px-3 pb-3 space-y-3 border-t border-border-custom/30 pt-3">{pausedFiltered.map(p => <ProjectCardWrapper key={p.id} project={p} {...cardProps} />)}</div>}
        </div>
      )}

      {doneFiltered.length > 0 && (
        <div className="rounded-[18px] border border-border-custom/60 overflow-hidden">
          <button onClick={() => setDoneOpen(o => !o)} className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface-solid/50 transition-colors">
            {doneOpen ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
            <span className="text-[12px] font-semibold text-text-secondary">Zakończone ({doneFiltered.length})</span>
          </button>
          {doneOpen && <div className="px-3 pb-3 space-y-3 border-t border-border-custom/30 pt-3">{doneFiltered.map(p => <ProjectCardWrapper key={p.id} project={p} {...cardProps} />)}</div>}
        </div>
      )}

      {goalCreateOpen && (
        <GoalCreateModal
          lifeGoals={lifeGoals} busy={busy}
          onClose={() => setGoalCreateOpen(false)}
          onConfirm={(preview, pillar) => handlers.handleGoalCreateConfirm(preview, pillar, dreams, setGoalCreateOpen)}
          onError={err => data.setError(err)}
        />
      )}

      {retroProject && (
        <RetroModal
          retroProject={retroProject} retroForm={retroForm}
          setRetroForm={setRetroForm}
          onSubmit={handlers.handleRetroSubmit}
          busy={busy}
        />
      )}
    </div>
  );
}
