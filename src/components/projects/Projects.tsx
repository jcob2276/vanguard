import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  Flag,
  FolderKanban,
  Plus,
  Repeat2,
  Save,
  Shield,
  Trash2,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
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
import DataStateNotice from '../core/DataStateNotice';

const COLORS = [
  { id: 'indigo',  dot: 'bg-indigo-500',  bar: 'bg-indigo-500',  text: 'text-indigo-600 dark:text-indigo-400'  },
  { id: 'violet',  dot: 'bg-violet-500',  bar: 'bg-violet-500',  text: 'text-violet-600 dark:text-violet-400'  },
  { id: 'sky',     dot: 'bg-sky-500',     bar: 'bg-sky-500',     text: 'text-sky-600 dark:text-sky-400'        },
  { id: 'emerald', dot: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400'},
  { id: 'amber',   dot: 'bg-amber-500',   bar: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400'    },
  { id: 'rose',    dot: 'bg-rose-500',    bar: 'bg-rose-500',    text: 'text-rose-600 dark:text-rose-400'      },
];

const colorOf = (id: string) => COLORS.find(c => c.id === id) ?? COLORS[0];

const LIFE_GOAL_META: Record<string, { icon: typeof Shield; text: string; chip: string }> = {
  cialo: { icon: Shield, text: 'text-emerald-600 dark:text-emerald-400', chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  duch:  { icon: Zap,    text: 'text-indigo-600 dark:text-indigo-400',   chip: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'   },
  konto: { icon: Wallet, text: 'text-amber-600 dark:text-amber-400',     chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400'      },
};

const STATUS_TABS = [
  { id: 'active', label: 'Aktywne' },
  { id: 'paused', label: 'Pauza' },
  { id: 'done',   label: 'Gotowe' },
] as const;

const STATUS_NEXT: Record<string, string> = { active: 'paused', paused: 'done', done: 'active' };
const STATUS_LABEL: Record<string, string> = { active: 'Aktywny', paused: 'Pauza', done: 'Ukończony' };

export default function Projects({ session }: { session: any }) {
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
  const [statusFilter, setStatusFilter] = useState<'active' | 'paused' | 'done'>('active');
  const [form, setForm] = useState({ name: '', goal: '', deadline: '', color: 'indigo', dream_id: '' });
  const [newTask, setNewTask] = useState<{ projectId: string; title: string; recurrence: string } | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', goal: '', deadline: '', color: 'indigo' });
  const [newCheckpoint, setNewCheckpoint] = useState<{ projectId: string; title: string; due_date: string } | null>(null);

  const goTo = (view: string) => {
    localStorage.setItem('vanguard_view', view);
    window.location.href = '/';
  };

  const fetchAll = useCallback(async () => {
    try {
      const [p, s, i, c, { data: d }] = await Promise.all([
        listProjects(userId),
        listTodoSections(userId),
        listTodoItems(userId),
        listProjectCheckpoints(userId),
        supabase.from('dreams').select('id, title, category, life_goal').eq('user_id', userId),
      ]);
      setProjects(p ?? []);
      setSections(s ?? []);
      setItems(i ?? []);
      setCheckpoints(c ?? []);
      setDreams(d ?? []);
    } catch (err: any) { setError(err.message); }
  }, [userId]);

  useEffect(() => {
    (async () => { setLoading(true); await fetchAll(); setLoading(false); })();
  }, [fetchAll]);

  const run = async (fn: () => Promise<any>) => {
    setBusy(true);
    try { await fn(); await fetchAll(); }
    catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };

  // ── Stats per project ──
  const stats = useMemo(() => {
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
      const daysSince    = lastActivity ? differenceInDays(new Date(), lastActivity) : null;
      const slipping     = p.status === 'active' && (daysSince === null ? false : daysSince > 7);

      const daysLeft = p.deadline
        ? differenceInDays(new Date(p.deadline + 'T00:00:00'), new Date())
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

  // ── Handlers ──
  const handleCreate = () => {
    if (!form.name.trim()) return;
    run(async () => {
      const project = (await createProject(userId, {
        name: form.name.trim(),
        goal: form.goal.trim() || undefined,
        deadline: form.deadline || undefined,
        color: form.color,
        dream_id: form.dream_id || undefined,
      })) as any;
      const section = (await createTodoSection(userId, form.name.trim())) as any;
      if (section?.id && project?.id) {
        await linkSectionToProject(section.id, project.id);
      }
      setForm({ name: '', goal: '', deadline: '', color: 'indigo', dream_id: '' });
      setShowForm(false);
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Usunąć projekt? Zadania w sekcji zostają.')) return;
    run(() => deleteProject(id));
  };

  const handleStatusCycle = (project: any) => {
    run(() => updateProject(project.id, { status: STATUS_NEXT[project.status] }));
  };

  const startEditProject = (project: any) => {
    setEditingProjectId(project.id);
    setEditForm({
      name: project.name || '',
      goal: project.goal || '',
      deadline: project.deadline || '',
      color: project.color || 'indigo',
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

  const RECURRENCE_CYCLE = ['', 'daily', 'weekly', 'monthly'] as const;
  const RECURRENCE_LABEL: Record<string, string> = { '': 'Jednorazowe', daily: 'Codziennie', weekly: 'Co tydzień', monthly: 'Co miesiąc' };

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

  const handleToggleTask = (item: any) => {
    const next = item.status === 'done' ? 'open' : 'done';
    run(() => setTodoStatus(item, next));
  };

  const filtered = useMemo(() =>
    projects
      .filter(p => p.status === statusFilter)
      .sort((a, b) => {
        const sa = stats[a.id];
        const sb = stats[b.id];
        if (!sa || !sb) return 0;
        // overdue first (most negative daysLeft)
        const aOverdue = sa.daysLeft !== null && sa.daysLeft < 0;
        const bOverdue = sb.daysLeft !== null && sb.daysLeft < 0;
        if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
        if (aOverdue && bOverdue) return (sa.daysLeft ?? 0) - (sb.daysLeft ?? 0);
        // then slipping
        if (sa.slipping !== sb.slipping) return sa.slipping ? -1 : 1;
        // then closest deadline
        if (sa.daysLeft !== null && sb.daysLeft !== null) return sa.daysLeft - sb.daysLeft;
        if (sa.daysLeft !== null) return -1;
        if (sb.daysLeft !== null) return 1;
        // fallback: alphabetical
        return a.name.localeCompare(b.name);
      }),
    [projects, statusFilter, stats],
  );

  if (loading) return (
    <DataStateNotice tone="loading" title="Ładowanie projektów" detail="" />
  );

  return (
    <div className="space-y-5">
      {error && <DataStateNotice tone="warning" title="Błąd" detail={error} />}

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-bold tracking-tight text-text-primary">Projekty</h2>
          <p className="text-[12px] text-text-muted">{projects.filter(p => p.status === 'active').length} aktywnych</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-semibold transition-colors ${
            showForm ? 'bg-surface-solid text-text-muted' : 'bg-primary text-white shadow-md shadow-primary/20'
          }`}
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Anuluj' : 'Nowy'}
        </button>
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
            placeholder="Cel (opcjonalnie)..."
            className="w-full bg-transparent text-[13px] text-text-secondary outline-none placeholder:text-text-muted/35"
          />
          {dreams.filter(d => !d.is_done).length > 0 && (
            <select
              value={form.dream_id}
              onChange={e => setForm(f => ({ ...f, dream_id: e.target.value }))}
              className="w-full rounded-xl border border-border-custom/60 bg-surface-solid/50 px-3 py-2 text-[12px] font-medium text-text-secondary outline-none focus:border-primary/30 cursor-pointer"
            >
              <option value="">— Pod który cel? (opcjonalnie) —</option>
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

      {/* Status tabs */}
      <div className="flex gap-0.5 p-1 rounded-[14px] bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`flex-1 py-1.5 text-[12px] font-semibold rounded-[10px] transition-all ${
              statusFilter === tab.id
                ? 'bg-background text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Project cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-[24px] bg-surface/50">
          <FolderKanban size={28} className="text-text-muted/30 mb-3" />
          <p className="text-[14px] font-semibold text-text-secondary">Brak projektów</p>
          <p className="text-[12px] text-text-muted mt-1">Kliknij „Nowy" żeby zacząć.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(project => {
            const s = stats[project.id];
            const col = colorOf(project.color);
            const isExpanded = expandedId === project.id;
            const projectCheckpoints = checkpointsByProject[project.id] ?? [];
            const doneCheckpoints = projectCheckpoints.filter(cp => cp.status === 'done').length;

            return (
              <div
                key={project.id}
                className="rounded-[24px] border border-border-custom bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.07),0_2px_14px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)]"
              >
                {/* Card header */}
                <button
                  className="w-full text-left p-4"
                  onClick={() => setExpandedId(p => p === project.id ? null : project.id)}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${col.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-semibold text-text-primary leading-tight">{project.name}</span>
                        {s.slipping && (
                          <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            <AlertTriangle size={9} /> Slipuje {s.daysSince}d
                          </span>
                        )}
                      </div>
                      {project.goal && (
                        <p className="mt-0.5 text-[12px] text-text-muted line-clamp-1">{project.goal}</p>
                      )}
                      {project.dream_id && dreamById[project.dream_id] && (() => {
                        const dream = dreamById[project.dream_id];
                        const goalMeta = dream.life_goal ? LIFE_GOAL_META[dream.life_goal] : null;
                        const GoalIcon = goalMeta?.icon;
                        return (
                          <p className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-violet-500 dark:text-violet-400">
                            {GoalIcon && <GoalIcon size={9} className={`shrink-0 ${goalMeta!.text}`} />}
                            <span>✦</span>
                            <span className="truncate">{dream.title}</span>
                          </p>
                        );
                      })()}
                      {!isExpanded && s.openItems[0] && (
                        <p className="mt-1 text-[11px] text-text-muted/60 line-clamp-1">
                          → {s.openItems[0].title}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {s.daysLeft !== null && (
                        <span className={`text-[11px] font-semibold ${
                          s.daysLeft < 0 ? 'text-rose-500' : s.daysLeft <= 14 ? 'text-amber-500' : 'text-text-muted'
                        }`}>
                          {s.daysLeft < 0 ? `${Math.abs(s.daysLeft)}d po` : `${s.daysLeft}d`}
                        </span>
                      )}
                      {isExpanded ? <ChevronUp size={15} className="text-text-muted" /> : <ChevronDown size={15} className="text-text-muted" />}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-text-muted">{s.doneItems.length}/{s.total} zadań</span>
                      <span className={`text-[11px] font-semibold ${col.text}`}>{s.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-border-custom/50">
                      <div
                        className={`h-full rounded-full transition-all ${col.bar}`}
                        style={{ width: `${s.progress}%` }}
                      />
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-border-custom/30 px-4 pb-4 pt-3 space-y-3">
                    {/* Project metadata */}
                    <div className="rounded-[14px] border border-border-custom/50 bg-surface-solid/30 p-3">
                      {editingProjectId === project.id ? (
                        <div className="space-y-3">
                          <input
                            value={editForm.name}
                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full bg-transparent text-[14px] font-semibold text-text-primary outline-none placeholder:text-text-muted/40"
                            placeholder="Nazwa projektu"
                          />
                          <textarea
                            value={editForm.goal}
                            onChange={e => setEditForm(f => ({ ...f, goal: e.target.value }))}
                            rows={2}
                            className="w-full resize-none rounded-[10px] border border-border-custom/50 bg-background/60 px-3 py-2 text-[12px] text-text-secondary outline-none focus:border-primary/30"
                            placeholder="Cel / opis projektu..."
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={editForm.deadline}
                              onChange={e => setEditForm(f => ({ ...f, deadline: e.target.value }))}
                              className="min-w-0 flex-1 rounded-[10px] border border-border-custom/50 bg-background/60 px-3 py-2 text-[12px] font-medium text-text-secondary outline-none focus:border-primary/30"
                            />
                            <div className="flex gap-1">
                              {COLORS.map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => setEditForm(f => ({ ...f, color: c.id }))}
                                  className={`h-6 w-6 rounded-full ${c.dot} transition-transform ${editForm.color === c.id ? 'scale-110 ring-2 ring-offset-2 ring-offset-surface ring-current' : 'opacity-45 hover:opacity-80'}`}
                                  title={c.id}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingProjectId(null)}
                              className="rounded-full bg-surface-solid px-3 py-1.5 text-[11px] font-semibold text-text-muted hover:text-text-secondary"
                            >
                              Anuluj
                            </button>
                            <button
                              onClick={() => handleSaveProject(project)}
                              disabled={busy || !editForm.name.trim()}
                              className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
                            >
                              <Save size={11} /> Zapisz
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Szczegóły projektu</p>
                            {project.goal ? (
                              <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">{project.goal}</p>
                            ) : (
                              <p className="mt-1 text-[12px] text-text-muted/50">Brak opisu celu.</p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${
                                project.deadline
                                  ? s.daysLeft !== null && s.daysLeft < 0
                                    ? 'bg-rose-500/10 text-rose-500'
                                    : 'bg-primary/10 text-primary'
                                  : 'bg-surface-solid text-text-muted'
                              }`}>
                                <CalendarDays size={11} />
                                {project.deadline
                                  ? `${format(new Date(project.deadline + 'T00:00:00'), 'dd.MM.yyyy')}${s.daysLeft !== null ? ` · ${s.daysLeft < 0 ? `${Math.abs(s.daysLeft)}d po` : `${s.daysLeft}d`}` : ''}`
                                  : 'Brak daty zakończenia'}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full bg-surface-solid px-2 py-1 text-[10px] font-semibold text-text-muted">
                                <Flag size={11} /> {doneCheckpoints}/{projectCheckpoints.length} checkpointów
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => startEditProject(project)}
                            className="rounded-full p-2 text-text-muted hover:bg-surface-solid hover:text-text-primary"
                            title="Edytuj projekt"
                          >
                            <Edit3 size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Checkpoints */}
                    <div className="rounded-[14px] border border-border-custom/50 bg-surface-solid/20 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Checkpointy</p>
                        {newCheckpoint?.projectId !== project.id && (
                          <button
                            onClick={() => setNewCheckpoint({ projectId: project.id, title: '', due_date: '' })}
                            className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary"
                          >
                            <Plus size={11} /> Dodaj
                          </button>
                        )}
                      </div>
                      {projectCheckpoints.length > 0 && (
                        <div className="space-y-1">
                          {projectCheckpoints.map(cp => (
                            <div key={cp.id} className="flex items-center gap-2 rounded-[10px] px-1.5 py-1.5 hover:bg-background/40">
                              <button
                                onClick={() => handleToggleCheckpoint(cp)}
                                className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${
                                  cp.status === 'done' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border-custom text-transparent'
                                }`}
                              >
                                <Check size={10} strokeWidth={3} />
                              </button>
                              <span className={`min-w-0 flex-1 truncate text-[12px] ${cp.status === 'done' ? 'text-text-muted line-through' : 'text-text-primary'}`}>{cp.title}</span>
                              {cp.due_date && (
                                <span className="shrink-0 text-[10px] font-semibold text-text-muted">
                                  {format(new Date(cp.due_date + 'T00:00:00'), 'dd.MM')}
                                </span>
                              )}
                              <button
                                onClick={() => run(() => deleteProjectCheckpoint(cp.id))}
                                className="shrink-0 rounded-full p-1 text-text-muted/35 hover:bg-rose-500/10 hover:text-rose-500"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {newCheckpoint?.projectId === project.id ? (
                        <div className="rounded-[12px] border border-border-custom/50 bg-background/50 p-2 space-y-2">
                          <input
                            autoFocus
                            value={newCheckpoint!.title}
                            onChange={e => setNewCheckpoint(cp => cp ? { ...cp, title: e.target.value } : cp)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); handleAddCheckpoint(project.id); }
                              if (e.key === 'Escape') setNewCheckpoint(null);
                            }}
                            className="w-full bg-transparent text-[12px] text-text-primary outline-none placeholder:text-text-muted/40"
                            placeholder="Nazwa checkpointu..."
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={newCheckpoint!.due_date}
                              onChange={e => setNewCheckpoint(cp => cp ? { ...cp, due_date: e.target.value } : cp)}
                              className="min-w-0 flex-1 rounded-[9px] border border-border-custom/50 bg-surface px-2.5 py-1.5 text-[11px] text-text-secondary outline-none"
                            />
                            <button onClick={() => setNewCheckpoint(null)} className="rounded-full p-1.5 text-text-muted hover:text-text-secondary">
                              <X size={13} />
                            </button>
                            <button
                              onClick={() => handleAddCheckpoint(project.id)}
                              disabled={!newCheckpoint!.title.trim() || busy}
                              className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-30"
                            >
                              Dodaj
                            </button>
                          </div>
                        </div>
                      ) : projectCheckpoints.length === 0 ? (
                        <p className="text-[12px] text-text-muted/45">Brak checkpointów.</p>
                      ) : null}
                    </div>

                    {/* Task list */}
                    <div className="space-y-1">
                      {s.openItems.map((item: any) => (
                        <button
                          key={item.id}
                          onClick={() => handleToggleTask(item)}
                          className="flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 hover:bg-surface-solid/60 transition-colors text-left"
                        >
                          <div className={`h-[18px] w-[18px] shrink-0 rounded-full border-2 flex items-center justify-center transition-all border-border-custom`}>
                            <div className="h-1.5 w-1.5 rounded-full bg-transparent" />
                          </div>
                          <span className="flex-1 truncate text-[13px] text-text-primary">{item.title}</span>
                          {item.recurrence && <Repeat2 size={10} className="shrink-0 text-violet-400" />}
                        </button>
                      ))}
                      {s.doneItems.slice(0, 2).map((item: any) => (
                        <button
                          key={item.id}
                          onClick={() => handleToggleTask(item)}
                          className="flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 hover:bg-surface-solid/60 transition-colors text-left opacity-40"
                        >
                          <div className="h-[18px] w-[18px] shrink-0 rounded-full bg-emerald-500 flex items-center justify-center">
                            <Check size={10} className="text-white" strokeWidth={3} />
                          </div>
                          <span className="flex-1 truncate text-[13px] line-through text-text-muted">{item.title}</span>
                        </button>
                      ))}
                      {s.total === 0 && newTask?.projectId !== project.id && (
                        <p className="text-[12px] text-text-muted/40 px-2 py-1">Brak zadań. Dodaj pierwsze poniżej.</p>
                      )}
                    </div>

                    {/* Inline new task */}
                    {newTask?.projectId === project.id ? (
                      <div className="rounded-[12px] border border-border-custom/50 bg-surface-solid/40 px-3 py-2 space-y-2">
                        <input
                          autoFocus
                          value={newTask!.title}
                          onChange={e => setNewTask(t => t ? { ...t, title: e.target.value } : t)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); handleAddTask(project, s.section); }
                            if (e.key === 'Escape') setNewTask(null);
                          }}
                          placeholder="Nowe zadanie..."
                          className="w-full bg-transparent text-[13px] text-text-primary outline-none placeholder:text-text-muted/40"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setNewTask(t => t ? { ...t, recurrence: RECURRENCE_CYCLE[(RECURRENCE_CYCLE.indexOf(t.recurrence as any) + 1) % RECURRENCE_CYCLE.length] } : t)}
                            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${newTask!.recurrence ? 'bg-violet-500/15 text-violet-500' : 'bg-surface-solid text-text-muted hover:text-text-secondary'}`}
                          >
                            <Repeat2 size={10} /> {RECURRENCE_LABEL[newTask!.recurrence]}
                          </button>
                          <div className="flex-1" />
                          <button onClick={() => setNewTask(null)} className="text-text-muted hover:text-text-secondary">
                            <X size={13} />
                          </button>
                          <button
                            onClick={() => handleAddTask(project, s.section)}
                            disabled={!newTask!.title.trim() || busy}
                            className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-30"
                          >
                            Dodaj
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setNewTask({ projectId: project.id, title: '', recurrence: '' })}
                        className={`flex w-full items-center gap-2 rounded-[12px] border border-dashed border-border-custom/60 px-3 py-2 text-[12px] font-medium text-text-muted hover:text-text-secondary hover:border-border-custom transition-colors`}
                      >
                        <Plus size={13} /> Dodaj zadanie
                      </button>
                    )}

                    {/* Footer actions */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <div className="flex gap-1">
                        {(['active', 'paused', 'done'] as const).map(s => (
                          <button
                            key={s}
                            disabled={busy}
                            onClick={() => { if (project.status !== s) run(() => updateProject(project.id, { status: s })); }}
                            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                              project.status === s
                                ? 'bg-primary/15 text-primary'
                                : 'bg-surface-solid text-text-muted hover:text-text-secondary'
                            }`}
                          >
                            {STATUS_LABEL[s]}
                          </button>
                        ))}
                      </div>
                      <div className="flex-1" />
                      <button
                        onClick={() => handleDelete(project.id)}
                        disabled={busy}
                        className="rounded-full p-1.5 text-text-muted/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
