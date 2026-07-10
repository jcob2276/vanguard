import { useState, useMemo } from 'react';
import type { Database } from '../../../lib/database.types';
import { createSmartList, deleteSmartList } from '../../../lib/todo/todo';

type SmartListRow = Database['public']['Tables']['todo_smart_lists']['Row'];

interface UseTodoSmartListsProps {
  userId: string;
  smartLists: SmartListRow[];
  setSmartLists: (updater: SmartListRow[] | ((prev: SmartListRow[]) => SmartListRow[])) => void;
  run: (fn: () => Promise<unknown> | unknown) => Promise<void>;
  setError: (err: string | null) => void;
}

export function useTodoSmartLists({
  userId,
  smartLists,
  setSmartLists,
  run,
  setError,
}: UseTodoSmartListsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSmartListId, setActiveSmartListId] = useState<string | null>(null);

  const activeSmartQuery = useMemo(() => {
    if (searchQuery.trim()) return searchQuery.trim();
    if (activeSmartListId) {
      return smartLists.find((sl) => sl.id === activeSmartListId)?.query || '';
    }
    return '';
  }, [searchQuery, activeSmartListId, smartLists]);

  const saveCurrentAsSmartList = (name: string) => {
    if (!activeSmartQuery.trim() || !name.trim()) return;
    void run(async () => {
      const created = await createSmartList(userId, name, activeSmartQuery);
      setSmartLists((prev) => [...prev, created]);
    });
  };

  const removeSmartList = (id: string) => {
    if (activeSmartListId === id) setActiveSmartListId(null);
    setSmartLists((prev) => prev.filter((sl) => sl.id !== id));
    deleteSmartList(id).catch((err) =>
      setError(err instanceof Error ? err.message : String(err))
    );
  };

  return {
    searchQuery,
    setSearchQuery,
    activeSmartListId,
    setActiveSmartListId,
    activeSmartQuery,
    saveCurrentAsSmartList,
    removeSmartList,
  };
}
