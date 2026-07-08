import { useQuery } from '@tanstack/react-query';
import {
  listTodoSections,
  listTodoItems,
  listSmartLists,
} from './todo';
import { listProjects } from './projects';
import { supabase } from './supabase';

// Query Keys
export const todoKeys = {
  all: ['todo'] as const,
  sections: (userId: string) => [...todoKeys.all, 'sections', userId] as const,
  items: (userId: string) => [...todoKeys.all, 'items', userId] as const,
  projects: (userId: string) => [...todoKeys.all, 'projects', userId] as const,
  dreams: (userId: string) => [...todoKeys.all, 'dreams', userId] as const,
  smartLists: (userId: string) => [...todoKeys.all, 'smartLists', userId] as const,
};

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
