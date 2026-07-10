import { useCallback } from 'react';
import { NETWORK_TIMEOUT_MS } from '../../../lib/constants';
import { invokeEdge } from '../../../lib/supabase';
import type { Database } from '../../../lib/database.types';

type TodoItemRow = Database['public']['Tables']['todo_items']['Row'];

interface UseTodoRunHelpersProps {
  userId: string;
  setBusy: (busy: boolean) => void;
  setError: (err: string | null) => void;
  fetchAll: () => Promise<void>;
}

export function useTodoRunHelpers({ userId, setBusy, setError, fetchAll }: UseTodoRunHelpersProps) {
  const run = async (fn: () => Promise<unknown> | unknown) => {
    setBusy(true);
    try { await fn(); await fetchAll(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };

  const classifyInBackground = useCallback((item: TodoItemRow) => {
    invokeEdge('vanguard-auto-classify', {
      body: { itemId: item.id, userId, title: item.title, notes: item.notes || undefined, due_date: item.due_date || undefined, priority: item.priority !== 'normal' ? item.priority : undefined, action: 'todo-classify' },
      signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
    }).then(() => setTimeout(fetchAll, 200)).catch(() => {});
  }, [userId, fetchAll]);

  return { run, classifyInBackground };
}
