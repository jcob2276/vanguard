import type { TodoItemRow } from './useTodoData';

type SetItems = (updater: TodoItemRow[] | ((prev: TodoItemRow[]) => TodoItemRow[])) => void;
type SetError = (message: string) => void;

/**
 * Optimistically applies `patch` to the item matching `original.id`, then runs `mutate`.
 * On failure, rolls back exactly the keys touched by `patch` (derived from `original`,
 * not hand-written) and surfaces the error. Single source of truth for the
 * setItems→mutate→catch-rollback pattern that used to be copy-pasted per field across
 * Todo.tsx and TodoCardConnected.tsx — see docs/FRONTEND_GUIDE.md.
 */
export function applyOptimisticPatch(
  setItems: SetItems,
  original: TodoItemRow,
  patch: Partial<TodoItemRow>,
  mutate: () => Promise<unknown>,
  setError: SetError,
): void {
  const rollback = Object.fromEntries(
    Object.keys(patch).map((key) => [key, original[key as keyof TodoItemRow]]),
  ) as Partial<TodoItemRow>;

  setItems((prev) => prev.map((i) => (i.id === original.id ? { ...i, ...patch } : i)));

  mutate().catch((err: unknown) => {
    setError(err instanceof Error ? err.message : String(err));
    setItems((prev) => prev.map((i) => (i.id === original.id ? { ...i, ...rollback } : i)));
  });
}
