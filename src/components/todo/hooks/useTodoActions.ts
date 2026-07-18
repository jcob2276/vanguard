import { useCallback, useState } from 'react';
import { createTodoItem, setTodoStatus, updateTodoItem } from '../../../lib/todo/todo';
import { combineDateTimeWarsawISO, warsawTimeOfDay } from '../../../lib/date';
import { NETWORK_TIMEOUT_MS } from '../../../lib/constants';
import { invokeEdge } from '../../../lib/supabase';
import { nextOccurrenceDate } from '../todoUtils';
import { parseTodoQuickInput } from '../../../lib/todo/todoParser';
import type { TodoItemRow } from '../useTodoData';
import { notify } from '../../../lib/notify';

interface UseTodoActionsProps {
  userId: string;
  today: string;
  items: TodoItemRow[];
  setItems: (updater: TodoItemRow[] | ((prev: TodoItemRow[]) => TodoItemRow[])) => void;
  setError: (err: string | null) => void;
  run: (fn: () => Promise<unknown> | unknown) => Promise<void>;
  fetchAll: () => Promise<void>;
  editingTitle: string;
  setEditingId: (id: string | null) => void;
  setEditingTitle: (title: string) => void;
}

/** Top-level write actions for the Todo view — bound to the current data + setters. */
export function useTodoActions({
  userId,
  today,
  items,
  setItems,
  setError,
  run,
  fetchAll,
  editingTitle,
  setEditingId,
  setEditingTitle,
}: UseTodoActionsProps) {
  const [batchClassifying, setBatchClassifying] = useState(false);

  const batchClassify = useCallback(async () => {
    const unclassified = items.filter((i) => i.status === 'open' && !i.ai_bucket && !i.due_date);
    if (!unclassified.length || batchClassifying) return;
    setBatchClassifying(true);
    await Promise.allSettled(unclassified.map((item) =>
      invokeEdge('vanguard-auto-classify', {
        body: { itemId: item.id, userId, title: item.title, notes: item.notes || undefined, priority: item.priority !== 'normal' ? item.priority : undefined, action: 'todo-classify' },
        signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
      })
    ));
    await fetchAll();
    setBatchClassifying(false);
  }, [items, batchClassifying, userId, fetchAll]);

  // Nested subtask — a full todo_item with its own priority/due date/reminders.
  const addChildTask = useCallback((parent: TodoItemRow, title: string) => {
    if (!title.trim()) return;
    run(() => createTodoItem(userId, {
      title: title.trim(),
      section_id: parent.section_id || undefined,
      parent_task_id: parent.id,
    }));
  }, [run, userId]);

  const saveEditTitle = useCallback((item: TodoItemRow) => {
    const rawTitle = editingTitle.trim();
    if (!rawTitle) {
      setEditingId(null);
      setEditingTitle('');
      return;
    }

    const parsed = parseTodoQuickInput(rawTitle);
    const title = parsed.title || rawTitle;

    const patch: Partial<TodoItemRow> = { title };

    if (parsed.priority) patch.priority = parsed.priority;
    if (parsed.due_date) patch.due_date = parsed.due_date;
    if (parsed.recurrence) patch.recurrence = parsed.recurrence;
    if (parsed.duration_minutes !== null) patch.duration_minutes = parsed.duration_minutes;

    if (parsed.scheduled_time) {
      const activeDueDate = parsed.due_date || item.due_date || today;
      patch.scheduled_time = combineDateTimeWarsawISO(activeDueDate, parsed.scheduled_time);
      patch.reminder_at = patch.scheduled_time;
      patch.reminder_sent = false;
    }

    const hasChanges = (Object.keys(patch) as (keyof TodoItemRow)[]).some(key => patch[key] !== item[key]);
    if (hasChanges) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...patch } : i));
      run(() => updateTodoItem(item.id, patch));
    }

    setEditingId(null);
    setEditingTitle('');
  }, [editingTitle, today, setItems, run, setEditingId, setEditingTitle]);

  const handleComplete = useCallback((item: TodoItemRow) => {
    const newStatus = item.status === 'done' ? 'open' : 'done';
    const now = new Date().toISOString();
    setItems(prev => prev.map(i => i.id === item.id
      ? { ...i, status: newStatus, completed_at: newStatus === 'done' ? now : null }
      : i
    ));
    setTodoStatus(item, newStatus)
      .then(async () => {
        if (newStatus === 'done' && !item.recurrence) {
          notify('Zadanie wykonane.', 'success', {
            action: {
              label: 'Cofnij',
              onClick: () => {
                setItems(prev => prev.map(i => i.id === item.id
                  ? { ...i, status: 'open', completed_at: null }
                  : i
                ));
                void setTodoStatus({ id: item.id }, 'open').catch((err) => {
                  setError(err instanceof Error ? err.message : String(err));
                });
              },
            },
          });
        }
        if (newStatus === 'done' && item.recurrence && userId) {
          const nextDate = nextOccurrenceDate(item.due_date, item.recurrence, today);
          let nextScheduledTime: string | undefined = undefined;
          let nextReminderAt: string | undefined = undefined;

          if (item.scheduled_time && nextDate) {
            const timeStr = warsawTimeOfDay(item.scheduled_time);
            nextScheduledTime = combineDateTimeWarsawISO(nextDate, timeStr);
            if (item.reminder_at) {
              nextReminderAt = nextScheduledTime;
            }
          }

          const newItem = await createTodoItem(userId, {
            title: item.title, notes: item.notes ?? undefined, priority: item.priority || 'normal',
            tagsText: (item.tags || []).join(', '), section_id: item.section_id ?? undefined,
            due_date: nextDate || undefined, recurrence: item.recurrence ?? undefined,
            scheduled_time: nextScheduledTime, reminder_at: nextReminderAt,
          });
          setItems(prev => [...prev, newItem]);
        }
      })
      .catch((err) => {
        console.error('[handleComplete] setTodoStatus failed, rolling back:', err);
        setError(err instanceof Error ? err.message : String(err));
        setItems(prev => prev.map(i => i.id === item.id
          ? { ...i, status: item.status, completed_at: item.completed_at }
          : i
        ));
      });
  }, [today, userId, setItems, setError]);

  return {
    batchClassifying,
    batchClassify,
    addChildTask,
    saveEditTitle,
    handleComplete,
  };
}
