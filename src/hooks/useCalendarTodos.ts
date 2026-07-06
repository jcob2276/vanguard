import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { createTodoItem, setTodoStatus, updateTodoItem } from '../lib/todo';
import { fetchGoalLineage, type SectionGoalMaps } from '../lib/goalLineage';
import { combineDateTimeWarsawISO } from '../lib/date';

export interface CalendarTodo {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  scheduled_time: string | null;
  duration_minutes: number | null;
  section_id: string | null;
  category: string | null;
  priority: string | null;
  notes?: string | null;
}

const TODO_FIELDS = 'id, title, status, due_date, scheduled_time, duration_minutes, section_id, category, priority, notes';

interface UseCalendarTodosProps {
  userId: string | undefined;
  rangeStart: string;
  rangeEnd: string;
}

export function useCalendarTodos({ userId, rangeStart, rangeEnd }: UseCalendarTodosProps) {
  const [inboxTodos, setInboxTodos] = useState<CalendarTodo[]>([]);
  const [scheduledTodos, setScheduledTodos] = useState<CalendarTodo[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [completedTodoIds, setCompletedTodoIds] = useState<Set<string>>(new Set());
  const [goalMaps, setGoalMaps] = useState<SectionGoalMaps>({ sectionGoalMap: {}, sectionDreamMap: {} });

  const fetchInboxTodos = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('todo_items')
        .select(TODO_FIELDS)
        .eq('user_id', userId)
        .eq('status', 'open')
        .is('due_date', null)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      setInboxTodos((data as CalendarTodo[]) || []);
    } catch (e: unknown) {
      console.error('[Background Error]', e);
    }
  }, [userId]);

  const fetchScheduledTodos = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('todo_items')
        .select(TODO_FIELDS)
        .eq('user_id', userId)
        .in('status', ['open', 'done'])
        .gte('due_date', rangeStart)
        .lt('due_date', rangeEnd)
        .not('due_date', 'is', null);
      if (error) throw error;
      setScheduledTodos((data as CalendarTodo[]) || []);
    } catch (e: unknown) {
      console.error('[Background Error]', e);
    }
  }, [userId, rangeStart, rangeEnd]);

  const fetchAllTodos = useCallback(async () => {
    await Promise.all([fetchInboxTodos(), fetchScheduledTodos()]);
  }, [fetchInboxTodos, fetchScheduledTodos]);

  useEffect(() => { fetchAllTodos(); }, [fetchAllTodos]);

  useEffect(() => {
    if (!userId) return;
    fetchGoalLineage(userId).then(setGoalMaps).catch((e) => console.error('Error fetching goal lineage:', e));
  }, [userId]);

  const todosForDay = useCallback((day: string) => scheduledTodos.filter((t) => t.due_date === day), [scheduledTodos]);

  const handleToggleTodo = useCallback((id: string) => {
    const todo = scheduledTodos.find((t) => t.id === id) || inboxTodos.find((t) => t.id === id);
    if (!todo) return;
    const isDone = todo.status === 'done';
    const nextStatus = isDone ? 'open' : 'done';

    if (nextStatus === 'done') {
      setCompletedTodoIds((prev) => new Set(prev).add(id));
    }

    setTimeout(async () => {
      if (nextStatus === 'done') {
        setInboxTodos((prev) => prev.filter((t) => t.id !== id));
        setScheduledTodos((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: 'done' } : t))
        );
      } else {
        setScheduledTodos((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: 'open' } : t))
        );
        if (!todo.due_date) {
          await fetchInboxTodos();
        }
      }

      setCompletedTodoIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      try {
        await setTodoStatus({ id }, nextStatus);
      } catch (e: unknown) {
        console.error('Error toggling todo:', e);
        fetchAllTodos();
      }
    }, nextStatus === 'done' ? 1000 : 0);
  }, [scheduledTodos, inboxTodos, fetchInboxTodos, fetchAllTodos]);

  const handleQuickAddTodo = useCallback(async () => {
    if (!userId || !newTodoTitle.trim()) return;
    const title = newTodoTitle.trim();
    setNewTodoTitle('');
    try {
      const created = await createTodoItem(userId, { title });
      setInboxTodos((prev) => [created as CalendarTodo, ...prev]);
    } catch (e: unknown) {
      console.error('[Background Error]', e);
    }
  }, [userId, newTodoTitle]);

  /** Create a brand-new todo, already scheduled onto a specific day/time — used by the calendar "Zadanie" quick-create path. */
  const createScheduledTodo = useCallback(async (params: {
    title: string;
    day: string;
    startMin: number;
    durationMinutes?: number;
    notes?: string;
    recurrence?: string;
  }) => {
    if (!userId) return;
    const pad = (n: number) => String(n).padStart(2, '0');
    const timeOfDay = `${pad(Math.floor(params.startMin / 60))}:${pad(params.startMin % 60)}`;
    const scheduled_time = combineDateTimeWarsawISO(params.day, timeOfDay);
    const created = await createTodoItem(userId, {
      title: params.title,
      due_date: params.day,
      scheduled_time,
      duration_minutes: params.durationMinutes ?? null,
      notes: params.notes,
      recurrence: params.recurrence,
    });
    setScheduledTodos((prev) => [...prev, created as CalendarTodo]);
    return created;
  }, [userId]);

  /** Schedule an inbox todo onto a specific day/time — a due_date+scheduled_time write, NOT a calendar_event or completion. */
  const scheduleTodoAt = useCallback(async (todo: { id: string }, day: string, startMin: number, durationMinutes?: number) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const timeOfDay = `${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)}`;
    const scheduled_time = combineDateTimeWarsawISO(day, timeOfDay);
    const patch: { due_date: string; scheduled_time: string; duration_minutes?: number } = { due_date: day, scheduled_time };
    if (durationMinutes != null) patch.duration_minutes = durationMinutes;
    setInboxTodos((prev) => prev.filter((t) => t.id !== todo.id));
    try {
      await updateTodoItem(todo.id, patch);
    } finally {
      await fetchAllTodos();
    }
  }, [fetchAllTodos]);

  const goalChipFor = useMemo(() => (sectionId: string | null) => {
    if (!sectionId) return null;
    const pillar = goalMaps.sectionGoalMap[sectionId];
    if (!pillar) return null;
    return { pillar, dreamTitle: goalMaps.sectionDreamMap[sectionId] || null };
  }, [goalMaps]);

  return {
    inboxTodos,
    scheduledTodos,
    todosForDay,
    newTodoTitle,
    setNewTodoTitle,
    handleQuickAddTodo,
    completedTodoIds,
    handleToggleTodo,
    scheduleTodoAt,
    createScheduledTodo,
    goalChipFor,
    fetchAllTodos,
  };
}
