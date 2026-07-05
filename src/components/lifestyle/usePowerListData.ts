import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTodayWarsaw, getYesterdayWarsaw, formatWarsawDate } from '../../lib/date';
import { useHaptics } from '../../hooks/useHaptics';
import { useLifeGoals } from '../../hooks/useLifeGoals';
import { useDirectionContext } from '../../hooks/useDirectionContext';
import { supabase } from '../../lib/supabase';
import { listTodoItems, updateTodoItem, listTodoSections } from '../../lib/todo';
import { listProjects } from '../../lib/projects';
import type { TablesUpdate } from '../../lib/database.types';
import { gatherUserContext } from '../../lib/aiContext';
import { notify } from '../../lib/notify';
import { markCheckpointDone } from '../../lib/checkpoints';
import {
  buildDailyPlanProposal,
  suggestDailyKpiTarget,
  kpiSlotHint,
  defaultPillarProject,
  pickRollupKpi,
  type DirectionContextData,
  type PillarProjectBinding,
} from '../../lib/dailyPlanProposal';
import {
  applyKpiRollup,
  currentWeekStart,
  fetchKpisForProject,
  insertDailyWin,
  rollupTaskCompletion,
  updateDailyWin,
} from '../../lib/goalSpine';

export interface TaskSlot {
  task: string;
  todoId: string | null;
  checkpointId: string | null;
  projectId: string | null;
  pinId: string | null;
  kpiId?: string | null;
  targetValue?: string;
  timeSlot?: 'morning' | 'noon' | 'afternoon' | 'evening';
}

export interface PowerListDraft {
  tasks: TaskSlot[];
  yesterdayNote: string;
  savedAt: number;
}

export const EMPTY_SLOT: TaskSlot = {
  task: '',
  todoId: null,
  checkpointId: null,
  projectId: null,
  pinId: null,
  targetValue: '',
  timeSlot: 'morning',
};

export const TIME_SLOT_LABELS = {
  morning: '🌅 Rano',
  noon: '☀️ Południe',
  afternoon: '🌆 Popołudnie',
  evening: '🌙 Wieczór',
};

export function powerListDraftKey(userId: string, date: string) {
  return `vanguard_powerlist_draft_${userId}_${date}`;
}

export function powerListKpiKey(userId: string, date: string) {
  return `vanguard_powerlist_kpi_${userId}_${date}`;
}

export interface UsePowerListDataProps {
  session: any;
  todayWin: any;
  onUpdate?: (data: any) => void;
  planDaySignal?: number;
}

export function usePowerListData({ session, todayWin, onUpdate, planDaySignal }: UsePowerListDataProps) {
  const userId = session.user.id;
  const { displayRows: lifeGoalRows, refresh: refreshLifeGoals } = useLifeGoals(userId);
  const direction = useDirectionContext(userId);
  const today = getTodayWarsaw();
  const yesterdayStr = formatWarsawDate(new Date(Date.now() - 86400000));
  const haptics = useHaptics();
  const weekGoals = direction.weekGoals ?? null;

  const pillarProjects = useMemo<PillarProjectBinding[]>(
    () =>
      lifeGoalRows
        .filter((r) => r.projectId)
        .map((r) => ({
          pillar: r.id as 'cialo' | 'duch' | 'konto',
          projectId: r.projectId!,
          name: r.subtitle || r.title,
          kpis: (r.kpis ?? []).map((k) => ({
            id: k.id,
            name: k.name,
            current: k.current,
            target: k.target,
          })),
        })),
    [lifeGoalRows],
  );

  const allProjectOptions = useMemo(
    () => direction.activeProjects?.map((p) => ({ id: p.id, name: p.name, kpis: p.kpis ?? [] })) ?? [],
    [direction.activeProjects],
  );

  useEffect(() => {
    if (!todayWin) void refreshLifeGoals();
  }, [todayWin, refreshLifeGoals]);

  const [projectMap, setProjectMap] = useState<Record<string, { name: string; color: string | null }>>({});
  const [checkpointPrompt, setCheckpointPrompt] = useState<{ index: number; checkpointId: string; title: string } | null>(null);
  const [markingCheckpoint, setMarkingCheckpoint] = useState(false);
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
  const [eveningNote, setEveningNote] = useState('');
  const [savingEvening, setSavingEvening] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const draftLoaded = useRef(false);

  const [todaySlotKpis, setTodaySlotKpis] = useState<Record<number, string>>(() => {
    try {
      const raw = localStorage.getItem(powerListKpiKey(userId, today));
      return raw ? (JSON.parse(raw) as Record<number, string>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      if (Object.keys(todaySlotKpis).length === 0) localStorage.removeItem(powerListKpiKey(userId, today));
      else localStorage.setItem(powerListKpiKey(userId, today), JSON.stringify(todaySlotKpis));
    } catch { /* ignore */ }
  }, [todaySlotKpis, userId, today]);

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
        targetValue: next[idx].targetValue ?? '',
        timeSlot: next[idx].timeSlot ?? 'morning',
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
      sprintFocusProjectIds: direction.sprintFocusProjectIds ?? [],
      monthTheme: direction.monthTheme ?? null,
      monthLabel: direction.monthLabel ?? null,
      bhagLine: direction.bhagLine ?? null,
      focus: direction.focus ?? { skillId: null, skillLabel: null, subskillLabel: null, targetLevel: null },
      weekCheckpointsDone: direction.weekCheckpointsDone ?? 0,
      weekCheckpointsDue: direction.weekCheckpointsDue ?? 0,
      skills: direction.skills ?? [],
    };
    if (ctx.checkpoints.all.length === 0 && ctx.openMustPins.length === 0 && !ctx.weekGoals.cialo && !ctx.weekGoals.duch && !ctx.weekGoals.konto) {
      notify('Brak danych do propozycji — uzupełnij tydzień lub checkpointy.', 'error');
      return;
    }
    const proposal = buildDailyPlanProposal(ctx, pillarProjects);
    setNewTaskForm(
      proposal.map((p, i) => ({
        task: p.task,
        todoId: p.todoId,
        checkpointId: p.checkpointId,
        projectId: p.projectId,
        pinId: p.pinId,
        targetValue: p.targetValue ?? newTaskForm[i]?.targetValue ?? '',
        timeSlot: newTaskForm[i]?.timeSlot ?? 'morning',
      })),
    );
    haptics.success();
    notify('Wypełniono propozycją — popraw i zacznij dzień.', 'success');
  };

  const planDaySignalMounted = useRef(false);
  useEffect(() => {
    if (!planDaySignalMounted.current) {
      planDaySignalMounted.current = true;
      return;
    }
    if (direction.loading) return;
    applyProposal();
  }, [planDaySignal]);

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

  const occupiedSlots = useMemo(() => newTaskForm.map((s) => !!s.task.trim()), [newTaskForm]);

  const [aiQuestions, setAiQuestions] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);

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

  useEffect(() => {
    const todoIds = [
      todayWin?.task_1_todo_id,
      todayWin?.task_2_todo_id,
      todayWin?.task_3_todo_id,
      todayWin?.task_4_todo_id,
      todayWin?.task_5_todo_id,
    ].filter((id): id is string => !!id);
    const directProjectIds = [1, 2, 3, 4, 5]
      .map((i) => todayWin?.[`task_${i}_project_id`] as string | null)
      .filter((id): id is string => !!id);
    if (todoIds.length === 0 && directProjectIds.length === 0) return;
    (async () => {
      try {
        const [{ data: items }, sections, projects] = await Promise.all([
          todoIds.length > 0
            ? supabase.from('todo_items').select('id, section_id').in('id', todoIds)
            : Promise.resolve({ data: [] }),
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
        for (let i = 1; i <= 5; i++) {
          const pid = todayWin?.[`task_${i}_project_id`] as string | null;
          if (pid && projectData.has(pid)) {
            const project = projectData.get(pid) as any;
            result[`task_project_${i}`] = { name: project.name, color: project.color };
          }
        }
        setProjectMap(result);
      } catch { /* ignore */ }
    })();
  }, [
    todayWin?.task_1_todo_id, todayWin?.task_2_todo_id, todayWin?.task_3_todo_id,
    todayWin?.task_4_todo_id, todayWin?.task_5_todo_id,
    todayWin?.task_1_project_id, todayWin?.task_2_project_id, todayWin?.task_3_project_id,
    todayWin?.task_4_project_id, todayWin?.task_5_project_id,
    userId,
  ]);

  useEffect(() => {
    if (todayWin) return;
    draftLoaded.current = false;
    const yesterday = getYesterdayWarsaw();
    supabase
      .from('daily_wins')
      .select('id, date, day_note, daily_win_tasks(*)')
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
    } catch { /* ignore */ }
    finally {
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
            const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
            if (aToday !== bToday) return aToday ? -1 : 1;
            return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
          });
        setTodoItems(open);
      })
      .catch(() => {});
  }, [userId, today, todayWin]);

  const updateSlot = (i: number, patch: Partial<TaskSlot>) => {
    setNewTaskForm((prev) => {
      const n = [...prev];
      n[i] = { ...n[i], ...patch };
      if (patch.task !== undefined && !patch.task.trim()) {
        n[i].checkpointId = null;
        n[i].projectId = null;
        n[i].pinId = null;
        n[i].targetValue = '';
        n[i].kpiId = null;
      }
      const taskText = patch.task !== undefined ? patch.task : n[i].task;
      const SPHERE_SLOTS = [
        { category: 'cialo', label: 'Ciało' },
        { category: 'duch',  label: 'Duch' },
        { category: 'konto', label: 'Konto' },
      ];
      if (taskText.trim() && i < 3 && !n[i].projectId && !patch.projectId) {
        const pillar = SPHERE_SLOTS[i].category as 'cialo' | 'duch' | 'konto';
        const binding = defaultPillarProject(pillar, pillarProjects, direction.sprintFocusProjectIds ?? []);
        if (binding) {
          n[i].projectId = binding.projectId;
          const picked = pickRollupKpi(binding.kpis);
          n[i].kpiId = picked?.id ?? null;
          const hint = kpiSlotHint(binding.kpis, n[i].kpiId);
          if (hint.autoTarget && !n[i].targetValue?.trim()) n[i].targetValue = hint.autoTarget;
        }
      }
      if (patch.kpiId !== undefined) {
        n[i].kpiId = patch.kpiId;
        setTodaySlotKpis((prev) => {
          const next = { ...prev };
          if (patch.kpiId) next[i] = patch.kpiId;
          else delete next[i];
          return next;
        });
      }
      if (patch.projectId !== undefined) {
        const proj =
          allProjectOptions.find((p) => p.id === patch.projectId) ??
          pillarProjects.find((p) => p.projectId === patch.projectId);
        const kpis = proj?.kpis ?? [];
        const picked = pickRollupKpi(kpis, n[i].kpiId);
        n[i].kpiId = picked?.id ?? null;
        const kpiRow = kpis.find((k) => k.id === n[i].kpiId);
        const suggested = suggestDailyKpiTarget(kpiRow ? [kpiRow] : kpis);
        if (suggested && !n[i].targetValue?.trim()) n[i].targetValue = suggested;
        if (!patch.projectId) n[i].kpiId = null;
      }
      return n;
    });
  };

  const projectOptionsForSlot = (slotIndex: number) => {
    if (slotIndex < 3) {
      const SPHERE_SLOTS = [
        { category: 'cialo', label: 'Ciało' },
        { category: 'duch',  label: 'Duch' },
        { category: 'konto', label: 'Konto' },
      ];
      const pillar = SPHERE_SLOTS[slotIndex].category as 'cialo' | 'duch' | 'konto';
      const pillarOpts = pillarProjects.filter((p) => p.pillar === pillar);
      if (pillarOpts.length > 0) {
        return pillarOpts.map((p) => ({ id: p.projectId, name: p.name ?? 'Projekt', kpis: p.kpis }));
      }
    }
    return allProjectOptions;
  };

  const kpiHintForSlot = (slotIndex: number, projectId: string | null, kpiId?: string | null) => {
    if (!projectId) return null;
    const proj =
      allProjectOptions.find((p) => p.id === projectId) ??
      pillarProjects.find((p) => p.projectId === projectId);
    return kpiSlotHint(proj?.kpis ?? [], kpiId);
  };

  const kpisForProject = (projectId: string | null) => {
    if (!projectId) return [];
    const proj =
      allProjectOptions.find((p) => p.id === projectId) ??
      pillarProjects.find((p) => p.projectId === projectId);
    return proj?.kpis ?? [];
  };

  const eveningCloseDue = useMemo(() => {
    if (!todayWin) return false;
    if (todayWin.day_note?.trim()) return false;
    if (!todayWin.task_1?.trim()) return false;
    if (todayWin.result === 'Z' || todayWin.result === 'P') return true;
    const h = parseInt(
      new Date().toLocaleTimeString('en-CA', { timeZone: 'Europe/Warsaw', hour: 'numeric', hour12: false }),
      10,
    );
    return h >= 20;
  }, [todayWin]);

  async function saveEveningClose() {
    if (!todayWin || !eveningNote.trim() || savingEvening) return;
    setSavingEvening(true);
    try {
      const note = eveningNote.trim();
      const data = await updateDailyWin(userId, todayWin.id, { day_note: note });
      void supabase.from('vanguard_stream').insert({
        user_id: userId,
        source: 'powerlist',
        content: `Domknięcie dnia: ${note}`,
        metadata: { kind: 'day_close', date: today },
      });
      haptics.light();
      if (onUpdate) onUpdate(data);
    } catch (e) {
      console.error('[saveEveningClose]', e);
      notify('Nie udało się zapisać domknięcia dnia.', 'error');
    } finally {
      setSavingEvening(false);
    }
  }

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

    try {
      const data = await updateDailyWin(userId, todayWin.id, updates);

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

      const projectId = todayWin[`task_${index + 1}_project_id`] as string | null;
      const targetValue = todayWin[`task_${index + 1}_target_value`] as string | null;
      if (projectId && targetValue) {
        (async () => {
          try {
            const kpis = await fetchKpisForProject(userId, projectId);
            const preferredKpi =
              newTaskForm[index]?.kpiId ?? todaySlotKpis[index] ?? undefined;
            const decision = rollupTaskCompletion(
              targetValue,
              kpis,
              newValue ? 1 : -1,
              preferredKpi,
            );
            if (decision) {
              await applyKpiRollup(userId, decision.kpiId, currentWeekStart(), decision.delta);
            }
          } catch (e) {
            console.error('[PowerList] KPI rollup failed', e);
          }
        })();
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
    } catch (e) {
      console.error('[PowerList] toggleTask failed', e);
      notify('Nie udało się zapisać zadania.', 'error');
    }
  }

  async function startNewDay() {
    if (submitting) return;
    if (yesterdayNoteRequired && !yesterdayNote.trim()) {
      notify('Najpierw odpowiedz, dlaczego zrealizowałeś / nie zrealizowałeś zadania z wczoraj.', 'error');
      return;
    }
    if (!newTaskForm.every((t) => t.task.trim())) {
      notify('Wypełnij wszystkie 5 zadań, żeby zacząć dzień.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (yesterdayWin?.id && yesterdayNote.trim() && yesterdayNote.trim() !== (yesterdayWin.day_note ?? '')) {
        await updateDailyWin(userId, yesterdayWin.id, { day_note: yesterdayNote.trim() });
      }

      // 1. Create the parent daily_wins entry
      const parentWin = await insertDailyWin(userId, {
        user_id: userId,
        date: today,
        result: null,
      });

      // 2. Insert tasks dynamically into daily_win_tasks
      const taskEntries = newTaskForm.map((slot, idx) => ({
        day_win_id: parentWin.id,
        slot: idx + 1,
        user_id: userId,
        title: slot.task,
        category: idx === 0 ? 'cialo' : idx === 1 ? 'duch' : idx === 2 ? 'konto' : 'general',
        todo_id: slot.todoId,
        checkpoint_id: slot.checkpointId,
        project_id: slot.projectId,
        pin_id: slot.pinId,
        target_value: slot.targetValue?.trim() || null,
        time_slot: slot.timeSlot ?? null,
        done: false
      }));

      const { data: insertedTasks, error: tasksErr } = await supabase
        .from('daily_win_tasks')
        .insert(taskEntries)
        .select();
      
      if (tasksErr) throw tasksErr;

      const data = {
        ...parentWin,
        daily_win_tasks: insertedTasks
      };

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

  return {
    userId,
    today,
    direction,
    haptics,
    weekGoals,
    pillarProjects,
    allProjectOptions,
    projectMap,
    checkpointPrompt, setCheckpointPrompt,
    markingCheckpoint,
    yesterdayWin,
    yesterdayNote, setYesterdayNote,
    yesterdayNoteRequired,
    newTaskForm, setNewTaskForm,
    todoItems,
    pickerSlot, setPickerSlot,
    submitting,
    eveningNote, setEveningNote,
    savingEvening,
    pickerRef,
    todaySlotKpis,
    aiQuestions,
    aiLoading,
    occupiedSlots,
    fillSlotFromCheckpoint,
    applyProposal,
    confirmCheckpointDone,
    generateQuestions,
    updateSlot,
    projectOptionsForSlot,
    kpiHintForSlot,
    kpisForProject,
    eveningCloseDue,
    saveEveningClose,
    toggleTask,
    startNewDay,
    todayStr: today,
    yesterdayStr
  };
}
