import { useState, useRef, useEffect } from 'react';
import type { Database } from '../../../lib/database.types';
import { usePersistentDraft } from '../../../hooks/usePersistentDraft';
import { parseTodoQuickInput } from '../../../lib/todo/todoParser';
import { combineDateTimeWarsawISO } from '../../../lib/date';
import { createTodoItem } from '../../../lib/todo/todo';

type TodoItemRow = Database['public']['Tables']['todo_items']['Row'];

interface UseTodoQuickCaptureProps {
  userId: string;
  activeFilterSection: string | null;
  setItems: (updater: TodoItemRow[] | ((prev: TodoItemRow[]) => TodoItemRow[])) => void;
  setError: (err: string | null) => void;
  classifyInBackground: (item: TodoItemRow) => void;
}

export function useTodoQuickCapture({
  userId,
  activeFilterSection,
  setItems,
  setError,
  classifyInBackground,
}: UseTodoQuickCaptureProps) {
  // Persisted quick-add draft
  const [form, setForm] = usePersistentDraft(
    userId ? `vanguard_todo_quickadd_draft_${userId}` : null,
    {
      title: '',
      notes: '',
      priority: 'normal',
      tagsText: '',
      due_date: '',
      recurrence: '',
      section_id: '',
      scheduled_time: '',
      reminder_at: '',
    }
  );

  const [isExpanded, setIsExpanded] = useState(false);
  const quickCaptureRef = useRef<HTMLDivElement>(null);

  const parsedInput = useMemo(() => parseTodoQuickInput(form.title), [form.title]);

  const formTitleRef = useRef('');
  useEffect(() => {
    formTitleRef.current = form.title;
  }, [form.title]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (quickCaptureRef.current && !quickCaptureRef.current.contains(e.target as Node)) {
        if (formTitleRef.current.trim() === '') {
          setIsExpanded(false);
        }
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const addItem = () => {
    const title = parsedInput.title || form.title.trim();
    if (!title) return;

    const priority = parsedInput.priority || form.priority;
    const due_date = parsedInput.due_date || form.due_date || null;
    const duration_minutes = parsedInput.duration_minutes ?? null;
    const section_id = form.section_id || activeFilterSection || null;
    const notes = form.notes || null;
    const tagsText = form.tagsText;
    const recurrence = parsedInput.recurrence || form.recurrence || null;
    const scheduledTimeHHMM = parsedInput.scheduled_time || form.scheduled_time || null;
    const scheduled_time =
      scheduledTimeHHMM && due_date
        ? combineDateTimeWarsawISO(due_date, scheduledTimeHHMM)
        : null;
    const reminder_at = form.reminder_at || (scheduled_time ? scheduled_time : null);
    const tags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    // Optimistic insert
    const tempId = `__temp_${Date.now()}`;
    const optimistic: TodoItemRow = {
      id: tempId,
      user_id: userId,
      title,
      notes,
      priority,
      due_date,
      section_id,
      recurrence,
      tags,
      status: 'open',
      parent_task_id: null,
      ai_bucket: null,
      ai_classified_at: null,
      sort_order: 0,
      created_at: new Date().toISOString(),
      completed_at: null,
      updated_at: new Date().toISOString(),
      is_milestone: false,
      project_id: null,
      reminder_at,
      reminder_sent: false,
      scheduled_time,
      duration_minutes,
      is_important: false,
      category: null,
    };

    setItems((prev) => [optimistic, ...prev]);
    setForm({
      title: '',
      notes: '',
      priority: 'normal',
      tagsText: '',
      due_date: '',
      recurrence: '',
      section_id: '',
      scheduled_time: '',
      reminder_at: '',
    });
    setIsExpanded(false);

    createTodoItem(userId, {
      title,
      notes: notes || undefined,
      priority,
      due_date: due_date || undefined,
      duration_minutes: duration_minutes || undefined,
      section_id: section_id || undefined,
      recurrence: recurrence || undefined,
      tagsText,
      scheduled_time: scheduled_time || undefined,
      reminder_at: reminder_at || undefined,
    })
      .then((newItem) => {
        setItems((prev) => prev.map((i) => (i.id === tempId ? newItem : i)));
        if (!due_date && priority === 'normal') classifyInBackground(newItem);
      })
      .catch((err) => {
        setItems((prev) => prev.filter((i) => i.id !== tempId));
        setError(err.message);
      });
  };

  return {
    form,
    setForm,
    isExpanded,
    setIsExpanded,
    quickCaptureRef,
    parsedInput,
    addItem,
  };
}

// Helper inline useMemo replacement because of imports
import { useMemo } from 'react';
