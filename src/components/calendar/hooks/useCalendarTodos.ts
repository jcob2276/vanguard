import { notify } from '../../../lib/notify';
import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { createTodoItem, setTodoStatus, updateTodoItem } from '../../../lib/todo/todo';
import { fetchGoalLineage, type SectionGoalMaps } from '../../../lib/goal/goalLineage';
import { combineDateTimeWarsawISO } from '../../../lib/date';

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
  recurrence: string | null;
}

const TODO_FIELDS = 'id, title, status, due_date, scheduled_time, duration_minutes, section_id, category, priority, notes, recurrence';

interface UseCalendarTodosProps {
  userId: string | undefined;
  rangeStart: string;
  rangeEnd: string;
}

export function useCalendarTodos({ userId, rangeStart, rangeEnd }: UseCalendarTodosProps) {
  const queryClient = useQueryClient();
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [completedTodoIds, setCompletedTodoIds] = useState<Set<string>>(new Set());

  // 1. Inbox query
  const inboxQuery = useQuery<CalendarTodo[]>({
    queryKey: ['calendar-todos-inbox', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('todo_items')
        .select(TODO_FIELDS)
        .eq('user_id', userId)
        .eq('status', 'open')
        .is('due_date', null)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data as CalendarTodo[]) || [];
    },
    enabled: !!userId,
  });

  // 2. Scheduled query
  const scheduledQuery = useQuery<CalendarTodo[]>({
    queryKey: ['calendar-todos-scheduled', userId, rangeStart, rangeEnd],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('todo_items')
        .select(TODO_FIELDS)
        .eq('user_id', userId)
        .in('status', ['open', 'done'])
        .gte('due_date', rangeStart)
        .lt('due_date', rangeEnd)
        .not('due_date', 'is', null);
      if (error) throw error;
      return (data as CalendarTodo[]) || [];
    },
    enabled: !!userId,
  });

  // 3. Goal Lineage query
  const lineageQuery = useQuery<SectionGoalMaps>({
    queryKey: ['goal-lineage', userId],
    queryFn: async () => {
      if (!userId) return { sectionGoalMap: {}, sectionDreamMap: {} };
      return fetchGoalLineage(userId);
    },
    enabled: !!userId,
  });

  const inboxTodos = useMemo(() => inboxQuery.data || [], [inboxQuery.data]);
  const scheduledTodos = useMemo(() => scheduledQuery.data || [], [scheduledQuery.data]);
  const goalMaps = useMemo(() => lineageQuery.data || { sectionGoalMap: {}, sectionDreamMap: {} }, [lineageQuery.data]);

  const invalidateTodos = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['calendar-todos-inbox', userId] }),
      queryClient.invalidateQueries({ queryKey: ['calendar-todos-scheduled', userId, rangeStart, rangeEnd] }),
    ]);
  }, [queryClient, userId, rangeStart, rangeEnd]);

  const fetchAllTodos = useCallback(async () => {
    await Promise.all([
      inboxQuery.refetch(),
      scheduledQuery.refetch(),
    ]);
  }, [inboxQuery, scheduledQuery]);

  const todosForDay = useCallback((day: string) => scheduledTodos.filter((t) => t.due_date === day), [scheduledTodos]);

  // Mutations
  const toggleTodoMutation = useMutation({
    mutationFn: async ({ id, nextStatus }: { id: string; nextStatus: string }) => {
      await setTodoStatus({ id }, nextStatus);
    },
    onSuccess: () => {
      void invalidateTodos();
    },
    onError: (e: unknown) => {
      console.error('Error toggling todo:', e);
      void fetchAllTodos();
    },
  });

  const handleToggleTodo = useCallback((id: string) => {
    const todo = scheduledTodos.find((t) => t.id === id) || inboxTodos.find((t) => t.id === id);
    if (!todo) return;
    const isDone = todo.status === 'done';
    const nextStatus = isDone ? 'open' : 'done';

    if (nextStatus === 'done') {
      setCompletedTodoIds((prev) => new Set(prev).add(id));
    }

    setTimeout(async () => {
      // Optimistically update query cache
      if (nextStatus === 'done') {
        queryClient.setQueryData<CalendarTodo[]>(['calendar-todos-inbox', userId], (prev) =>
          (prev || []).filter((t) => t.id !== id)
        );
        queryClient.setQueryData<CalendarTodo[]>(['calendar-todos-scheduled', userId, rangeStart, rangeEnd], (prev) =>
          (prev || []).map((t) => (t.id === id ? { ...t, status: 'done' } : t))
        );
      } else {
        queryClient.setQueryData<CalendarTodo[]>(['calendar-todos-scheduled', userId, rangeStart, rangeEnd], (prev) =>
          (prev || []).map((t) => (t.id === id ? { ...t, status: 'open' } : t))
        );
      }

      setCompletedTodoIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      try {
        await toggleTodoMutation.mutateAsync({ id, nextStatus });
      } catch {
        // Handled by mutation onError
      }
    }, nextStatus === 'done' ? 1000 : 0);
  }, [scheduledTodos, inboxTodos, userId, rangeStart, rangeEnd, queryClient, toggleTodoMutation]);

  const quickAddTodoMutation = useMutation({
    mutationFn: async (title: string) => {
      if (!userId) throw new Error('User ID is required');
      return createTodoItem(userId, { title });
    },
    onSuccess: (created) => {
      queryClient.setQueryData<CalendarTodo[]>(['calendar-todos-inbox', userId], (prev) => [
        created as CalendarTodo,
        ...(prev || []),
      ]);
      void invalidateTodos();
    },
    onError: (e: unknown) => {
      notify('Nie udało się utworzyć zadania.', 'error');
      console.warn('[useCalendarTodos] Failed to quick add todo:', e);
    },
  });

  const handleQuickAddTodo = useCallback(async () => {
    if (!userId || !newTodoTitle.trim()) return;
    const title = newTodoTitle.trim();
    setNewTodoTitle('');
    try {
      await quickAddTodoMutation.mutateAsync(title);
    } catch {
      // Handled by mutation onError
    }
  }, [userId, newTodoTitle, quickAddTodoMutation]);

  const createScheduledTodoMutation = useMutation({
    mutationFn: async (params: {
      title: string;
      day: string;
      startMin: number;
      durationMinutes?: number;
      notes?: string;
      recurrence?: string;
    }) => {
      if (!userId) throw new Error('User ID is required');
      const pad = (n: number) => String(n).padStart(2, '0');
      const timeOfDay = `${pad(Math.floor(params.startMin / 60))}:${pad(params.startMin % 60)}`;
      const scheduled_time = combineDateTimeWarsawISO(params.day, timeOfDay);
      return createTodoItem(userId, {
        title: params.title,
        due_date: params.day,
        scheduled_time,
        duration_minutes: params.durationMinutes ?? null,
        notes: params.notes,
        recurrence: params.recurrence,
      });
    },
    onSuccess: (created) => {
      queryClient.setQueryData<CalendarTodo[]>(['calendar-todos-scheduled', userId, rangeStart, rangeEnd], (prev) => [
        ...(prev || []),
        created as CalendarTodo,
      ]);
      void invalidateTodos();
    },
  });

  const createScheduledTodo = useCallback(async (params: {
    title: string;
    day: string;
    startMin: number;
    durationMinutes?: number;
    notes?: string;
    recurrence?: string;
  }) => {
    if (!userId) return;
    return createScheduledTodoMutation.mutateAsync(params);
  }, [userId, createScheduledTodoMutation]);

  const scheduleTodoAtMutation = useMutation({
    mutationFn: async (params: { todo: { id: string }; day: string; startMin: number; durationMinutes?: number }) => {
      const { todo, day, startMin, durationMinutes } = params;
      const pad = (n: number) => String(n).padStart(2, '0');
      const timeOfDay = `${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)}`;
      const scheduled_time = combineDateTimeWarsawISO(day, timeOfDay);
      const patch: { due_date: string; scheduled_time: string; duration_minutes?: number } = { due_date: day, scheduled_time };
      if (durationMinutes != null) patch.duration_minutes = durationMinutes;

      // Optimistically filter from inbox
      queryClient.setQueryData<CalendarTodo[]>(['calendar-todos-inbox', userId], (prev) =>
        (prev || []).filter((t) => t.id !== todo.id)
      );

      await updateTodoItem(todo.id, patch);
    },
    onSuccess: () => {
      void invalidateTodos();
    },
    onError: () => {
      void fetchAllTodos();
    },
  });

  const scheduleTodoAt = useCallback(async (todo: { id: string }, day: string, startMin: number, durationMinutes?: number) => {
    return scheduleTodoAtMutation.mutateAsync({ todo, day, startMin, durationMinutes });
  }, [scheduleTodoAtMutation]);

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
