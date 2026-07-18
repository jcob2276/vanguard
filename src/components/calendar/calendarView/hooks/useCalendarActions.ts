import { useCallback } from 'react';
import { updateTodoItem, deleteTodoItem } from '../../../../lib/todo/todo';
import { getWarsawOffset, addDays } from '../../calendarHelpers';
import { buildRecurrenceRule } from '../calendarViewHelpers';
import { parseTodoQuickInput } from '../../../../lib/todo/todoParser';
import type { useCalendarData } from '../../hooks/useCalendarData';
import type { useCalendarTodos } from '../../hooks/useCalendarTodos';

interface UseCalendarActionsOptions {
  userId: string | undefined;
  accessToken: string | undefined;
  calData: ReturnType<typeof useCalendarData>;
  calTodos: ReturnType<typeof useCalendarTodos>;
  onResyncCalendar?: () => Promise<void> | void;
}

export function useCalendarActions({
  userId,
  accessToken,
  calData,
  calTodos,
  onResyncCalendar,
}: UseCalendarActionsOptions) {
  const {
    quickCreate,
    closeQuickCreate,
    quickTitle,
    quickDuration,
    quickCategory,
    quickType,
    quickDescription,
    quickRecurrence,
    quickCustomDays,
    quickRecurrenceEndDate,
    selectedEvent,
    setSelectedEvent,
    editTitle,
    editCategory,
    editStart,
    editEnd,
    editDate,
    editDescription,
    editRecurrence,
    editCustomDays,
    editRecurrenceEndDate,
    editingTodo,
    setEditingTodo,
    editingTodoTitle,
    setSaving,
    setToastMessage,
    fetchEvents,
    createEventMutation,
    updateEventMutation,
  } = calData;

  const { createScheduledTodo, fetchAllTodos } = calTodos;

  const handleQuickSave = useCallback(async () => {
    if (!quickCreate || !quickTitle.trim()) return;
    setSaving(true);
    const { date, startMin } = quickCreate;
    const parsed = parseTodoQuickInput(quickTitle);
    const parsedStartMin = parsed.scheduled_time
      ? Number(parsed.scheduled_time.slice(0, 2)) * 60 + Number(parsed.scheduled_time.slice(3, 5))
      : startMin;
    const parsedDate = parsed.date_explicit && parsed.due_date ? parsed.due_date : date;
    const parsedDuration = parsed.duration_minutes || quickDuration;
    const parsedRecurrence = parsed.recurrence || (quickRecurrence === 'custom' ? undefined : quickRecurrence) || undefined;
    const parsedTitle = parsed.title || quickTitle.trim();

    if (quickType === 'task') {
      try {
        await createScheduledTodo({
          title: parsedTitle,
          day: parsedDate,
          startMin: parsedStartMin,
          durationMinutes: parsedDuration,
          notes: quickDescription.trim() || undefined,
          recurrence: parsedRecurrence,
          priority: parsed.priority || undefined,
          tagsText: parsed.tags.join(','),
        });
        closeQuickCreate();
        setToastMessage('Dodano i zaplanowano zadanie! 📅');
        await fetchAllTodos();
      } catch (err) {
        console.error('create scheduled todo error:', err);
        setToastMessage('Błąd tworzenia zadania.');
      } finally {
        setSaving(false);
      }
      return;
    }

    const endMin = parsedStartMin + parsedDuration;
    const [y, m, d] = parsedDate.split('-');
    const startH = Math.floor(parsedStartMin / 60);
    const startM = parsedStartMin % 60;
    const endDate = addDays(parsedDate, Math.floor(endMin / (24 * 60)));
    const normalizedEndMin = endMin % (24 * 60);
    const endH = Math.floor(normalizedEndMin / 60);
    const endM = normalizedEndMin % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    const start = `${y}-${m}-${d}T${pad(startH)}:${pad(startM)}:00${getWarsawOffset(
      parsedDate
    )}`;
    const end = `${endDate}T${pad(endH)}:${pad(
      endM
    )}:00${getWarsawOffset(endDate)}`;
    const recurrence = buildRecurrenceRule(
      (parsed.recurrence || quickRecurrence) as typeof quickRecurrence,
      quickCustomDays,
      quickRecurrenceEndDate
    );
    const ev = {
      summary: parsedTitle,
      start,
      end,
      category: quickCategory || undefined,
      description: quickDescription.trim() || undefined,
      recurrence: recurrence ?? null,
    };
    try {
      await createEventMutation.mutateAsync({
        userId: userId || '',
        accessToken: accessToken || '',
        event: ev,
      });
      closeQuickCreate();
      setToastMessage('Dodano nowe wydarzenie! 🗓️');
      if (recurrence?.length && onResyncCalendar) {
        await onResyncCalendar();
        await fetchEvents();
      }
    } catch (err) {
      console.error('create event error:', err);
      setToastMessage('Błąd zapisu wydarzenia.');
    } finally {
      setSaving(false);
    }
  }, [
    quickCreate,
    quickTitle,
    quickType,
    quickDuration,
    quickDescription,
    quickRecurrence,
    quickRecurrenceEndDate,
    quickCategory,
    quickCustomDays,
    userId,
    accessToken,
    createEventMutation,
    onResyncCalendar,
    fetchEvents,
    createScheduledTodo,
    fetchAllTodos,
    closeQuickCreate,
    setToastMessage,
    setSaving,
  ]);

  const handleEditSave = useCallback(async () => {
    if (!selectedEvent || !editTitle.trim() || !editStart || !editEnd || !editDate) return;
    setSaving(true);

    const start = `${editDate}T${editStart}:00${getWarsawOffset(editDate)}`;
    let endDateStr = editDate;

    if (editEnd < editStart) {
      endDateStr = addDays(editDate, 1);
    }

    const end = `${endDateStr}T${editEnd}:00${getWarsawOffset(endDateStr)}`;
    const rawId = selectedEvent.event_id || selectedEvent.id;
    const evId = selectedEvent.series_id || rawId;
    const recurrence = buildRecurrenceRule(
      editRecurrence,
      editCustomDays,
      editRecurrenceEndDate
    );
    const ev = {
      id: evId,
      summary: editTitle.trim(),
      start,
      end,
      category: editCategory || undefined,
      description: editDescription.trim() || undefined,
      recurrence: recurrence ?? null,
    };
    try {
      await updateEventMutation.mutateAsync({
        userId: userId || '',
        accessToken: accessToken || '',
        event: ev,
      });
      setSelectedEvent(null);
      setToastMessage('Zmiany zostały zapisane! ✅');
      if (onResyncCalendar) {
        await onResyncCalendar();
        await fetchEvents();
      }
    } catch (err) {
      console.error('edit event save error:', err);
      setToastMessage('Nie udało się zapisać zmian.');
    } finally {
      setSaving(false);
    }
  }, [
    selectedEvent,
    editTitle,
    editStart,
    editEnd,
    editDate,
    editDescription,
    editRecurrence,
    editCustomDays,
    editRecurrenceEndDate,
    editCategory,
    userId,
    accessToken,
    updateEventMutation,
    onResyncCalendar,
    fetchEvents,
    setSelectedEvent,
    setToastMessage,
    setSaving,
  ]);

  const closeEditTodoModal = useCallback(() => {
    setEditingTodo(null);
  }, [setEditingTodo]);

  const saveTodoTitle = useCallback(async () => {
    if (!editingTodo) return;
    const trimmed = editingTodoTitle.trim();
    if (!trimmed || trimmed === editingTodo.title) return;
    await updateTodoItem(editingTodo.id, { title: trimmed });
    await fetchAllTodos();
  }, [editingTodo, editingTodoTitle, fetchAllTodos]);

  const handleDeleteTodo = useCallback(async () => {
    if (!editingTodo) return;
    await deleteTodoItem(editingTodo.id);
    await fetchAllTodos();
    closeEditTodoModal();
  }, [editingTodo, fetchAllTodos, closeEditTodoModal]);

  const saveTodoChanges = useCallback(async () => {
    if (!editingTodo) return;
    const title = editingTodoTitle.trim();
    if (!title || !editingTodo.due_date) return;
    setSaving(true);
    try {
      await updateTodoItem(editingTodo.id, {
        title,
        due_date: editingTodo.due_date,
        scheduled_time: editingTodo.scheduled_time,
        duration_minutes: editingTodo.duration_minutes,
        recurrence: editingTodo.recurrence,
        notes: editingTodo.notes?.trim() || null,
      });
      await fetchAllTodos();
      setEditingTodo(null);
      setToastMessage('Zadanie zostało zaktualizowane.');
    } finally {
      setSaving(false);
    }
  }, [editingTodo, editingTodoTitle, fetchAllTodos, setEditingTodo, setSaving, setToastMessage]);

  return {
    handleQuickSave,
    handleEditSave,
    closeEditTodoModal,
    saveTodoTitle,
    saveTodoChanges,
    handleDeleteTodo,
  };
}
