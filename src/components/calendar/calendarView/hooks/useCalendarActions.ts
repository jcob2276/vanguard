import { useCallback } from 'react';
import { updateTodoItem, deleteTodoItem } from '../../../../lib/todo/todo';
import { getWarsawOffset, addDays } from '../../calendarHelpers';
import { buildRecurrenceRule } from '../calendarViewHelpers';

interface UseCalendarActionsOptions {
  userId: string | undefined;
  accessToken: string | undefined;
  calData: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  calTodos: any; // eslint-disable-line @typescript-eslint/no-explicit-any
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
    setQuickCreate,
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

    if (quickType === 'task') {
      try {
        await createScheduledTodo({
          title: quickTitle.trim(),
          day: date,
          startMin,
          durationMinutes: quickDuration,
          notes: quickDescription.trim() || undefined,
          recurrence:
            (quickRecurrence === 'custom' ? undefined : quickRecurrence) ||
            undefined,
        });
        setQuickCreate(null);
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

    const endMin = startMin + quickDuration;
    const [y, m, d] = date.split('-');
    const startH = Math.floor(startMin / 60);
    const startM = startMin % 60;
    const endH = Math.floor(endMin / 60);
    const endM = endMin % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    const start = `${y}-${m}-${d}T${pad(startH)}:${pad(startM)}:00${getWarsawOffset(
      `${y}-${m}-${d}`
    )}`;
    const end = `${y}-${m}-${d}T${pad(Math.min(endH, 23))}:${pad(
      endM
    )}:00${getWarsawOffset(`${y}-${m}-${d}`)}`;
    const recurrence = buildRecurrenceRule(
      quickRecurrence,
      quickCustomDays,
      quickRecurrenceEndDate
    );
    const ev = {
      summary: quickTitle.trim(),
      start,
      end,
      category: quickCategory || undefined,
      description: quickDescription.trim() || undefined,
      recurrence,
    };
    try {
      await createEventMutation.mutateAsync({
        userId: userId || '',
        accessToken: accessToken || '',
        event: ev,
      });
      setQuickCreate(null);
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
    setQuickCreate,
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
    const evId = rawId.includes('_') ? rawId.split('_')[0] : rawId;
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
      recurrence,
    };
    try {
      await updateEventMutation.mutateAsync({
        userId: userId || '',
        accessToken: accessToken || '',
        event: ev,
      });
      setSelectedEvent(null);
      setToastMessage('Zmiany zostały zapisane! ✅');
      if (recurrence?.length && onResyncCalendar) {
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

  return {
    handleQuickSave,
    handleEditSave,
    closeEditTodoModal,
    saveTodoTitle,
    handleDeleteTodo,
  };
}
