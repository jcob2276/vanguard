/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '../../../lib/supabase';
import { useHaptics } from '../../../hooks/useHaptics';
import { notify } from '../../../lib/notify';
import { markCheckpointDone } from '../../../lib/checkpoints';
import { gatherDailyWinsContext } from '../../../lib/aiContext';
import { updateTodoItem } from '../../../lib/todo/todo';
import type { TablesUpdate } from '../../../lib/database.types';
import {
  applyKpiRollup,
  currentWeekStart,
  fetchKpisForProject,
  insertDailyWin,
  rollupTaskCompletion,
  updateDailyWin,
} from '../../../lib/goal/goalSpine';
import {
  type TaskSlot,
  powerListDraftKey,
} from '../usePowerListTypes';
import {
  suggestDailyKpiTarget,
  kpiSlotHint,
  defaultPillarProject,
  pickRollupKpi,
} from '../../../lib/dailyPlanProposal';

interface UsePowerListActionsArgs {
  userId: string;
  today: string;
  direction: any;
  pillarProjects: any[];
  newTaskForm: TaskSlot[];
  setNewTaskForm: React.Dispatch<React.SetStateAction<TaskSlot[]>>;
  checkpointPrompt: { index: number; checkpointId: string; title: string } | null;
  setCheckpointPrompt: React.Dispatch<React.SetStateAction<{ index: number; checkpointId: string; title: string } | null>>;
  setMarkingCheckpoint: React.Dispatch<React.SetStateAction<boolean>>;
  yesterdayWin: any;
  yesterdayNote: string;
  yesterdayNoteRequired: boolean;
  submitting: boolean;
  setSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  eveningNote: string;
  savingEvening: boolean;
  setSavingEvening: React.Dispatch<React.SetStateAction<boolean>>;
  todaySlotKpis: Record<number, string>;
  setAiQuestions: React.Dispatch<React.SetStateAction<string>>;
  setAiLoading: React.Dispatch<React.SetStateAction<boolean>>;
  onUpdate?: (data: any) => void;
  session: any;
  setTodaySlotKpis: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  allProjectOptions: any[];
}

export function usePowerListActions(args: UsePowerListActionsArgs) {
  const haptics = useHaptics();

  return {
    fillSlotFromCheckpoint: (payload: any, slotIndex?: number) =>
      fillSlotFromCheckpointHelper(payload, slotIndex, args.newTaskForm, args.setNewTaskForm, haptics),
    confirmCheckpointDone: () => confirmCheckpointDoneHelper(args),
    generateQuestions: () => generateQuestionsHelper(args),
    saveEveningClose: (win: any) => saveEveningCloseHelper(args, win, haptics),
    toggleTask: (idx: number, win: any) => toggleTaskHelper(args, idx, win, haptics),
    startNewDay: () => startNewDayHelper(args, haptics),
    updateSlot: (i: number, patch: Partial<TaskSlot>) => updateSlotHelper(args, i, patch),
    projectOptionsForSlot: (slotIndex: number) =>
      projectOptionsForSlotHelper(slotIndex, args.pillarProjects, args.allProjectOptions),
    kpiHintForSlot: (slotIndex: number, projectId: string | null, kpiId?: string | null) =>
      kpiHintForSlotHelper(slotIndex, projectId, kpiId, args.pillarProjects, args.allProjectOptions),
    kpisForProject: (projectId: string | null) =>
      kpisForProjectHelper(projectId, args.pillarProjects, args.allProjectOptions),
  };
}

function fillSlotFromCheckpointHelper(
  payload: { title: string; checkpointId: string; projectId: string },
  slotIndex: number | undefined,
  newTaskForm: TaskSlot[],
  setNewTaskForm: React.Dispatch<React.SetStateAction<TaskSlot[]>>,
  haptics: ReturnType<typeof useHaptics>
) {
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
}

async function confirmCheckpointDoneHelper(args: UsePowerListActionsArgs) {
  if (!args.checkpointPrompt) return;
  args.setMarkingCheckpoint(true);
  try {
    await markCheckpointDone(args.checkpointPrompt.checkpointId);
    notify('Checkpoint zamknięty', 'success');
    args.setCheckpointPrompt(null);
    void args.direction.reload();
  } catch (err: unknown) {
    notify(err instanceof Error ? (err as Error).message : 'Błąd', 'error');
  } finally {
    args.setMarkingCheckpoint(false);
  }
}

async function generateQuestionsHelper(args: UsePowerListActionsArgs) {
  args.setAiLoading(true);
  try {
    const stateVector = await gatherDailyWinsContext(args.session);
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
        user_id: args.userId,
        mode: 'chat',
      },
    });

    if (error) throw error;
    const reply = data?.text ?? data?.answer ?? '';
    args.setAiQuestions(reply);
  } catch (err: unknown) {
    console.error('generateQuestions failed', err);
    notify('Błąd pomocy AI: ' + (err instanceof Error ? err.message : 'nieznany'), 'error');
  } finally {
    args.setAiLoading(false);
  }
}

async function saveEveningCloseHelper(args: UsePowerListActionsArgs, todayWin: any, haptics: ReturnType<typeof useHaptics>) {
  if (!todayWin || !args.eveningNote.trim() || args.savingEvening) return;
  args.setSavingEvening(true);
  try {
    const note = args.eveningNote.trim();
    const data = await updateDailyWin(args.userId, todayWin.id, { day_note: note });
    void supabase.from('vanguard_stream').insert({
      user_id: args.userId,
      source: 'powerlist',
      content: `Domknięcie dnia: ${note}`,
      metadata: { kind: 'day_close', date: args.today },
    });
    haptics.light();
    if (args.onUpdate) args.onUpdate(data);
  } catch (err: unknown) {
    console.error('[saveEveningClose]', err);
    notify('Nie udało się zapisać domknięcia dnia.', 'error');
  } finally {
    args.setSavingEvening(false);
  }
}

async function toggleTaskHelper(args: UsePowerListActionsArgs, index: number, todayWin: any, haptics: ReturnType<typeof useHaptics>) {
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
    const data = await updateDailyWin(args.userId, todayWin.id, updates);

    if (newValue) haptics.success(); else haptics.light();
    if (args.onUpdate) args.onUpdate(data);

    if (newValue) {
      const taskText = todayWin[`task_${index + 1}`];
      const category = todayWin[`category_${index + 1}`] ?? 'general';
      const checkpointId = todayWin[checkpointIdField];
      if (checkpointId) {
        args.setCheckpointPrompt({
          index,
          checkpointId: checkpointId as string,
          title: taskText as string,
        });
      }
      if (taskText) {
        void supabase.from('vanguard_stream').insert({
          user_id: args.userId,
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
      args.setCheckpointPrompt((p) => (p?.index === index ? null : p));
    }

    const projectId = todayWin[`task_${index + 1}_project_id`] as string | null;
    const targetValue = todayWin[`task_${index + 1}_target_value`] as string | null;
    if (projectId && targetValue) {
      (async () => {
        try {
          const kpis = await fetchKpisForProject(args.userId, projectId);
          const preferredKpi =
            args.newTaskForm[index]?.kpiId ?? args.todaySlotKpis[index] ?? undefined;
          const decision = rollupTaskCompletion(
            targetValue,
            kpis,
            newValue ? 1 : -1,
            preferredKpi
          );
          if (decision) {
            await applyKpiRollup(args.userId, decision.kpiId, currentWeekStart(), decision.delta);
          }
        } catch (err: unknown) {
          console.error('[Action Error]', err);
          notify(err instanceof Error ? err.message : 'Wystąpił błąd', 'error');
        }
      })();
    }

    const linkedTodoId = todayWin[todoIdField];
    if (linkedTodoId) {
      updateTodoItem(linkedTodoId, {
        status: newValue ? 'done' : 'open',
        completed_at: newValue ? new Date().toISOString() : null,
      }).catch((e: Error) => {
        console.error('[PowerList] todo sync failed for', linkedTodoId, (e as Error).message);
        notify('Błąd synchronizacji z Todo — odśwież stronę.', 'error');
      });
    }
  } catch (err: unknown) {
    console.error('[PowerList] toggleTask failed', err);
    notify('Nie udało się zapisać zadania.', 'error');
  }
}

async function startNewDayHelper(args: UsePowerListActionsArgs, haptics: ReturnType<typeof useHaptics>) {
  if (args.submitting) return;
  if (args.yesterdayNoteRequired && !args.yesterdayNote.trim()) {
    notify('Najpierw odpowiedz, dlaczego zrealizowałeś / nie zrealizowałeś zadania z wczoraj.', 'error');
    return;
  }
  if (!args.newTaskForm.every((t) => t.task.trim())) {
    notify('Wypełnij wszystkie 5 zadań, żeby zacząć dzień.', 'error');
    return;
  }

  args.setSubmitting(true);
  try {
    if (args.yesterdayWin?.id && args.yesterdayNote.trim() && args.yesterdayNote.trim() !== (args.yesterdayWin.day_note ?? '')) {
      await updateDailyWin(args.userId, args.yesterdayWin.id, { day_note: args.yesterdayNote.trim() });
    }

    const parentWin = await insertDailyWin(args.userId, {
      user_id: args.userId,
      date: args.today,
      result: null,
    });

    const taskEntries = args.newTaskForm.map((slot, idx) => ({
      day_win_id: parentWin.id,
      slot: idx + 1,
      user_id: args.userId,
      title: slot.task,
      category: idx === 0 ? 'cialo' : idx === 1 ? 'duch' : idx === 2 ? 'konto' : 'general',
      todo_id: slot.todoId,
      checkpoint_id: slot.checkpointId,
      project_id: slot.projectId,
      pin_id: slot.pinId,
      target_value: slot.targetValue?.trim() || null,
      time_slot: slot.timeSlot ?? null,
      done: false,
    }));

    const { data: insertedTasks, error: tasksErr } = await supabase
      .from('daily_win_tasks')
      .insert(taskEntries)
      .select();

    if (tasksErr) throw tasksErr;

    const data = {
      ...parentWin,
      daily_win_tasks: insertedTasks,
    };

    try {
      localStorage.removeItem(powerListDraftKey(args.userId, args.today));
    } catch {
      /* ignore */
    }
    haptics.success();
    if (args.onUpdate) args.onUpdate(data);
  } catch (err: unknown) {
    console.error('[startNewDay]', err);
    haptics.error();
    notify('Błąd startu dnia: ' + (err instanceof Error ? err.message : 'nieznany błąd'), 'error');
  } finally {
    args.setSubmitting(false);
  }
}

function updateSlotHelper(args: UsePowerListActionsArgs, i: number, patch: Partial<TaskSlot>) {
  args.setNewTaskForm((prev) => {
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
      const binding = defaultPillarProject(pillar, args.pillarProjects, args.direction.sprintFocusProjectIds ?? []);
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
      args.setTodaySlotKpis((prev) => {
        const next = { ...prev };
        if (patch.kpiId) next[i] = patch.kpiId;
        else delete next[i];
        return next;
      });
    }
    if (patch.projectId !== undefined) {
      const proj =
        args.allProjectOptions.find((p) => p.id === patch.projectId) ??
        args.pillarProjects.find((p) => p.projectId === patch.projectId);
      const kpis = proj?.kpis ?? [];
      const picked = pickRollupKpi(kpis, n[i].kpiId);
      n[i].kpiId = picked?.id ?? null;
      const kpiRow = kpis.find((k: any) => k.id === n[i].kpiId);
      const suggested = suggestDailyKpiTarget(kpiRow ? [kpiRow] : kpis);
      if (suggested && !n[i].targetValue?.trim()) n[i].targetValue = suggested;
      if (!patch.projectId) n[i].kpiId = null;
    }
    return n;
  });
}

function projectOptionsForSlotHelper(slotIndex: number, pillarProjects: any[], allProjectOptions: any[]) {
  if (slotIndex < 3) {
    const SPHERE_SLOTS = [
      { category: 'cialo', label: 'Ciało' },
      { category: 'duch',  label: 'Duch' },
      { category: 'konto', label: 'Konto' },
    ];
    const pillar = SPHERE_SLOTS[slotIndex].category as 'cialo' | 'duch' | 'konto';
    const pillarOpts = pillarProjects.filter((p) => p.pillar === pillar);
    if (pillarOpts.length > 0) {
      return pillarOpts.map((p) => ({
        id: p.projectId,
        name: p.name ?? 'Projekt',
        kpis: p.kpis,
      }));
    }
  }
  return allProjectOptions;
}

function kpiHintForSlotHelper(
  slotIndex: number,
  projectId: string | null,
  kpiId: string | null | undefined,
  pillarProjects: any[],
  allProjectOptions: any[]
) {
  if (!projectId) return null;
  const proj =
    allProjectOptions.find((p) => p.id === projectId) ??
    pillarProjects.find((p) => p.projectId === projectId);
  return kpiSlotHint(proj?.kpis ?? [], kpiId);
}

function kpisForProjectHelper(projectId: string | null, pillarProjects: any[], allProjectOptions: any[]) {
  if (!projectId) return [];
  const proj =
    allProjectOptions.find((p) => p.id === projectId) ??
    pillarProjects.find((p) => p.projectId === projectId);
  return proj?.kpis ?? [];
}
