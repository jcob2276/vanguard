import { useEffect, useMemo } from 'react';
import { Session } from '@supabase/supabase-js';

import { useCalendarData } from './useCalendarData';
import { useTimeBudgets } from './hooks/useTimeBudgets';
import { useCalendarTodos } from './hooks/useCalendarTodos';
import { useAIScheduling } from './hooks/useAIScheduling';
import { useSyncOura } from '../../hooks/useSyncOura';
import { useSyncActivities } from '../../hooks/useSyncActivities';
import { CalendarGrid } from './CalendarGrid';
import { CalendarEventModal } from './CalendarEventModal';

import { LIFE_SPHERES, LEGACY_CATEGORY_TO_SPHERE } from '../../lib/projects/lifeSpheres';
import { getWarsawOffset, addDays, todayStr } from './calendarHelpers';
import { updateTodoItem, deleteTodoItem } from '../../lib/todo/todo';

import { CalendarContext, CalendarContextType } from './context/CalendarContext';
import CalendarSidebar from './components/CalendarSidebar';
import CalendarHeader from './components/CalendarHeader';
import CalendarTodoModal from './components/CalendarTodoModal';
import CalendarBudgetModal from './components/CalendarBudgetModal';

interface Props {
  session: Session;
  onBack: () => void;
  onSyncCalendar: () => void;
  onResyncCalendar?: () => Promise<void> | void;
  isSyncing: boolean;
  onNavigateTo?: (dest: string) => void;
}

const buildRecurrenceRule = (
  r: '' | 'daily' | 'weekly' | 'monthly' | 'custom',
  customDays: string[],
  endDate: string
): string[] | undefined => {
  if (r === '') return undefined;
  let rule = '';
  if (r === 'daily') rule = 'FREQ=DAILY';
  else if (r === 'weekly') rule = 'FREQ=WEEKLY';
  else if (r === 'monthly') rule = 'FREQ=MONTHLY';
  else if (r === 'custom') {
    if (customDays.length === 0) return undefined;
    rule = `FREQ=WEEKLY;BYDAY=${customDays.join(',')}`;
  }
  if (endDate) {
    const formatted = endDate.replace(/-/g, '') + 'T235959Z';
    rule += `;UNTIL=${formatted}`;
  }
  return [`RRULE:${rule}`];
};

export default function CalendarView({
  session,
  onBack,
  onSyncCalendar,
  onResyncCalendar,
  isSyncing,
  onNavigateTo,
}: Props) {
  const userId = session?.user?.id as string | undefined;
  const accessToken = session?.access_token as string | undefined;

  const calData = useCalendarData(userId, accessToken);

  const {
    selectedDay,
    weekStart,
    visibleRange,
    events,
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
    editingTodo,
    setEditingTodo,
    editingTodoTitle,
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
    toastMessage,
    setToastMessage,
    sidebarCollapsed,
    toggleSidebar,
    fetchEvents,
    createEventMutation,
    updateEventMutation,
    focusTimeDefense,
    decompressionBuffer,
    showBudgetConfig,
    setShowBudgetConfig,
    setSaving,
    setCalView,
  } = calData;

  const today = todayStr();

  const calTodos = useCalendarTodos({
    userId: userId || '',
    rangeStart: visibleRange.rangeStart,
    rangeEnd: visibleRange.rangeEnd,
  });

  const {
    inboxTodos,
    completedTodoIds,
    handleToggleTodo,
    createScheduledTodo,
    scheduleTodoAt,
    goalChipFor,
    fetchAllTodos,
    todosForDay,
  } = calTodos;

  const timeBudgets = useTimeBudgets(userId || '');

  const categoryWeeklyTotals = useMemo(() => {
    const totals: Record<string, number> = Object.fromEntries(LIFE_SPHERES.map((s) => [s.id, 0]));
    const nextWeekStart = addDays(weekStart, 7);
    events.forEach((ev) => {
      if (!ev.start_time || !ev.end_time || !ev.category) return;
      const evDateStr = ev.start_time.split('T')[0];
      if (evDateStr < weekStart || evDateStr >= nextWeekStart) return;
      if (ev.summary?.toLowerCase()?.includes('sen') || ev.summary?.toLowerCase()?.includes('sleep')) return;
      const cat = LEGACY_CATEGORY_TO_SPHERE[ev.category.toLowerCase()] || ev.category.toLowerCase();
      if (!(cat in totals)) return;
      try {
        const start = new Date(ev.start_time.replace(' ', 'T')).getTime();
        const end = new Date(ev.end_time.replace(' ', 'T')).getTime();
        const diffMs = end - start;
        if (diffMs > 0) totals[cat] += diffMs / (1000 * 60 * 60);
      } catch (err) {
        console.warn('[CalendarView] Failed to parse event time:', err);
      }
    });
    return totals;
  }, [events, weekStart]);

  const categoryPrevWeeklyTotals = useMemo(() => {
    const totals: Record<string, number> = Object.fromEntries(LIFE_SPHERES.map((s) => [s.id, 0]));
    const prevWeekStart = addDays(weekStart, -7);
    events.forEach((ev) => {
      if (!ev.start_time || !ev.end_time || !ev.category) return;
      const evDateStr = ev.start_time.split('T')[0];
      if (evDateStr < prevWeekStart || evDateStr >= weekStart) return;
      if (ev.summary?.toLowerCase()?.includes('sen') || ev.summary?.toLowerCase()?.includes('sleep')) return;
      const cat = LEGACY_CATEGORY_TO_SPHERE[ev.category.toLowerCase()] || ev.category.toLowerCase();
      if (!(cat in totals)) return;
      try {
        const start = new Date(ev.start_time.replace(' ', 'T')).getTime();
        const end = new Date(ev.end_time.replace(' ', 'T')).getTime();
        const diffMs = end - start;
        if (diffMs > 0) totals[cat] += diffMs / (1000 * 60 * 60);
      } catch (err) {
        console.warn('[CalendarView] Failed to parse event time:', err);
      }
    });
    return totals;
  }, [events, weekStart]);

  const { isScheduling: isAISchedulingRunning, handleAISchedule: runAIScheduling } = useAIScheduling({
    userId,
    selectedDay,
    eventsForDay: (day) => events.filter(ev => ev.start_time?.startsWith(day)),
    focusTimeDefense,
    decompressionBuffer,
    inboxTodos,
    createEvent: async (ev) => {
      const res = await createEventMutation.mutateAsync({
        userId: userId || '',
        accessToken: accessToken || '',
        event: ev,
      });
      return { success: true, eventId: res.eventId };
    },
    scheduleTodoAt: async (todo, day, startMin, durationMinutes) => {
      await scheduleTodoAt(todo, day, startMin, durationMinutes);
    },
    fetchEvents,
    fetchAllTodos,
    setToastMessage,
  });

  const { syncingOuraSleep: isSyncingOura, handleSyncOuraSleep: syncOura } = useSyncOura({
    userId,
    selectedDay,
    updateEvent: async (ev) => {
      await updateEventMutation.mutateAsync({
        userId: userId || '',
        accessToken: accessToken || '',
        event: ev,
      });
      return { success: true, eventId: ev.id };
    },
    createEvent: async (ev) => {
      const res = await createEventMutation.mutateAsync({
        userId: userId || '',
        accessToken: accessToken || '',
        event: ev,
      });
      return { success: true, eventId: res.eventId };
    },
    fetchEvents,
    setToastMessage,
  });

  const { syncingActivities: isSyncingActivities, handleSyncActivities: syncActivities } = useSyncActivities({
    userId,
    selectedDay,
    createEvent: async (ev) => {
      const res = await createEventMutation.mutateAsync({
        userId: userId || '',
        accessToken: accessToken || '',
        event: ev,
      });
      return { success: true, eventId: res.eventId };
    },
    fetchEvents,
    setToastMessage,
  });

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage, setToastMessage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (quickCreate || editingTodo || selectedEvent || showBudgetConfig) {
          e.preventDefault();
          setQuickCreate(null);
          setEditingTodo(null);
          setSelectedEvent(null);
          setShowBudgetConfig(false);
        }
      } else if (e.key.toLowerCase() === 't' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        setCalView('dzien');
      } else if (e.key.toLowerCase() === 'w' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        setCalView('tydzien');
      } else if (e.key.toLowerCase() === 'a' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        setCalView('agenda');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickCreate, editingTodo, selectedEvent, showBudgetConfig, setQuickCreate, setEditingTodo, setSelectedEvent, setShowBudgetConfig, setCalView]);

  const handleQuickSave = async () => {
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
          recurrence: (quickRecurrence === 'custom' ? undefined : quickRecurrence) || undefined,
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
    const start = `${y}-${m}-${d}T${pad(startH)}:${pad(startM)}:00${getWarsawOffset(`${y}-${m}-${d}`)}`;
    const end = `${y}-${m}-${d}T${pad(Math.min(endH, 23))}:${pad(endM)}:00${getWarsawOffset(`${y}-${m}-${d}`)}`;
    const recurrence = buildRecurrenceRule(quickRecurrence, quickCustomDays, quickRecurrenceEndDate);
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
  };

  const handleEditSave = async () => {
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
    const recurrence = buildRecurrenceRule(editRecurrence, editCustomDays, editRecurrenceEndDate);
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
  };

  const closeEditTodoModal = () => setEditingTodo(null);

  const saveTodoTitle = async () => {
    if (!editingTodo) return;
    const trimmed = editingTodoTitle.trim();
    if (!trimmed || trimmed === editingTodo.title) return;
    await updateTodoItem(editingTodo.id, { title: trimmed });
    await fetchAllTodos();
  };

  const handleDeleteTodo = async () => {
    if (!editingTodo) return;
    await deleteTodoItem(editingTodo.id);
    await fetchAllTodos();
    closeEditTodoModal();
  };

  const contextValue: CalendarContextType = {
    userId,
    accessToken,
    today,
    calData,
    calTodos,
    timeBudgets,
    categoryWeeklyTotals,
    categoryPrevWeeklyTotals,
    isSyncing,
    isAISchedulingRunning,
    isSyncingOura,
    isSyncingActivities,
    onSyncCalendar,
    runAIScheduling,
    syncOura,
    syncActivities,
    handleQuickSave,
    handleEditSave,
    closeEditTodoModal,
    saveTodoTitle,
    deleteTodo: handleDeleteTodo,
  };

  return (
    <CalendarContext.Provider value={contextValue}>
      <div className="flex h-screen bg-background overflow-hidden relative font-sans">
        {!sidebarCollapsed && (
          <CalendarSidebar onBack={onBack} onNavigateTo={onNavigateTo} />
        )}

        <button
          onClick={toggleSidebar}
          className="absolute top-1/2 -translate-y-1/2 left-0 z-50 h-20 w-3 rounded-r-lg border border-l-0 border-border-custom/50 bg-surface/80 hover:bg-surface flex items-center justify-center text-text-muted hover:text-text-primary transition-all shadow-md focus:outline-none cursor-pointer"
          style={{ left: sidebarCollapsed ? 0 : 280 }}
        >
          <span className="text-[9px] font-black">{sidebarCollapsed ? '›' : '‹'}</span>
        </button>

        <div className="flex-1 flex flex-col min-w-0 bg-surface/5">
          <CalendarHeader />

          <CalendarGrid
            calData={calData}
            userId={userId}
            onSyncCalendar={onSyncCalendar}
            isSyncing={isSyncing}
            handleToggleTodo={handleToggleTodo}
            completedTodoIds={completedTodoIds}
            todosForDay={todosForDay}
            goalChipFor={goalChipFor}
            scheduleTodoAt={scheduleTodoAt}
          />
        </div>
        <CalendarEventModal
          calData={calData}
          userId={userId}
          accessToken={accessToken}
          handleQuickSave={handleQuickSave}
          handleEditSave={handleEditSave}
        />
        <CalendarTodoModal />
        <CalendarBudgetModal />
        {toastMessage && (
          <div className="fixed bottom-4 right-4 z-[9999] bg-text-primary text-background text-[11px] font-black uppercase tracking-wider px-4 py-3 rounded-xl shadow-lg animate-in slide-in-from-bottom duration-200">
            {toastMessage}
          </div>
        )}
      </div>
    </CalendarContext.Provider>
  );
}
