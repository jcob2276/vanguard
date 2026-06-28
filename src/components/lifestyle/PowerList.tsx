import { getTodayWarsaw, getYesterdayWarsaw } from '../../lib/date';
import { useEffect, useRef, useState } from 'react';
import { useHaptics } from '../../hooks/useHaptics';
import { useLifeGoals } from '../../hooks/useLifeGoals';
import { useDirectionContext } from '../../hooks/useDirectionContext';
import { supabase } from '../../lib/supabase';
import { BookOpen, Check, Link2, Search, Shield, Sparkles, Target, Upload, Wallet, Wand2, X, Zap } from 'lucide-react';
import { listTodoItems, listTodoSections, updateTodoItem } from '../../lib/todo';
import { listProjects } from '../../lib/projects';
import type { TablesUpdate } from '../../lib/database.types';
import { gatherUserContext } from '../../lib/aiContext';
import { notify } from '../../lib/notify';
import { markCheckpointDone } from '../../lib/checkpoints';
import { buildDailyPlanProposal, type DirectionContextData } from '../../lib/dailyPlanProposal';
import LifeGoalsPanel from './LifeGoalsPanel';
import PlanningCheckpointsStrip from '../shared/PlanningCheckpointsStrip';

const LIFE_GOALS_EMPTY_HINT = 'Brak celów — dodaj aktywny projekt z celem i terminem w Projekty.';

const SPHERE_SLOTS = [
  { category: 'cialo', label: 'Ciało', icon: Shield, text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', placeholder: 'Priorytet Ciało — co dziś?' },
  { category: 'duch',  label: 'Duch',  icon: Zap,    text: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  placeholder: 'Priorytet Duch — co dziś?'  },
  { category: 'konto', label: 'Konto', icon: Wallet, text: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   placeholder: 'Priorytet Konto — co dziś?' },
];

const COLOR_DOT: Record<string, string> = {
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  sky: 'bg-sky-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
};

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-emerald-500',
  normal: 'bg-blue-500',
  high: 'bg-indigo-500',
  urgent: 'bg-rose-500',
};
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function powerListDraftKey(userId: string, date: string) {
  return `vanguard_powerlist_draft_${userId}_${date}`;
}

interface TaskSlot {
  task: string;
  todoId: string | null;
  checkpointId: string | null;
  projectId: string | null;
  pinId: string | null;
}

interface PowerListDraft {
  tasks: TaskSlot[];
  yesterdayNote: string;
  savedAt: number;
}

const EMPTY_SLOT: TaskSlot = { task: '', todoId: null, checkpointId: null, projectId: null, pinId: null };

interface TodoPickerProps {
  items: any[];
  onSelect: (item: any) => void;
  onClose: () => void;
}

function TodoPicker({ items, onSelect, onClose }: TodoPickerProps) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div className="mt-1.5 overflow-hidden rounded-xl border border-primary/20 bg-surface shadow-lg">
      <div className="flex items-center gap-2 border-b border-border-custom px-3 py-2">
        <Search size={11} className="shrink-0 text-text-muted" />
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          placeholder="Szukaj zadania..."
          className="min-w-0 flex-1 bg-transparent text-[12px] font-medium text-text-primary outline-none placeholder:text-text-muted/40"
        />
      </div>
      <div className="max-h-[188px] overflow-y-auto p-1.5 space-y-0.5">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-[10px] font-medium text-text-muted">Brak otwartych zadań</p>
        ) : (
          filtered.slice(0, 20).map((item) => (
            <button
              key={item.key}
              onClick={() => { onSelect(item); onClose(); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-solid active:scale-[0.98]"
            >
              {item.badge ? (
                <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-primary">
                  <BookOpen size={8} /> {item.badge}
                </span>
              ) : (
                <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[item.priority] || 'bg-blue-500'}`} />
              )}
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-text-primary">{item.title}</span>
              {item.due_date && (
                <span className="shrink-0 text-[9px] font-bold text-text-muted">{item.due_date}</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default function PowerList({
  session,
  todayWin,
  onUpdate,
}: {
  session: any;
  todayWin: any;
  onUpdate?: (data: any) => void;
}) {
  const userId = session.user.id;
  const { displayRows: lifeGoalRows, refresh: refreshLifeGoals } = useLifeGoals(userId);
  const direction = useDirectionContext(userId);
  const today = getTodayWarsaw();
  const haptics = useHaptics();
  const weekGoals = direction.weekGoals ?? null;

  useEffect(() => {
    if (!todayWin) void refreshLifeGoals();
  }, [todayWin, refreshLifeGoals]);

  const [projectMap, setProjectMap] = useState<Record<string, { name: string; color: string | null }>>({});
  const [checkpointPrompt, setCheckpointPrompt] = useState<{ index: number; checkpointId: string; title: string } | null>(null);
  const [markingCheckpoint, setMarkingCheckpoint] = useState(false);
  // Wczorajszy dzień — wymagana refleksja przed odblokowaniem dzisiejszych 5 zwycięstw
  const [yesterdayWin, setYesterdayWin] = useState<any>(null);
  const [yesterdayNote, setYesterdayNote] = useState('');
  const yesterdayNoteRequired = !!yesterdayWin && !yesterdayWin.day_note;

  const [newTaskForm, setNewTaskForm] = useState<TaskSlot[]>([
    { ...EMPTY_SLOT },
    { ...EMPTY_SLOT },
    { ...EMPTY_SLOT },
    { ...EMPTY_SLOT },
    { ...EMPTY_SLOT },
  ]);
  const [todoItems, setTodoItems] = useState<any[]>([]);
  const [pickerSlot, setPickerSlot] = useState(-1);
  const [submitting, setSubmitting] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const draftLoaded = useRef(false);

  const fillSlotFromCheckpoint = (
    payload: { title: string; checkpointId: string; projectId: string },
    slotIndex?: number,
  ) => {
    const idx = slotIndex ?? newTaskForm.findIndex((s) => !s.task.trim());
    if (idx < 0 || idx > 4) return;
    setNewTaskForm((prev) => {
      const next = [...prev];
      next[idx] = {
        task: payload.title,
        todoId: null,
        checkpointId: payload.checkpointId,
        projectId: payload.projectId,
        pinId: null,
      };
      return next;
    });
    haptics.light();
  };

  const applyProposal = () => {
    if (direction.loading) return;
    const ctx: DirectionContextData = {
      weekStart: direction.weekStart ?? today,
      weekGoals: direction.weekGoals ?? { intention: null, commitment: null, cialo: null, duch: null, konto: null },
      checkpoints: direction.checkpoints,
      mustPins: direction.mustPins ?? [],
      openMustPins: direction.openMustPins ?? [],
      urgentTodos: direction.urgentTodos ?? [],
      activeProjects: direction.activeProjects ?? [],
      powerListStats: direction.powerListStats ?? { daysLogged: 0, daysWithWins: 0, tasksDone: 0, tasksSet: 0 },
      sprintGoal: direction.sprintGoal ?? null,
      sprintLabel: direction.sprintLabel ?? null,
      focus: direction.focus ?? { skillId: null, skillLabel: null, subskillLabel: null, targetLevel: null },
      weekCheckpointsDone: direction.weekCheckpointsDone ?? 0,
      weekCheckpointsDue: direction.weekCheckpointsDue ?? 0,
      skills: direction.skills ?? [],
    };
    if (ctx.checkpoints.all.length === 0 && ctx.openMustPins.length === 0 && !ctx.weekGoals.cialo && !ctx.weekGoals.duch && !ctx.weekGoals.konto) {
      notify('Brak danych do propozycji — uzupełnij tydzień lub checkpointy.', 'error');
      return;
    }
    const proposal = buildDailyPlanProposal(ctx);
    setNewTaskForm(
      proposal.map((p) => ({
        task: p.task,
        todoId: p.todoId,
        checkpointId: p.checkpointId,
        projectId: p.projectId,
        pinId: p.pinId,
      })),
    );
    haptics.success();
    notify('Wypełniono propozycją — popraw i zacznij dzień.', 'success');
  };

  const confirmCheckpointDone = async () => {
    if (!checkpointPrompt) return;
    setMarkingCheckpoint(true);
    try {
      await markCheckpointDone(checkpointPrompt.checkpointId);
      notify('Checkpoint zamknięty', 'success');
      setCheckpointPrompt(null);
      void direction.reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally {
      setMarkingCheckpoint(false);
    }
  };

  const occupiedSlots = newTaskForm.map((s) => !!s.task.trim());

  // AI assistant states
  const [aiQuestions, setAiQuestions] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);

  // Fetch weekly goals — from useDirectionContext (weekGoals)

  async function generateQuestions() {
    setAiLoading(true);
    try {
      const stateVector = await gatherUserContext(session);
      const query = `Zanalizuj mój kontekst życiowy, cele z projektów (goal_chain), kalendarz i otwarte zadania. 
Zadaj mi 3-4 krótkie, bezpośrednie i bardzo trafne pytania po polsku, które pomogą mi spójnie zdefiniować dzisiejsze 5 zwycięstw (Ciało, Duch, Konto + 2 ogólne).
Kontekst celów tygodniowych i ich KPI (widoczne w goal_chain) jest kluczowy. Jeśli widać zaległości w tym tygodniu (np. 0/20 setów sprzedażowych, 0/3 treningi siłowe), Twoje pytania muszą bezpośrednio punktować te liczby i pytać, jak dzisiejsze zwycięstwa przełożą się na ich postęp.
Wskaż bezlitośnie wszelkie próby ucieczki (np. robienie bezpiecznych "ćwiczeń na sucho" zamiast realnego outreachu/telefonów, lub załatwianie drobnych spraw zamiast poznawania nowych ludzi).
Nie sugeruj mi gotowych zadań. Zadaj mi tylko pytania, które zmuszą mnie do myślenia i zdefiniowania konkretnych, mierzalnych zwycięstw.
Odpowiedz wyłącznie w postaci wypunktowanej listy 3-4 pytań w polu "answer", bez żadnego wstępu, powitań czy komentarzy.`;

      const { data, error } = await supabase.functions.invoke('vanguard-oracle', {
        body: {
          state_vector: stateVector,
          history: [],
          current_query: query,
          user_id: userId,
          mode: 'chat',
        },
      });

      if (error) throw error;
      const reply = data?.text ?? data?.answer ?? '';
      setAiQuestions(reply);
    } catch (e: any) {
      console.error('generateQuestions failed', e);
      notify('Błąd pomocy AI: ' + e.message, 'error');
    } finally {
      setAiLoading(false);
    }
  }

  // Resolve projects for today's linked todo items
  useEffect(() => {
    const ids = [
      todayWin?.task_1_todo_id,
      todayWin?.task_2_todo_id,
      todayWin?.task_3_todo_id,
      todayWin?.task_4_todo_id,
      todayWin?.task_5_todo_id,
    ].filter((id): id is string => !!id);
    if (ids.length === 0) return;
    (async () => {
      try {
        const [{ data: items }, sections, projects] = await Promise.all([
          supabase.from('todo_items').select('id, section_id').in('id', ids),
          listTodoSections(userId),
          listProjects(userId),
        ]);
        const sectionMap = new Map((sections ?? []).map((s: any) => [s.id, s]));
        const projectData = new Map((projects ?? []).map((p: any) => [p.id, p]));
        const result: Record<string, { name: string; color: string | null }> = {};
        for (const item of items ?? []) {
          const section = sectionMap.get(item.section_id) as any;
          const project = section?.project_id ? projectData.get(section.project_id) as any : null;
          if (project) result[item.id] = { name: project.name, color: project.color };
        }
        setProjectMap(result);
      } catch { /* project lookup is decorative, ignore */ }
    })();
  }, [todayWin?.task_1_todo_id, todayWin?.task_2_todo_id, todayWin?.task_3_todo_id, todayWin?.task_4_todo_id, todayWin?.task_5_todo_id, userId]);

  // Fetch yesterday's daily_wins to require a reflection before unlocking today
  useEffect(() => {
    if (todayWin) return;
    draftLoaded.current = false;
    const yesterday = getYesterdayWarsaw();
    supabase
      .from('daily_wins')
      .select('id, date, day_note, task_1, task_2, task_3, task_4, task_5, done_1, done_2, done_3, done_4, done_5')
      .eq('user_id', userId)
      .eq('date', yesterday)
      .maybeSingle()
      .then(({ data }) => {
        setYesterdayWin(data ?? null);
        setYesterdayNote((data as any)?.day_note ?? '');
      }, () => setYesterdayWin(null));
  }, [userId, todayWin]);

  useEffect(() => {
    if (todayWin || draftLoaded.current) return;
    try {
      const raw = localStorage.getItem(powerListDraftKey(userId, today));
      if (!raw) return;
      const draft = JSON.parse(raw) as PowerListDraft;
      if (Array.isArray(draft.tasks) && draft.tasks.length === 5) {
        setNewTaskForm(draft.tasks);
      }
      if (typeof draft.yesterdayNote === 'string') {
        setYesterdayNote(draft.yesterdayNote);
      }
    } catch {
      /* ignore corrupt draft */
    } finally {
      draftLoaded.current = true;
    }
  }, [userId, today, todayWin]);

  useEffect(() => {
    if (todayWin) {
      try { localStorage.removeItem(powerListDraftKey(userId, today)); } catch { /* ignore */ }
      return;
    }
    if (!draftLoaded.current) return;
    const t = window.setTimeout(() => {
      const draft: PowerListDraft = {
        tasks: newTaskForm,
        yesterdayNote,
        savedAt: Date.now(),
      };
      try { localStorage.setItem(powerListDraftKey(userId, today), JSON.stringify(draft)); } catch { /* ignore */ }
    }, 800);
    return () => window.clearTimeout(t);
  }, [userId, today, todayWin, newTaskForm, yesterdayNote]);

  useEffect(() => {
    if (todayWin) return;
    listTodoItems(userId)
      .then((items) => {
        const open = (items || [])
          .filter((i) => i.status === 'open')
          .sort((a, b) => {
            const aToday = a.due_date === today;
            const bToday = b.due_date === today;
            if (aToday !== bToday) return aToday ? -1 : 1;
            return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
          });
        setTodoItems(open);
      })
      .catch(() => {});
  }, [userId, today, todayWin]);

  useEffect(() => {
    if (pickerSlot < 0) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerSlot(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerSlot]);

  const updateSlot = (i: number, patch: Partial<TaskSlot>) => {
    setNewTaskForm((prev) => {
      const n = [...prev];
      n[i] = { ...n[i], ...patch };
      if (patch.task !== undefined && !patch.task.trim()) {
        n[i].checkpointId = null;
        n[i].projectId = null;
        n[i].pinId = null;
      }
      return n;
    });
  };

  async function toggleTask(index: number) {
    if (!todayWin) return;
    const field = `done_${index + 1}`;
    const timeField = `completed_at_${index + 1}`;
    const todoIdField = `task_${index + 1}_todo_id`;
    const checkpointIdField = `task_${index + 1}_checkpoint_id`;
    const newValue = !todayWin[field];
    const timestamp = newValue ? new Date().toISOString() : null;

    const allDone = [1, 2, 3, 4, 5].every((i) => {
      if (!todayWin[`task_${i}`]) return true;
      if (i === index + 1) return newValue;
      return todayWin[`done_${i}`];
    });

    const updates = { [field]: newValue, [timeField]: timestamp } as TablesUpdate<'daily_wins'>;
    if (allDone) updates.result = 'Z';
    else {
      if (todayWin.result === 'Z') updates.result = null;
      const warsawHour = parseInt(new Date().toLocaleTimeString('en-CA', { timeZone: 'Europe/Warsaw', hour: 'numeric', hour12: false }), 10);
      if (warsawHour >= 23 && !allDone) updates.result = 'P';
    }

    const { data, error } = await supabase
      .from('daily_wins')
      .update(updates)
      .eq('id', todayWin.id)
      .select()
      .single();

    if (!error) {
      if (newValue) haptics.success(); else haptics.light();
      if (onUpdate) onUpdate(data);

      if (newValue) {
        const taskText = todayWin[`task_${index + 1}`];
        const category = todayWin[`category_${index + 1}`] ?? 'general';
        const checkpointId = todayWin[checkpointIdField];
        if (checkpointId) {
          setCheckpointPrompt({
            index,
            checkpointId: checkpointId as string,
            title: taskText as string,
          });
        }
        if (taskText) {
          void supabase.from('vanguard_stream').insert({
            user_id: userId,
            source: 'powerlist',
            content: `Powerlist ✓ [${category}]: ${taskText}`,
            metadata: {
              category,
              index: index + 1,
              todo_id: todayWin[todoIdField] ?? null,
              checkpoint_id: checkpointId ?? null,
              project_id: todayWin[`task_${index + 1}_project_id`] ?? null,
            },
          });
        }
      } else {
        setCheckpointPrompt((p) => (p?.index === index ? null : p));
      }
    }

    const linkedTodoId = todayWin[todoIdField];
    if (linkedTodoId) {
      updateTodoItem(linkedTodoId, {
        status: newValue ? 'done' : 'open',
        completed_at: newValue ? new Date().toISOString() : null,
      }).catch((e: Error) => {
        console.error('[PowerList] todo sync failed for', linkedTodoId, e.message);
        notify('Błąd synchronizacji z Todo — odśwież stronę.', 'error');
      });
    }
  }

  async function startNewDay() {
    if (submitting) return;
    if (yesterdayNoteRequired && !yesterdayNote.trim()) {
      notify('Najpierw odpowiedz, dlaczego zrealizowałeś / nie zrealizowałeś zadania z wczoraj.', 'error');
      return;
    }
    if (!newTaskForm.some((t) => t.task.trim())) {
      notify('Wypełnij przynajmniej 1 zadanie!', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (yesterdayWin?.id && yesterdayNote.trim() && yesterdayNote.trim() !== (yesterdayWin.day_note ?? '')) {
        await supabase.from('daily_wins').update({ day_note: yesterdayNote.trim() }).eq('id', yesterdayWin.id);
      }

      const entry = {
        user_id: userId,
        date: today,
        task_1: newTaskForm[0].task, category_1: 'cialo',
        task_1_todo_id: newTaskForm[0].todoId, task_1_checkpoint_id: newTaskForm[0].checkpointId,
        task_1_project_id: newTaskForm[0].projectId, task_1_pin_id: newTaskForm[0].pinId,
        task_2: newTaskForm[1].task, category_2: 'duch',
        task_2_todo_id: newTaskForm[1].todoId, task_2_checkpoint_id: newTaskForm[1].checkpointId,
        task_2_project_id: newTaskForm[1].projectId, task_2_pin_id: newTaskForm[1].pinId,
        task_3: newTaskForm[2].task, category_3: 'konto',
        task_3_todo_id: newTaskForm[2].todoId, task_3_checkpoint_id: newTaskForm[2].checkpointId,
        task_3_project_id: newTaskForm[2].projectId, task_3_pin_id: newTaskForm[2].pinId,
        task_4: newTaskForm[3].task, category_4: 'general',
        task_4_todo_id: newTaskForm[3].todoId, task_4_checkpoint_id: newTaskForm[3].checkpointId,
        task_4_project_id: newTaskForm[3].projectId, task_4_pin_id: newTaskForm[3].pinId,
        task_5: newTaskForm[4].task, category_5: 'general',
        task_5_todo_id: newTaskForm[4].todoId, task_5_checkpoint_id: newTaskForm[4].checkpointId,
        task_5_project_id: newTaskForm[4].projectId, task_5_pin_id: newTaskForm[4].pinId,
        result: null,
      };

      const { data, error } = await supabase.from('daily_wins').insert(entry).select().single();
      if (error) throw error;
      try { localStorage.removeItem(powerListDraftKey(userId, today)); } catch { /* ignore */ }
      haptics.success();
      if (onUpdate) onUpdate(data);
    } catch (err: any) {
      console.error('[startNewDay]', err);
      haptics.error();
      notify('Błąd startu dnia: ' + (err?.message ?? 'nieznany błąd'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h3 className="flex items-center gap-2 font-display text-[11px] font-bold uppercase tracking-wider text-text-muted">
          <Target size={13} className="text-primary" /> 5 zwycięstw
        </h3>
        {todayWin?.result === 'Z' ? (
          <div className="rounded-full border border-dayC/15 bg-dayC/10 px-2.5 py-0.5 font-display text-[9px] font-bold text-dayC">
            Dzień wygrany
          </div>
        ) : todayWin && (() => {
          const total = [1, 2, 3, 4, 5].filter((i) => todayWin[`task_${i}`]).length;
          const doneCount = [1, 2, 3, 4, 5].filter((i) => todayWin[`task_${i}`] && todayWin[`done_${i}`]).length;
          return total > 0 ? (
            <div className="flex items-center gap-1.5">
              <div className="flex gap-1">
                {Array.from({ length: total }).map((_, i) => (
                  <span key={i} className={`h-1.5 w-1.5 rounded-full transition-colors ${i < doneCount ? 'bg-dayC' : 'bg-border-custom'}`} />
                ))}
              </div>
              <span className="font-display text-[9px] font-bold text-text-muted">{doneCount}/{total}</span>
            </div>
          ) : null;
        })()}
      </div>

      {!todayWin ? (
        <div className="space-y-5 rounded-[24px] border border-border-custom bg-surface p-5 shadow-sm">
          {yesterdayWin && (
            <div className="space-y-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3.5">
              <p className="text-[8px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                Zanim zaczniesz dziś — wczoraj ({yesterdayWin.date})
              </p>
              <ul className="space-y-1">
                {[1, 2, 3, 4, 5].map((i) => yesterdayWin[`task_${i}`] && (
                  <li key={i} className="flex items-center gap-2 text-[11px] font-medium">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${yesterdayWin[`done_${i}`] ? 'bg-dayC' : 'bg-text-muted/30'}`} />
                    <span className={yesterdayWin[`done_${i}`] ? 'text-text-secondary line-through opacity-70' : 'text-text-primary'}>
                      {yesterdayWin[`task_${i}`]}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-text-muted leading-relaxed">
                Dlaczego zrealizowałeś / nie zrealizowałeś te zadania? {yesterdayNoteRequired && <span className="font-bold text-amber-600 dark:text-amber-400">(wymagane)</span>}
              </p>
              <textarea
                value={yesterdayNote}
                onChange={(e) => setYesterdayNote(e.target.value)}
                placeholder="Napisz szczerze…"
                rows={3}
                className="w-full bg-surface-solid border border-border-custom rounded-xl px-3 py-2 text-sm
                  text-text-primary placeholder-text-muted resize-y min-h-[64px]
                  focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
          )}

          <LifeGoalsPanel
            rows={lifeGoalRows}
            compact
            emptyHint={LIFE_GOALS_EMPTY_HINT}
            fromProjects={lifeGoalRows.some((r) => r.source === 'project')}
          />

          <PlanningCheckpointsStrip
            checkpoints={[...direction.checkpoints.overdue, ...direction.checkpoints.upcoming]}
            loading={direction.loading}
            onFillSlot={fillSlotFromCheckpoint}
            occupiedSlots={occupiedSlots}
          />

          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-display text-[14px] font-black tracking-tight text-text-primary">
                Zdefiniuj 5 zwycięstw
              </h3>
              <button
                type="button"
                onClick={applyProposal}
                disabled={direction.loading}
                className="flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-[9px] font-black uppercase text-primary hover:bg-primary/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Wand2 size={11} /> Wypełnij propozycją
              </button>
            </div>
            <p className="mt-1 text-[11px] font-medium leading-relaxed text-text-secondary">
              Wpisz ręcznie lub wybierz z{' '}
              <span className="inline-flex items-center gap-1 font-bold text-primary">
                Zadań <Link2 size={10} />
              </span>
              .
            </p>
          </div>

          {/* Cele tygodnia jako kontekst */}
          {weekGoals && (
            <div className="rounded-xl border border-border-custom bg-surface p-3 space-y-2">
              <p className="text-[8px] font-black uppercase tracking-widest text-text-muted">Cele tego tygodnia</p>
              {weekGoals.intention && (
                <p className="text-[10px] text-text-secondary italic">„{weekGoals.intention}"</p>
              )}
              <div className="space-y-1.5">
                {[
                  { key: 'cialo' as const, label: 'Ciało', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
                  { key: 'duch'  as const, label: 'Duch',  color: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-500/10'  },
                  { key: 'konto' as const, label: 'Konto', color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10'   },
                ].filter(g => weekGoals[g.key]).map(g => (
                  <div key={g.key} className="flex items-start gap-2">
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest ${g.bg} ${g.color}`}>{g.label}</span>
                    <span className="text-[11px] font-semibold text-text-primary leading-snug">{weekGoals[g.key]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Helper Section */}
          <div className="rounded-xl border border-primary/10 bg-primary/[0.02] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-primary">
                <Sparkles size={12} className="animate-pulse" /> Asystent AI
              </span>
              <button
                type="button"
                onClick={generateQuestions}
                disabled={aiLoading}
                className="rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-primary transition-all hover:bg-primary/10 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {aiLoading ? 'Analizowanie...' : aiQuestions ? '🔄 Zadaj inne pytania' : '❓ Pomoc AI (Zadaj pytania)'}
              </button>
            </div>

            {/* Display Questions */}
            {aiQuestions && (
              <div className="rounded-lg border border-border-custom bg-surface p-3 text-left animate-in fade-in duration-300">
                <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-1.5 font-display">Pytania do przemyślenia:</p>
                <div className="text-[11px] font-semibold text-text-primary leading-relaxed whitespace-pre-line">
                  {aiQuestions}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2.5" ref={pickerRef}>
            {newTaskForm.map((slot, i) => {
              const sphere = i < 3 ? SPHERE_SLOTS[i] : null;
              const SphereIcon = sphere?.icon;
              return (
                <div key={i}>
                  <div
                    className={`flex items-center gap-2 rounded-xl border bg-surface transition-colors ${
                      pickerSlot === i ? 'border-primary/40 bg-surface-solid' : 'border-border-custom'
                    }`}
                  >
                    {/* Sphere badge for slots 0-2 */}
                    {sphere && SphereIcon && (
                      <span className={`ml-3 flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest ${sphere.bg} ${sphere.text}`}>
                        <SphereIcon size={8} /> {sphere.label}
                      </span>
                    )}

                    {slot.todoId ? (
                      <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-3">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[todoItems.find((x) => x.id === slot.todoId)?.priority] || 'bg-blue-500'}`} />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text-primary">{slot.task}</span>
                      </div>
                    ) : (
                      <input
                        placeholder={sphere?.placeholder ?? `Zadanie ${i + 1}`}
                        value={slot.task}
                        onChange={(e) => updateSlot(i, { task: e.target.value })}
                        className={`min-w-0 flex-1 bg-transparent py-3 text-[13px] font-medium text-text-primary outline-none placeholder:text-text-muted/40 ${sphere ? 'px-2' : 'px-3.5'}`}
                      />
                    )}

                    {slot.todoId ? (
                      <button onClick={() => updateSlot(i, { task: '', todoId: null })}
                        className="mr-3 shrink-0 rounded-full p-1.5 text-primary transition-colors hover:bg-rose-500/10 hover:text-rose-500" title="Usuń powiązanie">
                        <X size={14} />
                      </button>
                    ) : (
                      <button onClick={() => setPickerSlot(pickerSlot === i ? -1 : i)}
                        className={`mr-3 shrink-0 rounded-full p-1.5 transition-colors ${pickerSlot === i ? 'bg-primary/15 text-primary' : 'text-text-muted hover:bg-primary/10 hover:text-primary'}`}
                        title="Wybierz z zadań">
                        <Link2 size={14} />
                      </button>
                    )}
                  </div>

                  {pickerSlot === i && (
                    <TodoPicker
                      items={todoItems.filter(item => !newTaskForm.some((slot, idx) => idx !== i && slot.todoId === item.id))}
                      onSelect={(item) => updateSlot(i, { task: item.title, todoId: item.id, checkpointId: null, pinId: null })}
                      onClose={() => setPickerSlot(-1)}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={startNewDay}
            disabled={submitting || (yesterdayNoteRequired && !yesterdayNote.trim())}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-display text-[12px] font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={14} /> {submitting ? 'Zapisywanie…' : 'Zacznij dzień'}
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {checkpointPrompt && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3.5 py-2.5 animate-fadeIn">
              <p className="text-[11px] font-semibold text-text-primary leading-snug min-w-0">
                Checkpoint: <span className="font-bold">{checkpointPrompt.title}</span> — oznaczyć jako done?
              </p>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => void confirmCheckpointDone()}
                  disabled={markingCheckpoint}
                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[9px] font-black uppercase text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  Tak
                </button>
                <button
                  type="button"
                  onClick={() => setCheckpointPrompt(null)}
                  className="rounded-lg border border-border-custom px-2.5 py-1 text-[9px] font-black uppercase text-text-muted hover:text-text-primary cursor-pointer"
                >
                  Nie
                </button>
              </div>
            </div>
          )}

          {/* Cele tygodnia w widoku aktywnego dnia */}
          {weekGoals && (
            <div className="rounded-xl border border-border-custom bg-surface px-3 py-2.5 space-y-1.5">
              <p className="text-[8px] font-black uppercase tracking-widest text-text-muted">Cele tego tygodnia</p>
              <div className="space-y-1">
                {[
                  { key: 'cialo' as const, label: 'Ciało', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
                  { key: 'duch'  as const, label: 'Duch',  color: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-500/10'  },
                  { key: 'konto' as const, label: 'Konto', color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10'   },
                ].filter(g => weekGoals[g.key]).map(g => (
                  <div key={g.key} className="flex items-start gap-2">
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest ${g.bg} ${g.color}`}>{g.label}</span>
                    <span className="text-[11px] font-semibold text-text-primary leading-snug">{weekGoals[g.key]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {[0, 1, 2, 3, 4].map((i) => {
            const task = todayWin[`task_${i + 1}`];
            const done = todayWin[`done_${i + 1}`];
            const completedAt = todayWin[`completed_at_${i + 1}`];
            const linkedTodoId = todayWin[`task_${i + 1}_todo_id`];
            if (!task) return null;

            const sphere = i < 3 ? SPHERE_SLOTS[i] : null;
            const SphereIcon = sphere?.icon;

            return (
              <button
                key={i}
                onClick={() => toggleTask(i)}
                className={`group flex w-full cursor-pointer items-center justify-between rounded-[24px] border p-4 transition-all duration-200 active:scale-[0.98] ${
                  done
                    ? 'border-border-custom bg-surface/30 opacity-60 shadow-none'
                    : 'border-border-custom bg-surface shadow-sm hover:-translate-y-0.5 hover:border-primary/25 hover:bg-surface-solid hover:shadow-md'
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <div
                    className={`flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
                      done
                        ? 'border-dayC bg-dayC text-white shadow-[0_2px_8px_rgba(16,185,129,0.3)] scale-100'
                        : 'border-border-custom bg-surface-solid text-transparent scale-95 group-hover:border-primary/40 group-active:scale-90'
                    }`}
                  >
                    <Check size={11} strokeWidth={3} className={`transition-transform duration-300 ${done ? 'scale-100' : 'scale-0'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {sphere && SphereIcon && (
                        <span className={`flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[7px] font-black uppercase tracking-widest ${sphere.bg} ${sphere.text}`}>
                          <SphereIcon size={7} /> {sphere.label}
                        </span>
                      )}
                      <p className={`text-[13px] font-semibold tracking-normal transition-all duration-300 ${done ? 'text-text-muted line-through opacity-70' : 'text-text-primary'}`}>
                        {task}
                      </p>
                    </div>
                    {done && completedAt && (
                      <p className="mt-0.5 text-[9px] font-semibold text-dayC/80">
                        Zrobione o {new Date(completedAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>

                {linkedTodoId && (() => {
                  const proj = projectMap[linkedTodoId];
                  return proj ? (
                    <span className="ml-2 flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[8px] font-black text-primary">
                      <span className={`h-1.5 w-1.5 rounded-full ${COLOR_DOT[proj.color || ''] || 'bg-primary'}`} />
                      {proj.name}
                    </span>
                  ) : !done ? (
                    <span className="ml-2 flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[8px] font-black text-primary">
                      <Link2 size={8} /> Zadanie
                    </span>
                  ) : null;
                })()}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
