import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
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
  TrendingUp,
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

const PILLAR_META = {
  cialo: { label: 'Ciało', icon: Shield, text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-500', color: 'emerald' },
  duch:  { label: 'Duch',  icon: Zap,    text: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30',  dot: 'bg-indigo-500',  color: 'indigo' },
  konto: { label: 'Konto', icon: Wallet, text: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   dot: 'bg-amber-500',   color: 'amber'  },
} as const;

const GOAL_QUESTIONS = [
  { key: 'goal',           q: 'Jaki jest Twój cel?',               hint: 'Konkretny wynik + data. Np. "50k PLN na koncie do 01.10.2026"' },
  { key: 'why',            q: 'Po co Ci to?',                      hint: 'Dlaczego to ważne? Co się zmieni kiedy osiągniesz?' },
  { key: 'milestones',     q: 'Co musi się stać po drodze?',       hint: 'Wymień 3–4 etapy które musisz przejść' },
  { key: 'blockers',       q: 'Dlaczego może się nie udać?',       hint: 'Jakie są ryzyka? Co już próbowałeś i nie wyszło?' },
  { key: 'weekly_actions', q: 'Co robisz co tydzień żeby to osiągnąć?', hint: 'Konkretne powtarzalne działania — to będą Twoje KPI' },
] as const;


const STATUS_TABS = [
  { id: 'active', label: 'Aktywne' },
  { id: 'paused', label: 'Pauza' },
  { id: 'done',   label: 'Gotowe' },
] as const;

const STATUS_NEXT: Record<string, string> = { active: 'paused', paused: 'done', done: 'active' };
const STATUS_LABEL: Record<string, string> = { active: 'Aktywny', paused: 'Pauza', done: 'Ukończony' };

const PILLARS = ['cialo', 'duch', 'konto'] as const;
type PillarId = typeof PILLARS[number];

export default function Projects({ session, onNavigateTo, reviewOverdueDays = null }: { session: any; onNavigateTo?: (view: string) => void; reviewOverdueDays?: number | null }) {
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
  const [retroProject, setRetroProject] = useState<any | null>(null);
  const [retroForm, setRetroForm] = useState({ good: '', improve: '', rating: 0 });

  const [lifeGoals, setLifeGoals] = useState<any>(null);
  const [kpis, setKpis] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const [kpiInputVal, setKpiInputVal] = useState('');
  const [kpiUpdateOpen, setKpiUpdateOpen] = useState(false);
  const [kpiUpdateIdx, setKpiUpdateIdx] = useState(0);
  const [kpiUpdateVal, setKpiUpdateVal] = useState('');
  const [kpiUpdateValues, setKpiUpdateValues] = useState<Record<string, number>>({});
  const [goalCreateOpen, setGoalCreateOpen] = useState(false);
  const [goalCreateStep, setGoalCreateStep] = useState<'pillar' | number | 'loading' | 'preview'>('pillar');
  const [goalCreatePillar, setGoalCreatePillar] = useState<PillarId | ''>('');
  const [goalCreateAnswers, setGoalCreateAnswers] = useState({ goal: '', why: '', milestones: '', blockers: '', weekly_actions: '' });
  const [goalCreatePreview, setGoalCreatePreview] = useState<any>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [p, s, i, c, { data: d }, { data: lg }, { data: kpiData }, { data: snapData }] = await Promise.all([
        listProjects(userId),
        listTodoSections(userId),
        listTodoItems(userId),
        listProjectCheckpoints(userId),
        supabase.from('dreams').select('id, title, category, life_goal').eq('user_id', userId),
        supabase.from('life_goals').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('goal_kpis').select('*').eq('user_id', userId).order('sort_order'),
        (supabase as any).from('goal_kpi_snapshots').select('kpi_id, value, recorded_at').eq('user_id', userId).order('recorded_at', { ascending: false }).limit(100),
      ]);
      setProjects(p ?? []);
      setSections(s ?? []);
      setItems(i ?? []);
      setCheckpoints(c ?? []);
      setDreams(d ?? []);
      setLifeGoals(lg ?? null);
      setKpis(kpiData ?? []);
      setSnapshots(snapData ?? []);
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

  const kpisByProject = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    kpis.forEach(k => {
      if (!k.project_id) return;
      if (!grouped[k.project_id]) grouped[k.project_id] = [];
      grouped[k.project_id].push(k);
    });
    return grouped;
  }, [kpis]);

  const lastSnapshotByKpi = useMemo(() => {
    const map: Record<string, any> = {};
    snapshots.forEach(s => { if (!map[s.kpi_id]) map[s.kpi_id] = s; });
    return map;
  }, [snapshots]);


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

  const handleUpdateKpiValue = (kpiId: string, raw: string) => {
    const num = parseFloat(raw);
    if (isNaN(num)) { setEditingKpiId(null); return; }
    run(async () => {
      await supabase.from('goal_kpis').update({ current_value: num } as any).eq('id', kpiId);
      await (supabase as any).from('goal_kpi_snapshots').insert({ kpi_id: kpiId, user_id: userId, value: num });
      setEditingKpiId(null);
    });
  };

  const handleGoalCreateNext = (currentVal: string) => {
    const step = goalCreateStep as number;
    const key = GOAL_QUESTIONS[step].key;
    setGoalCreateAnswers(a => ({ ...a, [key]: currentVal }));
    if (step < GOAL_QUESTIONS.length - 1) {
      setGoalCreateStep(step + 1);
    } else {
      handleGoalCreateSubmit({ ...goalCreateAnswers, [key]: currentVal });
    }
  };

  const handleGoalCreateSubmit = async (answers: typeof goalCreateAnswers) => {
    setGoalCreateStep('loading');
    try {
      const { data, error } = await supabase.functions.invoke('vanguard-goal-create', {
        body: { answers, pillar: goalCreatePillar, userName: 'Jakub' },
      });
      if (error) throw error;
      setGoalCreatePreview(data);
      setGoalCreateStep('preview');
    } catch (err: any) {
      setError('AI: ' + err.message);
      setGoalCreateStep(GOAL_QUESTIONS.length - 1);
    }
  };

  const handleGoalCreateConfirm = () => {
    if (!goalCreatePreview || !goalCreatePillar) return;
    const pm = PILLAR_META[goalCreatePillar];
    run(async () => {
      const dream = dreams.find(d => d.life_goal === goalCreatePillar);
      const project = await createProject(userId, {
        name: goalCreatePreview.project_name,
        goal: goalCreatePreview.affirmation,
        color: pm.color,
        dream_id: dream?.id,
      }) as any;
      const section = await createTodoSection(userId, goalCreatePreview.project_name) as any;
      if (section?.id && project?.id) await linkSectionToProject(section.id, project.id);
      for (let i = 0; i < (goalCreatePreview.kpis ?? []).length; i++) {
        const kpi = goalCreatePreview.kpis[i];
        await supabase.from('goal_kpis').insert({
          user_id: userId, project_id: project.id, pillar: goalCreatePillar,
          name: kpi.name, unit: kpi.unit ?? '', target: kpi.target ?? null,
          higher_is_better: true, sort_order: i,
        } as any);
      }
      for (let i = 0; i < (goalCreatePreview.checkpoints ?? []).length; i++) {
        const cp = goalCreatePreview.checkpoints[i];
        await createProjectCheckpoint(userId, { project_id: project.id, title: cp.title, due_date: cp.due_date || null });
      }
      setGoalCreateOpen(false);
      setGoalCreateStep('pillar');
      setGoalCreateAnswers({ goal: '', why: '', milestones: '', blockers: '', weekly_actions: '' });
      setGoalCreatePreview(null);
      setGoalCreatePillar('');
    });
  };

  const handleKpiUpdateNext = () => {
    const kpi = activeKpis[kpiUpdateIdx];
    const num = parseFloat(kpiUpdateVal);
    const newValues = isNaN(num) ? kpiUpdateValues : { ...kpiUpdateValues, [kpi.id]: num };

    if (kpiUpdateIdx < activeKpis.length - 1) {
      setKpiUpdateValues(newValues);
      setKpiUpdateIdx(i => i + 1);
      setKpiUpdateVal('');
    } else {
      run(async () => {
        for (const [kpiId, val] of Object.entries(newValues)) {
          await supabase.from('goal_kpis').update({ current_value: val } as any).eq('id', kpiId);
          await (supabase as any).from('goal_kpi_snapshots').insert({ kpi_id: kpiId, user_id: userId, value: val });
        }
        setKpiUpdateOpen(false);
        setKpiUpdateIdx(0);
        setKpiUpdateVal('');
        setKpiUpdateValues({});
      });
    }
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

  const activeProjects = useMemo(
    () => projects.filter(p => p.status === 'active'),
    [projects],
  );

  const activeKpis = useMemo(() =>
    kpis.filter(k => k.project_id && activeProjects.some(p => p.id === k.project_id)),
    [kpis, activeProjects],
  );

  const directionalGoalCount = useMemo(
    () => PILLARS.filter(pillar => Boolean((lifeGoals as any)?.[`goal_${pillar}`])).length,
    [lifeGoals],
  );

  const projectPillar = useCallback((project: any): PillarId | null => {
    const lifeGoal = project.dream_id ? dreamById[project.dream_id]?.life_goal : null;
    return PILLARS.includes(lifeGoal) ? lifeGoal : null;
  }, [dreamById]);

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
          <p className="text-[12px] text-text-muted">{activeProjects.length} aktywnych · {directionalGoalCount} kierunki</p>
        </div>
        <div className="flex items-center gap-2">
          {activeKpis.length > 0 && (
            <button
              onClick={() => { setKpiUpdateOpen(true); setKpiUpdateIdx(0); setKpiUpdateVal(''); setKpiUpdateValues({}); }}
              className="flex items-center gap-1.5 rounded-full border border-border-custom bg-surface/50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-text-muted hover:text-primary hover:border-primary/30 transition-all cursor-pointer"
            >
              <TrendingUp size={11} /> KPI
            </button>
          )}
          {onNavigateTo && !(reviewOverdueDays !== null && reviewOverdueDays >= 7) && (
            <button
              onClick={() => onNavigateTo('weekly-review')}
              className="rounded-full border border-border-custom bg-surface/50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-text-muted hover:text-primary hover:border-primary/30 transition-all cursor-pointer"
            >
              Weekly Review
            </button>
          )}
          <button
            onClick={() => { setGoalCreateOpen(true); setGoalCreateStep('pillar'); }}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[12px] font-semibold text-white shadow-md shadow-primary/20"
          >
            <Plus size={14} /> Nowy cel
          </button>
        </div>
      </div>

      {/* Weekly Review overdue banner */}
      {onNavigateTo && reviewOverdueDays !== null && reviewOverdueDays >= 7 && (
        <button
          onClick={() => onNavigateTo('weekly-review')}
          className="w-full flex items-center gap-3 rounded-[20px] border border-rose-500/25 bg-rose-500/8 px-4 py-3.5 text-left cursor-pointer hover:bg-rose-500/12 transition-all group"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15">
            <TrendingUp size={16} className="text-rose-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">
              {reviewOverdueDays >= 100 ? 'Nigdy nie zrobiony' : `${reviewOverdueDays} dni bez przeglądu`}
            </p>
            <p className="text-[13px] font-bold text-text-primary leading-tight mt-0.5">
              Czas na Weekly Review KPI
            </p>
          </div>
          <AlertCircle size={16} className="shrink-0 text-rose-500 group-hover:scale-110 transition-transform" />
        </button>
      )}

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
          <p className="text-[12px] text-text-muted mt-1">Kliknij „Nowy cel" żeby zacząć.</p>
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[15px] font-semibold text-text-primary leading-tight">{project.name}</span>
                        {(() => {
                          const pillar = projectPillar(project);
                          if (!pillar) return null;
                          const meta = PILLAR_META[pillar];
                          return (
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
                              {meta.label}
                            </span>
                          );
                        })()}
                        {s.slipping && (
                          <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            <AlertTriangle size={9} /> Slipuje {s.daysSince}d
                          </span>
                        )}
                      </div>
                      {project.goal && (
                        <p className="mt-0.5 text-[12px] text-text-muted line-clamp-1">{project.goal}</p>
                      )}
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

                  {/* KPI mini-display */}
                  {(kpisByProject[project.id] ?? []).length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
                      {(kpisByProject[project.id] ?? []).map(kpi => {
                        const pct = kpi.target != null && kpi.current_value != null
                          ? Math.min(100, Math.round((kpi.current_value / kpi.target) * 100)) : null;
                        return (
                          <div key={kpi.id} className="flex items-center gap-1.5 min-w-0">
                            <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${col.dot}`} />
                            <span className="text-[10px] text-text-muted truncate">{kpi.name}</span>
                            <span className={`text-[10px] font-bold ${col.text}`}>
                              {kpi.current_value != null ? kpi.current_value : '—'}
                              {kpi.unit ? ` ${kpi.unit}` : ''}
                              {kpi.target != null && <span className="font-normal text-text-muted/60"> / {kpi.target}</span>}
                            </span>
                            {pct !== null && (
                              <span className="text-[9px] text-text-muted/50">{pct}%</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
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
                        {(['active', 'paused', 'done'] as const).map(st => (
                          <button
                            key={st}
                            disabled={busy}
                            onClick={() => {
                              if (project.status === st) return;
                              if (st === 'done') handleStatusCycle(project);
                              else run(() => updateProject(project.id, { status: st }));
                            }}
                            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                              project.status === st
                                ? 'bg-primary/15 text-primary'
                                : 'bg-surface-solid text-text-muted hover:text-text-secondary'
                            }`}
                          >
                            {STATUS_LABEL[st]}
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

      {/* ── AI Goal Create modal ── */}
      {goalCreateOpen && (() => {
        const isPillar = goalCreateStep === 'pillar';
        const isLoading = goalCreateStep === 'loading';
        const isPreview = goalCreateStep === 'preview';
        const qIdx = typeof goalCreateStep === 'number' ? goalCreateStep : 0;
        const q = GOAL_QUESTIONS[qIdx];
        const pm = goalCreatePillar ? PILLAR_META[goalCreatePillar] : null;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-[28px] border border-border-custom bg-surface shadow-2xl overflow-hidden">

              {/* Header strip */}
              <div className={`px-5 py-3 flex items-center justify-between ${pm ? pm.bg : 'bg-surface-solid/50'}`}>
                <div className="flex items-center gap-2">
                  {pm && <pm.icon size={13} className={pm.text} />}
                  <span className={`text-[10px] font-black uppercase tracking-widest ${pm ? pm.text : 'text-text-muted'}`}>
                    {pm ? pm.label : 'Nowy cel'}
                  </span>
                </div>
                <button onClick={() => setGoalCreateOpen(false)} className="text-text-muted hover:text-text-primary">
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-5">

                {/* PILLAR SELECTION */}
                {isPillar && (
                  <div className="space-y-3">
                    <p className="text-[18px] font-black text-text-primary leading-tight">Pod który filar?</p>
                    <div className="space-y-2">
                      {PILLARS.map(p => {
                        const meta = PILLAR_META[p];
                        const lg = (lifeGoals as any)?.[`goal_${p}`];
                        return (
                          <button
                            key={p}
                            onClick={() => { setGoalCreatePillar(p); setGoalCreateStep(0); }}
                            className={`w-full text-left rounded-[16px] border p-3.5 transition-all hover:scale-[1.01] ${meta.border} ${meta.bg}`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <meta.icon size={13} className={meta.text} />
                              <span className={`text-[10px] font-black uppercase tracking-widest ${meta.text}`}>{meta.label}</span>
                            </div>
                            {lg && <p className="text-[12px] text-text-secondary leading-snug line-clamp-1">{lg}</p>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* QUESTIONS */}
                {typeof goalCreateStep === 'number' && (() => {
                  const currentKey = q.key as keyof typeof goalCreateAnswers;
                  const val = goalCreateAnswers[currentKey];
                  return (
                    <div className="space-y-4">
                      {/* Progress dots */}
                      <div className="flex gap-1.5">
                        {GOAL_QUESTIONS.map((_, i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= qIdx ? (pm?.dot ?? 'bg-primary') : 'bg-border-custom/50'}`} />
                        ))}
                      </div>
                      <p className="text-[19px] font-black text-text-primary leading-snug">{q.q}</p>
                      <textarea
                        autoFocus
                        rows={3}
                        value={val}
                        onChange={e => setGoalCreateAnswers(a => ({ ...a, [currentKey]: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey && val.trim()) {
                            e.preventDefault();
                            handleGoalCreateNext(val);
                          }
                        }}
                        placeholder={q.hint}
                        className="w-full resize-none rounded-[14px] border border-border-custom bg-surface-solid/40 px-4 py-3 text-[14px] text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/35 leading-relaxed"
                      />
                      <p className="text-[10px] text-text-muted/60">Enter = dalej · Shift+Enter = nowa linia</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setGoalCreateStep(qIdx > 0 ? qIdx - 1 : 'pillar')}
                          className="rounded-xl border border-border-custom px-4 py-3 text-[12px] font-bold text-text-muted hover:text-text-primary transition-colors"
                        >
                          ← Wstecz
                        </button>
                        <button
                          onClick={() => { if (val.trim()) handleGoalCreateNext(val); }}
                          disabled={!val.trim()}
                          className="flex-1 rounded-xl bg-primary py-3 text-[12px] font-bold text-white disabled:opacity-30 transition-opacity"
                        >
                          {qIdx < GOAL_QUESTIONS.length - 1 ? 'Dalej →' : 'Generuj cel ✦'}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* LOADING */}
                {isLoading && (
                  <div className="flex flex-col items-center justify-center py-8 space-y-3">
                    <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <p className="text-[14px] font-semibold text-text-secondary">AI analizuje Twój cel...</p>
                    <p className="text-[11px] text-text-muted">Generuje projekt, KPI i kamienie milowe</p>
                  </div>
                )}

                {/* PREVIEW */}
                {isPreview && goalCreatePreview && pm && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-1">Projekt</p>
                      <p className="text-[18px] font-black text-text-primary">{goalCreatePreview.project_name}</p>
                      {goalCreatePreview.affirmation && (
                        <p className="text-[12px] text-text-secondary mt-1 leading-snug italic">"{goalCreatePreview.affirmation}"</p>
                      )}
                    </div>
                    {(goalCreatePreview.kpis ?? []).length > 0 && (
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-2">KPI (leading indicators)</p>
                        <div className="space-y-1.5">
                          {goalCreatePreview.kpis.map((kpi: any, i: number) => (
                            <div key={i} className={`flex items-center gap-2 rounded-[10px] px-3 py-2 ${pm.bg}`}>
                              <div className={`h-1.5 w-1.5 rounded-full ${pm.dot}`} />
                              <span className="text-[12px] font-semibold text-text-primary flex-1">{kpi.name || kpi.label || kpi.description || kpi.indicator || ''}</span>
                              {kpi.target != null && (
                                <span className={`text-[11px] font-bold ${pm.text}`}>/ {kpi.target} {kpi.unit}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(goalCreatePreview.checkpoints ?? []).length > 0 && (
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-2">Kamienie milowe</p>
                        <div className="space-y-1.5">
                          {goalCreatePreview.checkpoints.map((cp: any, i: number) => (
                            <div key={i} className="flex items-start gap-2.5">
                              <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-border-custom mt-0.5" />
                              <span className="text-[12px] text-text-secondary flex-1 min-w-0">{cp.title || cp.name || cp.description || cp.milestone || ''}</span>
                              {cp.due_date && <span className="text-[10px] text-text-muted shrink-0">{(() => { const [, m, d] = cp.due_date.split('-'); return `${d}.${m}`; })()}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setGoalCreateStep(GOAL_QUESTIONS.length - 1)}
                        className="rounded-xl border border-border-custom px-4 py-3 text-[12px] font-bold text-text-muted hover:text-text-primary"
                      >
                        Zmień
                      </button>
                      <button
                        onClick={handleGoalCreateConfirm}
                        disabled={busy}
                        className="flex-1 rounded-xl bg-primary py-3 text-[12px] font-bold text-white disabled:opacity-50"
                      >
                        Utwórz projekt ✦
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        );
      })()}

      {/* ── KPI Update modal ── */}
      {kpiUpdateOpen && activeKpis.length > 0 && (() => {
        const kpi = activeKpis[kpiUpdateIdx];
        const last = lastSnapshotByKpi[kpi.id];
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-[28px] border border-border-custom bg-surface shadow-xl p-5 space-y-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-1">
                  KPI {kpiUpdateIdx + 1} / {activeKpis.length}
                </p>
                <h3 className="text-[17px] font-black text-text-primary leading-tight">{kpi.name}</h3>
                <div className="flex items-center gap-3 mt-1">
                  {kpi.target != null && (
                    <span className="text-[12px] text-text-muted">cel: {kpi.target} {kpi.unit}</span>
                  )}
                  {last != null && (
                    <span className="text-[12px] text-text-muted">poprzednio: {last.value}</span>
                  )}
                </div>
              </div>
              <input
                autoFocus
                type="number"
                value={kpiUpdateVal}
                onChange={e => setKpiUpdateVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleKpiUpdateNext(); }}
                placeholder={kpi.unit || 'wartość'}
                className="w-full rounded-[14px] border border-border-custom bg-surface-solid/40 px-4 py-4 text-[28px] font-black text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/30 text-center tracking-tight"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setKpiUpdateOpen(false); setKpiUpdateIdx(0); setKpiUpdateValues({}); }}
                  className="rounded-xl border border-border-custom py-3 px-4 text-[12px] font-bold text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleKpiUpdateNext}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-primary py-3 text-[12px] font-bold text-white shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {kpiUpdateIdx < activeKpis.length - 1 ? 'Dalej →' : 'Zapisz wszystko'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Retrospektywa modal ── */}
      {retroProject && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-[28px] border border-border-custom bg-surface shadow-xl p-5 space-y-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-1">Projekt ukończony</p>
              <h3 className="text-[17px] font-black text-text-primary leading-tight">{retroProject.name}</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-1">Co poszło dobrze?</label>
                <textarea
                  value={retroForm.good}
                  onChange={e => setRetroForm(f => ({ ...f, good: e.target.value }))}
                  rows={2}
                  placeholder="Najlepszy moment, decyzja, wynik..."
                  className="w-full resize-none rounded-[14px] border border-border-custom bg-surface-solid/40 px-3 py-2.5 text-[13px] text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/40"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-1">Co zrobić inaczej?</label>
                <textarea
                  value={retroForm.improve}
                  onChange={e => setRetroForm(f => ({ ...f, improve: e.target.value }))}
                  rows={2}
                  placeholder="Błąd, bloker, coś czego uniknąć..."
                  className="w-full resize-none rounded-[14px] border border-border-custom bg-surface-solid/40 px-3 py-2.5 text-[13px] text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/40"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-1.5">Ocena projektu</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      onClick={() => setRetroForm(f => ({ ...f, rating: f.rating === n ? 0 : n }))}
                      className={`flex-1 rounded-xl py-2 text-[13px] font-black transition-all cursor-pointer ${
                        retroForm.rating >= n
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-surface-solid text-text-muted hover:bg-primary/10'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleRetroSubmit(true)}
                className="flex-1 rounded-xl border border-border-custom py-3 text-[12px] font-bold text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                Pomiń
              </button>
              <button
                onClick={() => handleRetroSubmit(false)}
                disabled={busy}
                className="flex-1 rounded-xl bg-primary py-3 text-[12px] font-bold text-white shadow-sm disabled:opacity-50 cursor-pointer"
              >
                Zapisz i zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
