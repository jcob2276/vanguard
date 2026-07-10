import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useTodoSections,
  useTodoItems,
  useProjects,
  useDreams,
  useSmartLists,
  useDailyWins,
  todoKeys,
} from '../../../lib/todo/todoApi';
import type { Database } from '../../../lib/database.types';

type TodoItemRow = Database['public']['Tables']['todo_items']['Row'];
type SmartListRow = Database['public']['Tables']['todo_smart_lists']['Row'];

export function useTodoQueries(userId: string, today: string) {
  const queryClient = useQueryClient();

  const { data: sections = [], isLoading: sectionsLoading } = useTodoSections(userId);
  const { data: items = [], isLoading: itemsLoading } = useTodoItems(userId);
  const { data: projects = [] } = useProjects(userId);
  const { data: dreams = [] } = useDreams(userId);
  const { data: smartLists = [] } = useSmartLists(userId);
  const { data: dailyWins } = useDailyWins(userId, today);

  const setItems = useCallback((updater: TodoItemRow[] | ((prev: TodoItemRow[]) => TodoItemRow[])) => {
    queryClient.setQueryData(todoKeys.items(userId), (old: TodoItemRow[] | undefined) => {
      if (typeof updater === 'function') {
        return updater(old || []);
      }
      return updater;
    });
  }, [queryClient, userId]);

  const setSmartLists = useCallback((updater: SmartListRow[] | ((prev: SmartListRow[]) => SmartListRow[])) => {
    queryClient.setQueryData(todoKeys.smartLists(userId), (old: SmartListRow[] | undefined) => {
      if (typeof updater === 'function') {
        return updater(old || []);
      }
      return updater;
    });
  }, [queryClient, userId]);

  const fetchAll = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: todoKeys.all });
  }, [queryClient]);

  return {
    queryClient,
    sections, sectionsLoading,
    items, itemsLoading,
    projects, dreams, smartLists, dailyWins,
    setItems, setSmartLists, fetchAll,
  };
}
