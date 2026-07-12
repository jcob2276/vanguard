/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { listTodoItems, listTodoSections } from '../../../lib/todo/todo';
import { listProjects } from '../../../lib/projects/projects';
import { getYesterdayWarsaw } from '../../../lib/date';
import {
  type TaskSlot,
  type PowerListDraft,
  powerListDraftKey,
} from '../usePowerListTypes';

interface UsePowerListEffectsArgs {
  userId: string;
  today: string;
  todayWin: any;
  draftLoadedRef: React.MutableRefObject<boolean>;
  planDaySignalMountedRef: React.MutableRefObject<boolean>;
  newTaskForm: TaskSlot[];
  setNewTaskForm: React.Dispatch<React.SetStateAction<TaskSlot[]>>;
  yesterdayNote: string;
  setYesterdayNote: React.Dispatch<React.SetStateAction<string>>;
  setYesterdayWin: React.Dispatch<React.SetStateAction<any>>;
  setProjectMap: React.Dispatch<React.SetStateAction<Record<string, { name: string; color: string | null }>>>;
  setTodoItems: React.Dispatch<React.SetStateAction<any[]>>;
  applyProposal: () => Promise<void>;
  planDaySignal: number | undefined;
  directionLoading: boolean;
}

export function usePowerListEffects({
  userId,
  today,
  todayWin,
  draftLoadedRef,
  planDaySignalMountedRef,
  newTaskForm,
  setNewTaskForm,
  yesterdayNote,
  setYesterdayNote,
  setYesterdayWin,
  setProjectMap,
  setTodoItems,
  applyProposal,
  planDaySignal,
  directionLoading,
}: UsePowerListEffectsArgs) {
  const applyProposalRef = useRef(applyProposal);
  
  useEffect(() => {
    applyProposalRef.current = applyProposal;
  }, [applyProposal]);
  // 1. Fetch project names/metadata when todayWin tasks update
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
          const section = sectionMap.get(item.section_id) as { project_id?: string } | undefined;
          const project = section?.project_id ? projectData.get(section.project_id) as { name: string; color: string | null } | undefined : null;
          if (project) result[item.id] = { name: project.name, color: project.color };
        }
        for (let i = 1; i <= 5; i++) {
          const pid = todayWin?.[`task_${i}_project_id`] as string | null;
          if (pid && projectData.has(pid)) {
            const project = projectData.get(pid) as { name: string; color: string | null };
            result[`task_project_${i}`] = { name: project.name, color: project.color };
          }
        }
        setProjectMap(result);
      } catch {
        /* ignore */
      }
    })();
  }, [
    todayWin,
    userId,
    setProjectMap,
  ]);

  // 2. Fetch yesterday's win details
  useEffect(() => {
    if (todayWin) return;
    draftLoadedRef.current = false;
    const yesterday = getYesterdayWarsaw();
    supabase
      .from('daily_wins')
      .select('id, date, day_note, daily_win_tasks(*)')
      .eq('user_id', userId)
      .eq('date', yesterday)
      .maybeSingle()
      .then(
        ({ data }) => {
          setYesterdayWin(data ?? null);
          setYesterdayNote(data?.day_note ?? '');
        },
        () => setYesterdayWin(null)
      );
  }, [userId, todayWin, draftLoadedRef, setYesterdayNote, setYesterdayWin]);

  // 3. LocalStorage draft loading
  useEffect(() => {
    if (todayWin || draftLoadedRef.current) return;
    try {
      const raw = localStorage.getItem(powerListDraftKey(userId, today));
      if (!raw) return;
      const draft = JSON.parse(raw) as PowerListDraft;
      void (async () => {
        if (Array.isArray(draft.tasks) && draft.tasks.length === 5) {
          setNewTaskForm(draft.tasks);
        }
        if (typeof draft.yesterdayNote === 'string') {
          setYesterdayNote(draft.yesterdayNote);
        }
      })();
    } catch {
      /* ignore */
    } finally {
      draftLoadedRef.current = true;
    }
  }, [userId, today, todayWin, draftLoadedRef, setNewTaskForm, setYesterdayNote]);

  // 4. LocalStorage draft autosave loop
  useEffect(() => {
    if (todayWin) {
      try {
        localStorage.removeItem(powerListDraftKey(userId, today));
      } catch {
        /* ignore */
      }
      return;
    }
    if (!draftLoadedRef.current) return;
    const t = window.setTimeout(() => {
      const draft: PowerListDraft = {
        tasks: newTaskForm,
        yesterdayNote,
        savedAt: Date.now(),
      };
      try {
        localStorage.setItem(powerListDraftKey(userId, today), JSON.stringify(draft));
      } catch {
        /* ignore */
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [userId, today, todayWin, newTaskForm, yesterdayNote, draftLoadedRef]);

  // 5. Fetch open todo items
  useEffect(() => {
    if (todayWin) return;
    listTodoItems(userId)
      .then((items) => {
        const open = (items || [])
          .filter((i) => i.status === 'open')
          .sort((a, b) => {
            const aToday = a.due_date === today;
            const bToday = b.due_date === today;
            const PRIORITY_ORDER: Record<string, number> = {
              urgent: 0,
              high: 1,
              normal: 2,
              low: 3,
            };
            if (aToday !== bToday) return aToday ? -1 : 1;
            return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
          });
        setTodoItems(open);
      })
      .catch(() => {});
  }, [userId, today, todayWin, setTodoItems]);

  // 6. Auto-proposal trigger
  useEffect(() => {
    if (!planDaySignalMountedRef.current) {
      planDaySignalMountedRef.current = true;
      return;
    }
    if (directionLoading) return;
    void (async () => {
      await applyProposalRef.current();
    })();
  }, [planDaySignal, directionLoading, planDaySignalMountedRef]);
}
