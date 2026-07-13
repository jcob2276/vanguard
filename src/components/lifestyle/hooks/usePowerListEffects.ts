import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { listTodoItems, listTodoSections, type TodoItemRow } from '../../../lib/todo/todo';
import { listProjects } from '../../../lib/projects/projects';
import { getYesterdayWarsaw } from '../../../lib/date';
import {
  type TaskSlot,
  type PowerListDraft,
  type DailyWinWithTasks,
  type DailyWinRecord,
  powerListDraftKey,
} from '../usePowerListTypes';

interface UsePowerListEffectsArgs {
  userId: string;
  today: string;
  todayWin: DailyWinWithTasks | null;
  draftLoadedRef: React.MutableRefObject<boolean>;
  planDaySignalMountedRef: React.MutableRefObject<boolean>;
  newTaskForm: TaskSlot[];
  setNewTaskForm: React.Dispatch<React.SetStateAction<TaskSlot[]>>;
  yesterdayNote: string;
  setYesterdayNote: React.Dispatch<React.SetStateAction<string>>;
  setYesterdayWin: React.Dispatch<React.SetStateAction<DailyWinWithTasks | null>>;
  setProjectMap: React.Dispatch<React.SetStateAction<Record<string, { name: string; color: string | null }>>>;
  setTodoItems: React.Dispatch<React.SetStateAction<TodoItemRow[]>>;
  planDaySignal: number | undefined;
  directionLoading: boolean;
}

export function usePowerListEffects({
  userId,
  today,
  todayWin,
  draftLoadedRef,
  planDaySignalMountedRef: _planDaySignalMountedRef,
  newTaskForm,
  setNewTaskForm,
  yesterdayNote,
  setYesterdayNote,
  setYesterdayWin,
  setProjectMap,
  setTodoItems,
  planDaySignal: _planDaySignal,
  directionLoading: _directionLoading,
}: UsePowerListEffectsArgs) {
  // 1. Fetch project names/metadata when todayWin tasks update
  const todoIds = [
    todayWin?.task_1_todo_id,
    todayWin?.task_2_todo_id,
    todayWin?.task_3_todo_id,
    todayWin?.task_4_todo_id,
    todayWin?.task_5_todo_id,
  ].filter((id): id is string => !!id);
  const todayWinRecord = todayWin as DailyWinRecord | null;
  const directProjectIds = [1, 2, 3, 4, 5]
    .map((i) => todayWinRecord?.[`task_${i}_project_id`] as string | null)
    .filter((id): id is string => !!id);

  const projectMetadataQuery = useQuery<Record<string, { name: string; color: string | null }>>({
    queryKey: ['powerlist-project-metadata', userId, ...todoIds, ...directProjectIds],
    queryFn: async () => {
      const [{ data: items }, sections, projects] = await Promise.all([
        todoIds.length > 0
          ? supabase.from('todo_items').select('id, section_id').in('id', todoIds)
          : Promise.resolve({ data: [] }),
        listTodoSections(userId),
        listProjects(userId),
      ]);
      const sectionMap = new Map((sections ?? []).map((s) => [s.id, s]));
      const projectData = new Map((projects ?? []).map((p) => [p.id, p]));
      const result: Record<string, { name: string; color: string | null }> = {};
      for (const item of items ?? []) {
        const section = item.section_id ? sectionMap.get(item.section_id) : undefined;
        const project = section?.project_id ? projectData.get(section.project_id) : null;
        if (project) result[item.id] = { name: project.name, color: project.color };
      }
      for (let i = 1; i <= 5; i++) {
        const pid = todayWinRecord?.[`task_${i}_project_id`] as string | null;
        if (pid && projectData.has(pid)) {
          const project = projectData.get(pid) as { name: string; color: string | null };
          result[`task_project_${i}`] = { name: project.name, color: project.color };
        }
      }
      return result;
    },
    enabled: (todoIds.length > 0 || directProjectIds.length > 0),
  });

  useEffect(() => {
    if (projectMetadataQuery.data) {
      setProjectMap(projectMetadataQuery.data);
    }
  }, [projectMetadataQuery.data, setProjectMap]);

  // 2. Fetch yesterday's win details
  const yesterdayWinQuery = useQuery<DailyWinWithTasks | null>({
    queryKey: ['powerlist-yesterday-win', userId],
    queryFn: async () => {
      const yesterday = getYesterdayWarsaw();
      const { data } = await supabase
        .from('daily_wins')
        .select('id, date, day_note, daily_win_tasks(*)')
        .eq('user_id', userId)
        .eq('date', yesterday)
        .maybeSingle();
      return (data as unknown as DailyWinWithTasks) ?? null;
    },
    enabled: !!userId && !todayWin,
  });

  useEffect(() => {
    if (yesterdayWinQuery.data !== undefined) {
      setYesterdayWin(yesterdayWinQuery.data ?? null);
      setYesterdayNote(yesterdayWinQuery.data?.day_note ?? '');
      draftLoadedRef.current = false;
    }
  }, [yesterdayWinQuery.data, setYesterdayWin, setYesterdayNote, draftLoadedRef]);

  useEffect(() => {
    if (yesterdayWinQuery.isError) {
      setYesterdayWin(null);
    }
  }, [yesterdayWinQuery.isError, setYesterdayWin]);

  // 3. LocalStorage draft loading (NOT react-query — localStorage)
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

  // 4. LocalStorage draft autosave loop (NOT react-query — localStorage)
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
  const openTodosQuery = useQuery({
    queryKey: ['powerlist-open-todos', userId, today],
    queryFn: async () => {
      const items = await listTodoItems(userId);
      return (items || [])
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
    },
    enabled: !!userId && !todayWin,
  });

  useEffect(() => {
    if (openTodosQuery.data) {
      setTodoItems(openTodosQuery.data);
    }
  }, [openTodosQuery.data, setTodoItems]);
}
