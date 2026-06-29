import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Plus,
  TrendingUp,
  FolderKanban,
  Zap,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { differenceInDays } from 'date-fns';
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  linkSectionToProject,
  listProjectCheckpoints,
  createProjectCheckpoint,
  updateProjectCheckpoint,
  deleteProjectCheckpoint,
  ProjectCheckpoint,
} from '../../lib/projects';
import { listTodoSections, listTodoItems, createTodoSection, createTodoItem, setTodoStatus } from '../../lib/todo';
import { supabase } from '../../lib/supabase';
import { fetchLongTermGoals } from '../../lib/goalSpine';
import { useGoalSpineInvalidation } from '../../hooks/useGoalSpineInvalidation';
import { formatWarsawDate, getTodayWarsaw } from '../../lib/date';
import DataStateNotice from '../core/DataStateNotice';

// Subcomponents and utilities
import {
  COLORS,
  PILLAR_META,
  STATUS_NEXT,
  PILLARS,
  PillarId,
  ProjectStats,
  calculateHealthScore,
  getHealthLevel,
  HEALTH_COLORS,
} from './projectUtils';

import GoalCreateModal from './GoalCreateModal';
import RetroModal from './RetroModal';
import ProjectCard from './ProjectCard';
import { confirmDialog } from '../../lib/notify';

type PillarFilter = PillarId | 'all';

const COLOR_PILLAR: Record<string, PillarId> = {
  emerald: 'cialo', green: 'cialo',
  indigo: 'duch', violet: 'duch', purple: 'duch',
  amber: 'konto', yellow: 'konto', orange: 'konto',
};

export default function Projects({
  session,
  onNavigateTo,
  reviewOverdueDays = null,
}: {
  session: any;
  onNavigateTo?: (view: string) => void;
  reviewOverdueDays?: number | null;
}) {
  const userId = session.user.id;

  const [projects, setProjects]   = useState<any[]>([]);
  const [sections, setSections]   = useState<any[]>([]);
  const [items, setItems]         = useState<any[]>([]);
  const [checkpoints, setCheckpoints] = useState<ProjectCheckpoint[]>([]);
  const [dreams, setDreams]       = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [busy, setBusy]           = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [pillarFilter, setPillarFilter] = useState<PillarFilter>('all');
  const [pausedOpen, setPausedOpen] = useState(false);
  const [doneOpen, setDoneOpen]   = useState(false);
  const [form, setForm] = useState({ name: '', goal: '', deadline: '', color: 'indigo', dream_id: '' });
  const [newTask, setNewTask] = useState<{ projectId: string; title: string; recurrence: string } | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', goal: '', deadline: '', color: 'indigo', primary_skill_id: '' });
  const [parentSkills, setParentSkills] = useState<{ id: string; label: string }[]>([]);
  const [newCheckpoint, setNewCheckpoint] = useState<{ projectId: string; title: string; due_date: string } | null>(null);
  const [retroProject, setRetroProject] = useState<any | null>(null);
  const [retroForm, setRetroForm] = useState({ good: '', improve: '', rating: 0 });

  const [lifeGoals, setLifeGoals] = useState<any>(null);
  const [kpis, setKpis] = useState<any[]>([]);
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const [goalCreateOpen, setGoalCreateOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [p, s, i, c, dreamsRes, longTerm, kpiRes, skillsRes] = await Promise.all([
        listProjects(userId),
        listTodoSections(userId),
        listTodoItems(userId),
        listProjectCheckpoints(userId),
        supabase.from('dreams').select('id, title, category, life_goal').eq('user_id', userId),
        fetchLongTermGoals(userId),
        supabase.from('goal_kpis').select('*').eq('user_id', userId).order('sort_order'),
        supabase.from('learning_skills').select('id, label').eq('user_id', userId).eq('active', true).is('parent_id', null).order('sort_order'),
      ]);
      if (dreamsRes.error) throw new Error(dreamsRes.error.message);
      if (kpiRes.error) throw new Error(kpiRes.error.message);
      if (skillsRes.error) throw new Error(skillsRes.error.message);
      setProjects(p ?? []);
      setSections(s ?? []);
      setItems(i ?? []);
      setCheckpoints(c ?? []);
      setDreams(dreamsRes.data ?? []);
      setLifeGoals(longTerm.declarations ?? null);
      setKpis(kpiRes.data ?? []);
      setParentSkills((skillsRes.data ?? []).map((sk) => ({ id: sk.id, label: sk.label })));
    } catch (err: any) { setError(err.message); }
  }, [userId]);

  useEffect(() => {
    (async () => { setLoading(true); await fetchAll(); setLoading(false); })();
  }, [fetchAll]);

  useGoalSpineInvalidation(fetchAll);

  const run = async (fn: () => Promise<any>) => {
    setBusy(true);
    try { await fn(); await fetchAll(); }
    catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };

  // ── Stats per project ──
  const stats = useMemo<Record<string, ProjectStats>>(() => {
    const sectionByProject: Record<string, any> = {};
    sections.forEach(s => { if (s.project_id) sectionByProject[s.project_id] = s; });

    return Object.fromEntries(projects.map(p => {
      const section = sectionByProject[p.id] ?? null;
      const sectionItems = section ? items.filter(i => i.section_id === section.id) : [];
      const doneItems  = sectionItems.filter(i => i.status === 'done');
      const openItems  = sectionItems.filter(i => i.status === 'open');
      const total      = sectionItems.length;
      const progress   = total === 0 ? 0 : Math.round((doneItems.length / total) * 100);

      const lastTs = sectionItems.length > 0
        ? Math.max(...sectionItems.map(i => new Date(i.updated_at ?? i.created_at).getTime()))
        : null;
      const lastActivity = lastTs ? new Date(lastTs) : null;
      const todayWarsawDate = new Date(getTodayWarsaw() + 'T12:00:00Z');
      const daysSince = lastActivity ? differenceInDays(todayWarsawDate, new Date(formatWarsawDate(lastActivity) + 'T12:00:00Z')) : null;
      const slipping  = p.status === 'active' && (daysSince === null ? false : daysSince > 7);

      const daysLeft = p.deadline
        ? differenceInDays(new Date(p.deadline + 'T12:00:00Z'), todayWarsawDate)
        : null;

      return [p.id, { section, openItems, doneItems, total, progress, lastActivity, daysSince, slipping, daysLeft }];
    }));
  }, [projects, sections, items]);

  const dreamById = useMemo(() =>
    Object.fromEntries(dreams.map(d => [d.id, d])),
    [dreams],
  );

  const checkpointsByProject = useMemo(() => {
    const grouped: Record<string, ProjectCheckpoint[]> = {};
    checkpoints.forEach(cp => {
      if (!grouped[cp.project_id]) grouped[cp.project_id] = [];
      grouped[cp.project_id].push(cp);
    });
    return grouped;
  }, [checkpoints]);

  const kpisByProject = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    kpis.forEach(k => {
      if (!k.project_id) return;
      if (!grouped[k.project_id]) grouped[k.project_id] = [];
      grouped[k.project_id].push(k);
    });
    return grouped;
  }, [kpis]);

  // ── Handlers ──
  const handleCreate = () => {
    if (!form.name.trim()) return;
    run(async () => {
      let project: { id?: string } | null = null;
      let section: { id?: string } | null = null;
      try {
        project = (await createProject(userId, {
          name: form.name.trim(),
          goal: form.goal.trim() || undefined,
          deadline: form.deadline || undefined,
          color: form.color,
          dream_id: form.dream_id || undefined,
        })) as unknown as { id: string };
        section = (await createTodoSection(userId, form.name.trim())) as unknown as { id: string };
        if (section?.id && project?.id) {
          await linkSectionToProject(section.id, project.id);
        }
        setForm({ name: '', goal: '', deadline: '', color: 'indigo', dream_id: '' });
        setShowForm(false);
      } catch (err) {
        if (section?.id) {
          await supabase.from('todo_sections').delete().eq('id', section.id);
        }
        if (project?.id) {
          await deleteProject(project.id).catch(() => {});
        }
        throw err;
      }
    });
  };

  const handleDelete = (id: string) => {
    void confirmDialog('Usunąć projekt? Zadania w sekcji zostają.').then((ok) => {
      if (!ok) return;
      run(() => deleteProject(id));
    });
  };

  const handleStatusCycle = (project: any) => {
    const next = STATUS_NEXT[project.status];
    if (next === 'done') {
      setRetroProject(project);
      setRetroForm({ good: '', improve: '', rating: 0 });
    } else {
      run(() => updateProject(project.id, { status: next }));
    }
  };

  const handleRetroSubmit = async (skip = false) => {
    if (!retroProject) return;
    const patch: any = { status: 'done' };
    if (!skip) {
      if (retroForm.good.trim())    patch.retrospective_good    = retroForm.good.trim();
      if (retroForm.improve.trim()) patch.retrospective_improve = retroForm.improve.trim();
      if (retroForm.rating > 0)     patch.retrospective_rating  = retroForm.rating;
    }
    await run(() => updateProject(retroProject.id, patch));
    setRetroProject(null);
  };

  const startEditProject = (project: any) => {
    setEditingProjectId(project.id);
    setEditForm({
      name: project.name || '',
      goal: project.goal || '',
      deadline: project.deadline || '',
      color: project.color || 'indigo',
      primary_skill_id: project.primary_skill_id || '',
    });
  };

  const handleSaveProject = (project: any) => {
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
  };

  const ensureProjectSection = async (project: any, currentSection: any) => {
    if (currentSection?.id) return currentSection;
    const reusable = sections.find(s => s.name === project.name && !s.project_id);
    if (reusable?.id) {
      await linkSectionToProject(reusable.id, project.id);
      return reusable;
    }
    const section = (await createTodoSection(userId, project.name)) as any;
    await linkSectionToProject(section.id, project.id);
    return section;
  };

  const handleAddTask = (project: any, section: any) => {
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
  };

  const handleAddCheckpoint = (projectId: string) => {
    if (!newCheckpoint?.title.trim()) return;
    run(async () => {
      await createProjectCheckpoint(userId, {
        project_id: projectId,
        title: newCheckpoint.title.trim(),
        due_date: newCheckpoint.due_date || null,
      });
      setNewCheckpoint(null);
    });
  };

  const handleToggleCheckpoint = (checkpoint: ProjectCheckpoint) => {
    const done = checkpoint.status === 'done';
    run(() => updateProjectCheckpoint(checkpoint.id, {
      status: done ? 'open' : 'done',
      completed_at: done ? null : new Date().toISOString(),
    }));
  };

  const deleteCheckpoint = (id: string) => run(() => deleteProjectCheckpoint(id));
  const updateProjectStatus = (project: any, status: string) => run(() => updateProject(project.id, { status }));

  const handleToggleTask = (item: any) => {
    const next = item.status === 'done' ? 'open' : 'done';
    run(() => setTodoStatus(item, next));
  };

  const savingKpiRef = useRef<string | null>(null);
  const handleUpdateKpiValue = (kpiId: string, raw: string) => {
    if (savingKpiRef.current === kpiId) return;
    const num = parseFloat(raw);
    if (isNaN(num)) { setEditingKpiId(null); return; }
    savingKpiRef.current = kpiId;
    run(async () => {
      try {
        const { error: updErr } = await supabase.from('goal_kpis').update({ current_value: num } as any).eq('id', kpiId);
        if (updErr) throw new Error(updErr.message);
        const { error: snapErr } = await supabase.from('goal_kpi_snapshots').insert({ kpi_id: kpiId, user_id: userId, value: num });
        if (snapErr) throw new Error(snapErr.message);
        setEditingKpiId(null);
      } finally {
        savingKpiRef.current = null;
      }
    });
  };

  const handleGoalCreateConfirm = (preview: any, pillar: PillarId) => {
    const pm = PILLAR_META[pillar];
    run(async () => {
      const dream = dreams.find(d => d.life_goal === pillar);
      const project = await createProject(userId, {
        name: preview.project_name,
        goal: preview.affirmation,
        color: pm.color,
        dream_id: dream?.id,
      }) as any;
      const section = await createTodoSection(userId, preview.project_name) as any;
      if (section?.id && project?.id) await linkSectionToProject(section.id, project.id);
      for (let i = 0; i < (preview.kpis ?? []).length; i++) {
        const kpi = preview.kpis[i];
        const { error: kpiErr } = await supabase.from('goal_kpis').insert({
          user_id: userId, project_id: project.id, pillar: pillar,
          name: kpi.name || kpi.label || kpi.description || kpi.indicator || '',
          unit: kpi.unit ?? '', target: kpi.target ?? null,
          higher_is_better: true, sort_order: i,
        } as any);
        if (kpiErr) throw new Error(kpiErr.message);
      }
      for (let i = 0; i < (preview.checkpoints ?? []).length; i++) {
        const cp = preview.checkpoints[i];
        await createProjectCheckpoint(userId, {
          project_id: project.id,
          title: cp.title || cp.name || cp.description || cp.milestone || '',
          due_date: cp.due_date || null
        });
      }
      setGoalCreateOpen(false);
    });
  };

  // ── Derived data ──
  const projectPillar = useCallback((project: any): PillarId | null => {
    const lifeGoal = project.dream_id ? dreamById[project.dream_id]?.life_goal : null;
    if (PILLARS.includes(lifeGoal)) return lifeGoal as PillarId;
    return COLOR_PILLAR[project.color] ?? null;
  }, [dreamById]);

  const matchesPillarFilter = useCallback((project: any): boolean => {
    if (pillarFilter === 'all') return true;
    return projectPillar(project) === pillarFilter;
  }, [pillarFilter, projectPillar]);

  const sortByHealthAsc = useCallback((a: any, b: any) => {
    const sa = stats[a.id];
    const sb = stats[b.id];
    if (!sa || !sb) return 0;
    const ha = calculateHealthScore(a, sa, kpisByProject[a.id] ?? []);
    const hb = calculateHealthScore(b, sb, kpisByProject[b.id] ?? []);
    return ha - hb; // ascending: sickest first
  }, [stats, kpisByProject]);

  const activeFiltered = useMemo(() =>
    projects
      .filter(p => p.status === 'active' && matchesPillarFilter(p))
      .sort(sortByHealthAsc),
    [projects, matchesPillarFilter, sortByHealthAsc],
  );

  const pausedFiltered = useMemo(() =>
    projects.filter(p => p.status === 'paused' && matchesPillarFilter(p)),
    [projects, matchesPillarFilter],
  );

  const doneFiltered = useMemo(() =>
    projects.filter(p => p.status === 'done' && matchesPillarFilter(p)),
    [projects, matchesPillarFilter],
  );

  // Focus project: lowest health active project
  const focusProject = useMemo(() => {
    if (activeFiltered.length === 0) return null;
    let worst = activeFiltered[0];
    let worstScore = calculateHealthScore(worst, stats[worst.id] ?? {} as any, kpisByProject[worst.id] ?? []);
    for (const p of activeFiltered) {
      const score = calculateHealthScore(p, stats[p.id] ?? {} as any, kpisByProject[p.id] ?? []);
      if (score < worstScore) { worst = p; worstScore = score; }
    }
    // Only show Focus if health is below 60
    return worstScore < 60 ? worst : null;
  }, [activeFiltered, stats, kpisByProject]);

  const activeProjects = useMemo(
    () => projects.filter(p => p.status === 'active'),
    [projects],
  );

  const directionalGoalCount = useMemo(
    () => PILLARS.filter(pillar => Boolean((lifeGoals as any)?.[`goal_${pillar}`])).length,
    [lifeGoals],
  );

  const renderProjectCard = (project: any) => {
    const s = stats[project.id];
    const isExpanded = expandedId === project.id;
    const projectCheckpoints = checkpointsByProject[project.id] ?? [];
    const doneCheckpoints = projectCheckpoints.filter(cp => cp.status === 'done').length;

    return (
      <ProjectCard
        key={project.id}
        project={project}
        s={s}
        isExpanded={isExpanded}
        setExpandedId={setExpandedId}
        projectPillar={projectPillar}
        projectCheckpoints={projectCheckpoints}
        doneCheckpoints={doneCheckpoints}
        busy={busy}
        kpisByProject={kpisByProject}
        editingProjectId={editingProjectId}
        editForm={editForm}
        setEditForm={setEditForm}
        startEditProject={startEditProject}
        setEditingProjectId={setEditingProjectId}
        handleSaveProject={handleSaveProject}
        newCheckpoint={newCheckpoint}
        setNewCheckpoint={setNewCheckpoint}
        handleAddCheckpoint={handleAddCheckpoint}
        handleToggleCheckpoint={handleToggleCheckpoint}
        deleteCheckpoint={deleteCheckpoint}
        editingKpiId={editingKpiId}
        setEditingKpiId={setEditingKpiId}
        handleUpdateKpiValue={handleUpdateKpiValue}
        handleToggleTask={handleToggleTask}
        newTask={newTask}
        setNewTask={setNewTask}
        handleAddTask={handleAddTask}
        handleStatusCycle={handleStatusCycle}
        updateProjectStatus={updateProjectStatus}
        handleDelete={handleDelete}
        userId={userId}
        parentSkills={parentSkills}
      />
    );
  };

  if (loading) return (
    <DataStateNotice tone="loading" title="Ładowanie projektów" detail="" />
  );

  return (
    <div className="space-y-5">
      {error && <DataStateNotice tone="warning" title="Błąd" detail={error} />}

      {/* ── Header row ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-bold tracking-tight text-text-primary">Projekty</h2>
          <p className="text-[12px] text-text-muted">{activeProjects.length} aktywnych · {directionalGoalCount} kierunki</p>
        </div>
        <div className="flex items-center gap-2">
          {onNavigateTo && !(reviewOverdueDays !== null && reviewOverdueDays >= 7) && (
            <button
              onClick={() => onNavigateTo('weekly-review')}
              className="rounded-full border border-border-custom bg-surface/50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-text-muted hover:text-primary hover:border-primary/30 transition-all cursor-pointer"
            >
              Weekly Review
            </button>
          )}
          <button
            onClick={() => { setGoalCreateOpen(true); }}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[12px] font-semibold text-white shadow-md shadow-primary/20"
          >
            <Plus size={14} /> Nowy cel
          </button>
        </div>
      </div>



      {/* ── Pillar filter tabs ── */}
      <div className="flex gap-0.5 p-1 rounded-[14px] bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
        {/* All */}
        <button
          onClick={() => setPillarFilter('all')}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-[10px] transition-all ${
            pillarFilter === 'all'
              ? 'bg-background text-text-primary shadow-sm'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Wszystko
        </button>
        {PILLARS.map(p => {
          const meta = PILLAR_META[p];
          return (
            <button
              key={p}
              onClick={() => setPillarFilter(p)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-semibold rounded-[10px] transition-all ${
                pillarFilter === p
                  ? `bg-background shadow-sm ${meta.text}`
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <meta.icon size={10} />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* New project form */}
      {showForm && (
        <div className="rounded-[24px] border border-border-custom bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.07),0_2px_14px_rgba(0,0,0,0.04)] p-4 space-y-3">
          <input
            autoFocus
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
            placeholder="Nazwa projektu..."
            className="w-full bg-transparent text-[15px] font-medium text-text-primary outline-none placeholder:text-text-muted/40"
          />
          <input
            value={form.goal}
            onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
            placeholder="Cel / kim staję się realizując ten projekt..."
            className="w-full bg-transparent text-[13px] text-text-secondary outline-none placeholder:text-text-muted/35"
          />
          {dreams.filter(d => !d.is_done).length > 0 && (
            <select
              value={form.dream_id}
              onChange={e => setForm(f => ({ ...f, dream_id: e.target.value }))}
              className="w-full rounded-xl border border-border-custom/60 bg-surface-solid/50 px-3 py-2 text-[12px] font-medium text-text-secondary outline-none focus:border-primary/30 cursor-pointer"
            >
              <option value="">— Pod które marzenie? (opcjonalnie) —</option>
              {(['cialo', 'duch', 'konto'] as const).map(goal => {
                const group = dreams.filter(d => d.life_goal === goal && !d.is_done);
                if (!group.length) return null;
                const labels: Record<string, string> = { cialo: 'Ciało', duch: 'Duch', konto: 'Konto' };
                return (
                  <optgroup key={goal} label={labels[goal]}>
                    {group.map(d => (
                      <option key={d.id} value={d.id}>{d.title}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          )}
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={form.deadline}
              onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              className="flex-1 rounded-xl border border-border-custom/60 bg-surface-solid/50 px-3 py-2 text-[12px] font-medium text-text-secondary outline-none focus:border-primary/30 cursor-pointer"
            />
            {/* Color picker */}
            <div className="flex gap-1.5">
              {COLORS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setForm(f => ({ ...f, color: c.id }))}
                  className={`h-6 w-6 rounded-full ${c.dot} transition-transform ${form.color === c.id ? 'scale-125 ring-2 ring-offset-2 ring-offset-surface ring-current' : 'opacity-50 hover:opacity-80'}`}
                />
              ))}
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={busy || !form.name.trim()}
            className="w-full rounded-[12px] bg-primary py-2.5 text-[13px] font-semibold text-white disabled:opacity-40 hover:bg-primary-hover transition-colors"
          >
            Utwórz projekt i sekcję w Zadaniach
          </button>
        </div>
      )}

      {/* ── Focus card: wymaga uwagi — tylko gdy projekt nie jest widoczny jako pierwsza karta ── */}
      {focusProject && activeFiltered[0]?.id !== focusProject.id && (() => {
        const s = stats[focusProject.id] ?? {} as ProjectStats;
        const kpis = kpisByProject[focusProject.id] ?? [];
        const score = calculateHealthScore(focusProject, s, kpis);
        const level = getHealthLevel(score);
        const hc = HEALTH_COLORS[level];
        return (
          <div className={`rounded-[20px] border p-4 ${hc.bg} ${
            level === 'critical' ? 'border-rose-500/30' : 'border-amber-500/25'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Zap size={12} className={hc.text} />
              <p className={`text-[9px] font-black uppercase tracking-widest ${hc.text}`}>
                Wymaga uwagi · Health {score}
              </p>
            </div>
            <p className="text-[14px] font-bold text-text-primary">{focusProject.name}</p>
            {focusProject.goal && (
              <p className="text-[11px] text-text-muted mt-0.5 italic line-clamp-1">{focusProject.goal}</p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setExpandedId(id => id === focusProject.id ? null : focusProject.id)}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-full ${hc.bg} ${hc.text} border ${
                  level === 'critical' ? 'border-rose-500/30' : 'border-amber-500/25'
                }`}
              >
                Otwórz projekt
              </button>
              {s.openItems?.[0] && (
                <p className="text-[11px] text-text-muted truncate">→ {s.openItems[0].title}</p>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Active projects list ── */}
      {activeFiltered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-[24px] bg-surface/50">
          <FolderKanban size={28} className="text-text-muted/30 mb-3" />
          <p className="text-[14px] font-semibold text-text-secondary">Brak aktywnych projektów</p>
          <p className="text-[12px] text-text-muted mt-1">Kliknij „Nowy cel" żeby zacząć.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeFiltered.map(renderProjectCard)}
        </div>
      )}

      {/* ── Paused accordion ── */}
      {pausedFiltered.length > 0 && (
        <div className="rounded-[18px] border border-border-custom/60 overflow-hidden">
          <button
            onClick={() => setPausedOpen(o => !o)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface-solid/50 transition-colors"
          >
            {pausedOpen ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
            <span className="text-[12px] font-semibold text-text-secondary">Pauza ({pausedFiltered.length})</span>
          </button>
          {pausedOpen && (
            <div className="px-3 pb-3 space-y-3 border-t border-border-custom/30 pt-3">
              {pausedFiltered.map(renderProjectCard)}
            </div>
          )}
        </div>
      )}

      {/* ── Done accordion ── */}
      {doneFiltered.length > 0 && (
        <div className="rounded-[18px] border border-border-custom/60 overflow-hidden">
          <button
            onClick={() => setDoneOpen(o => !o)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface-solid/50 transition-colors"
          >
            {doneOpen ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
            <span className="text-[12px] font-semibold text-text-secondary">Zakończone ({doneFiltered.length})</span>
          </button>
          {doneOpen && (
            <div className="px-3 pb-3 space-y-3 border-t border-border-custom/30 pt-3">
              {doneFiltered.map(renderProjectCard)}
            </div>
          )}
        </div>
      )}

      {/* ── AI Goal Create modal ── */}
      {goalCreateOpen && (
        <GoalCreateModal
          lifeGoals={lifeGoals}
          dreams={dreams}
          busy={busy}
          onClose={() => setGoalCreateOpen(false)}
          onConfirm={handleGoalCreateConfirm}
          onError={(err) => setError(err)}
        />
      )}

      {/* ── Retrospektywa modal ── */}
      {retroProject && (
        <RetroModal
          retroProject={retroProject}
          retroForm={retroForm}
          setRetroForm={setRetroForm}
          onSubmit={handleRetroSubmit}
          busy={busy}
        />
      )}
    </div>
  );
}
