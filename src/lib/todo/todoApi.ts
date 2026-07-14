import { useQuery } from '@tanstack/react-query';
import {
  listTodoSections,
  listTodoItems,
  listSmartLists,
} from './todo';
import { listProjects } from '../projects/projects';
import { supabase } from '../supabase';

// Query Keys
import { todoKeys } from '../queryKeys';

// ── QUERIES ──

export function useTodoSections(userId: string) {
  return useQuery({
    queryKey: todoKeys.sections(userId),
    queryFn: () => listTodoSections(userId),
    enabled: !!userId,
  });
}

export function useTodoItems(userId: string) {
  return useQuery({
    queryKey: todoKeys.items(userId),
    queryFn: () => listTodoItems(userId),
    enabled: !!userId,
  });
}

export function useProjects(userId: string) {
  return useQuery({
    queryKey: todoKeys.projects(userId),
    queryFn: () => listProjects(userId),
    enabled: !!userId,
  });
}

export function useDreams(userId: string) {
  return useQuery({
    queryKey: todoKeys.dreams(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dreams')
        .select('id, title, life_goal')
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!userId,
  });
}

export function useSmartLists(userId: string) {
  return useQuery({
    queryKey: todoKeys.smartLists(userId),
    queryFn: () => listSmartLists(userId),
    enabled: !!userId,
  });
}

export function useDailyWins(userId: string, date: string) {
  return useQuery({
    queryKey: ['todo', 'dailyWins', userId, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_wins')
        .select('id, daily_win_tasks(todo_id)')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data || null;
    },
    enabled: !!userId && !!date,
  });
}
