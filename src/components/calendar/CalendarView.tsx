import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  RefreshCw,
  Calendar,
  X,
  Trash2,
  Sparkles,
  Zap,
  Check,
} from 'lucide-react';
import { Session } from '@supabase/supabase-js';

import { useCalendarData } from './useCalendarData';
import { useTimeBudgets } from '../../hooks/useTimeBudgets';
import { useCalendarTodos } from '../../hooks/useCalendarTodos';
import { useAIScheduling } from '../../hooks/useAIScheduling';
import { useSyncOura } from '../../hooks/useSyncOura';
import { useSyncActivities } from '../../hooks/useSyncActivities';
import { CalendarGrid } from './CalendarGrid';
import { CalendarEventModal } from './CalendarEventModal';

import { LIFE_SPHERES, LEGACY_CATEGORY_TO_SPHERE } from '../../lib/lifeSpheres';
import { getWarsawOffset, addDays, weekMon, todayStr } from './calendarHelpers';
import { combineDateTimeWarsawISO } from '../../lib/date';
import { updateTodoItem, deleteTodoItem } from '../../lib/todo';

import MiniCalendar from './MiniCalendar';
import CalendarSidebarTodos from './CalendarSidebarTodos';
import CalendarBudgetPanel from './CalendarBudgetPanel';
import SolarDayWidget from './SolarDayWidget';

interface Props {
  session: Session;
  onBack: () => void;
  onSyncCalendar: () => void;
  onResyncCalendar?: () => Promise<void> | void;
  isSyncing: boolean;
  onNavigateTo?: (dest: string) => void;
}

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
    calView,
    setCalView,
    selectedDay,
    setSelectedDay,
    weekStart,
    setWeekStart,
    visibleRange,
    events,
    loading,
    saving,
    setSaving,
    quickCreate,
    setQuickCreate,
    quickTitle,
    setQuickTitle,
    quickDuration,
    setQuickDuration,
    quickCategory,
    setQuickCategory,
    quickType,
    setQuickType,
    quickDescription,
    setQuickDescription,
    quickRecurrence,
    setQuickRecurrence,
    quickCustomDays,
    setQuickCustomDays,
    quickRecurrenceEndDate,
    setQuickRecurrenceEndDate,
    editingTodo,
    setEditingTodo,
    editingTodoTitle,
    setEditingTodoTitle,
    selectedEvent,
    setSelectedEvent,
    editTitle,
    setEditTitle,
    editCategory,
    setEditCategory,
    editStart,
    setEditStart,
    editEnd,
    setEditEnd,
    editDate,
    setEditDate,
    editRecurrence,
    setEditRecurrence,
    editCustomDays,
    setEditCustomDays,
    editRecurrenceEndDate,
    setEditRecurrenceEndDate,
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
    budgetMinInputs,
    setBudgetMinInputs,
    budgetMaxInputs,
    setBudgetMaxInputs,
    budgetPanelExpanded,
    setBudgetPanelExpanded,
  } = calData;

  const today = todayStr();

  // Timed/untimed todos fetch
  const {
    inboxTodos,
    scheduledTodos,
    todosForDay,
    newTodoTitle,
    setNewTodoTitle,
    handleQuickAddTodo,
    completedTodoIds,
    handleToggleTodo,
    scheduleTodoAt,
    createScheduledTodo,
    goalChipFor,
    fetchAllTodos,
  } = useCalendarTodos({
    userId: userId || '',
    rangeStart: visibleRange.rangeStart,
    rangeEnd: visibleRange.rangeEnd,
  });

  // Time Budgets hook
  const {
    budgets,
    saveBudget,
    refresh: refreshBudgets,
  } = useTimeBudgets(userId || '');

  // Compute weekly actuals per category
  const categoryWeeklyTotals = useMemo(() => {
    const totals: Record<string, number> = Object.fromEntries(LIFE_SPHERES.map((s) => [s.id, 0]));
    const nextWeekStart = addDays(weekStart, 7);
    events.forEach((ev) => {
      if (!ev.start_time || !ev.end_time || !ev.category) return;

      const evDateStr = ev.start_time.split('T')[0];
      // Only include events in the CURRENT active week
      if (evDateStr < weekStart || evDateStr >= nextWeekStart) return;

      const isSleep = ev.summary?.toLowerCase()?.includes('sen') || ev.summary?.toLowerCase()?.includes('sleep');
      if (isSleep) return;

      const cat = LEGACY_CATEGORY_TO_SPHERE[ev.category.toLowerCase()] || ev.category.toLowerCase();

      if (!(cat in totals)) return;
      try {
        const start = new Date(ev.start_time.replace(' ', 'T')).getTime();
        const end = new Date(ev.end_time.replace(' ', 'T')).getTime();
        const diffMs = end - start;
        if (diffMs > 0) {
          const hours = diffMs / (1000 * 60 * 60);
          totals[cat] += hours;
        }
      } catch (err: unknown) {
        console.error('[Background Error]', err);
      }
    });
    return totals;
  }, [events, weekStart]);

  // Compute previous week's actuals per category
  const categoryPrevWeeklyTotals = useMemo(() => {
    const totals: Record<string, number> = Object.fromEntries(LIFE_SPHERES.map((s) => [s.id, 0]));
    const prevWeekStart = addDays(weekStart, -7);
    events.forEach((ev) => {
      if (!ev.start_time || !ev.end_time || !ev.category) return;

      const evDateStr = ev.start_time.split('T')[0];
      // Only include events in the PREVIOUS week
      if (evDateStr < prevWeekStart || evDateStr >= weekStart) return;

      const isSleep = ev.summary?.toLowerCase()?.includes('sen') || ev.summary?.toLowerCase()?.includes('sleep');
      if (isSleep) return;

      const cat = LEGACY_CATEGORY_TO_SPHERE[ev.category.toLowerCase()] || ev.category.toLowerCase();

      if (!(cat in totals)) return;
      try {
        const start = new Date(ev.start_time.replace(' ', 'T')).getTime();
        const end = new Date(ev.end_time.replace(' ', 'T')).getTime();
        const diffMs = end - start;
        if (diffMs > 0) {
          const hours = diffMs / (1000 * 60 * 60);
          totals[cat] += hours;
        }
      } catch (err: unknown) {
        console.error('[Background Error]', err);
      }
    });
    return totals;
  }, [events, weekStart]);

  // Sync / AI tools hooks
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

  // Toast auto-dismissal
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage, setToastMessage]);

  // Keyboard shortcuts: T = Dzień, W = Tydzień, A = Agenda, ←/→ = nawigacja, Esc = anulowanie modalów
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc closes any active modal, even if typing inside an input/textarea
      if (e.key === 'Escape') {
        if (quickCreate || editingTodo || selectedEvent || showBudgetConfig) {
          e.preventDefault();
          setQuickCreate(null);
          setEditingTodo(null);
          setSelectedEvent(null);
          setShowBudgetConfig(false);
          return;
        }
      }

      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 't' || e.key === 'T') { setCalView('dzien'); return; }
      if (e.key === 'w' || e.key === 'W') { setCalView('tydzien'); return; }
      if (e.key === 'a' || e.key === 'A') { setCalView('agenda'); return; }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const delta = e.key === 'ArrowLeft' ? -1 : 1;
        const step = calView === 'dzien' ? delta : delta * 7;
        const nextDay = addDays(selectedDay, step);
        setSelectedDay(nextDay);
        setWeekStart(weekMon(nextDay));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    setCalView,
    calView,
    selectedDay,
    setSelectedDay,
    setWeekStart,
    quickCreate,
    setQuickCreate,
    editingTodo,
    setEditingTodo,
    selectedEvent,
    setSelectedEvent,
    showBudgetConfig,
    setShowBudgetConfig,
  ]);

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

  const handleSaveBudgets = async () => {
    try {
      const categories = LIFE_SPHERES.map((s) => s.id);
      for (const cat of categories) {
        const minRaw = budgetMinInputs[cat] || '';
        const maxRaw = budgetMaxInputs[cat] || '';
        const minHours = minRaw.trim() !== '' ? Number(minRaw) : null;
        const maxHours = maxRaw.trim() !== '' ? Number(maxRaw) : null;
        await saveBudget(cat, minHours, maxHours);
      }
      setShowBudgetConfig(false);
      setToastMessage('Zapisano budżety czasu! 💼');
      await refreshBudgets();
    } catch (err) {
      console.error('Failed to save budgets:', err);
      setToastMessage('Błąd zapisu budżetów.');
    }
  };

  // ── Edit scheduled todo modal helper functions ──
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

  return (
    <div className="flex h-screen bg-background overflow-hidden relative font-sans">
      {/* 1. Sidebar Panel */}
      {!sidebarCollapsed && (
        <div className="w-[280px] shrink-0 border-r border-border-custom/50 flex flex-col bg-surface/10 select-none">
          {/* Back Navigation header */}
          <div className="h-[60px] shrink-0 border-b border-border-custom/20 flex items-center px-4 gap-2">
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors shrink-0"
            >
              <ChevronLeft size={16} /> Powrót
            </button>

            <div className="flex-1" />

            {/* Skróty do innych apek */}
            <button
              onClick={() => onNavigateTo?.('todo')}
              title="Zadania"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-text-muted hover:text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20"
            >
              <Check size={13} /> Todo
            </button>
            <button
              onClick={() => onNavigateTo?.('keep')}
              title="Notatki"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-text-muted hover:text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20"
            >
              <Sparkles size={13} /> Notatki
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
            <MiniCalendar
              selectedDay={selectedDay}
              onSelectDay={(day) => {
                setSelectedDay(day);
                setWeekStart(weekMon(day));
              }}
            />

            <SolarDayWidget dateStr={selectedDay} />

            <CalendarBudgetPanel
              categoryWeeklyTotals={categoryWeeklyTotals}
              categoryPrevWeeklyTotals={categoryPrevWeeklyTotals}
              budgets={budgets}
              onConfigure={() => {
                const mins: Record<string, string> = {};
                const maxs: Record<string, string> = {};
                LIFE_SPHERES.map((s) => s.id).forEach((cat) => {
                  const b = budgets.find((item) => item.category === cat);
                  mins[cat] = b?.min_hours !== null && b?.min_hours !== undefined ? String(b.min_hours) : '';
                  maxs[cat] = b?.max_hours !== null && b?.max_hours !== undefined ? String(b.max_hours) : '';
                });
                setBudgetMinInputs(mins);
                setBudgetMaxInputs(maxs);
                setShowBudgetConfig(true);
              }}
            />
            
            <CalendarSidebarTodos
              sidebarTodos={inboxTodos}
              newTodoTitle={newTodoTitle}
              setNewTodoTitle={setNewTodoTitle}
              handleQuickAddTodo={handleQuickAddTodo}
              handleToggleTodo={handleToggleTodo}
              completedTodoIds={completedTodoIds}
              goalChipFor={goalChipFor}
            />
          </div>
        </div>
      )}

      {/* Collapse/Expand Sidebar Handle */}
      <button
        onClick={toggleSidebar}
        className="absolute top-1/2 -translate-y-1/2 left-0 z-50 h-20 w-3 rounded-r-lg border border-l-0 border-border-custom/50 bg-surface/80 hover:bg-surface flex items-center justify-center text-text-muted hover:text-text-primary transition-all shadow-md focus:outline-none"
        style={{ left: sidebarCollapsed ? 0 : 280 }}
      >
        <span className="text-[9px] font-black">{sidebarCollapsed ? '›' : '‹'}</span>
      </button>

      {/* 2. Main Calendar Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-surface/5">
        {/* Navigation & Controls header */}
        <div className="h-[60px] shrink-0 border-b border-border-custom/20 flex items-center px-6 justify-between bg-background select-none">
          <div className="flex items-center gap-2">
            <div className="flex gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-border-custom/30">
              {(['dzien', 'tydzien', 'agenda'] as const).map((view) => {
                const label = view === 'dzien' ? 'Dzień' : view === 'tydzien' ? 'Tydzień' : 'Agenda';
                const shortcut = view === 'dzien' ? 'T' : view === 'tydzien' ? 'W' : 'A';
                return (
                  <button
                    key={view}
                    onClick={() => setCalView(view)}
                    title={`${label} (${shortcut})`}
                    className={`flex items-center gap-1.5 text-[11px] font-black px-4 py-2 rounded-lg transition-all capitalize ${
                      calView === view
                        ? 'bg-background text-text-primary shadow-sm'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {label}
                    <kbd className={`text-[9px] font-mono px-1 py-0.5 rounded border ${calView === view ? 'border-border-custom/60 bg-black/5 dark:bg-white/10 text-text-muted' : 'border-transparent'}`}>{shortcut}</kbd>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sync buttons */}
            <button
              onClick={onSyncCalendar}
              disabled={isSyncing}
              className="flex items-center gap-1.5 rounded-xl border border-border-custom/60 hover:bg-surface-solid px-3.5 py-2 text-[11.5px] font-bold text-text-secondary transition-colors"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? 'Synchronizuję...' : 'GCal'}</span>
            </button>
            <button
              onClick={async () => {
                try {
                  await runAIScheduling();
                  setToastMessage('Harmonogram AI zoptymalizowany! ✨');
                  await fetchEvents();
                } catch {
                  setToastMessage('Błąd AI Scheduling');
                }
              }}
              disabled={isAISchedulingRunning}
              className="flex items-center gap-1.5 rounded-xl border border-border-custom/60 hover:bg-surface-solid px-3.5 py-2 text-[11.5px] font-bold text-text-secondary transition-colors"
            >
              <Sparkles size={14} className={isAISchedulingRunning ? 'animate-pulse text-amber-400' : ''} />
              <span>AI</span>
            </button>
          </div>
        </div>

        {/* 3. Main Grid */}
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

      {/* 4. Modals and Dialogs */}
      <CalendarEventModal
        calData={calData}
        userId={userId}
        accessToken={accessToken}
        handleQuickSave={handleQuickSave}
        handleEditSave={handleEditSave}
      />

      {/* 5. Custom Todo Editor Modal (Rich interactive version) */}
      {editingTodo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]" onClick={closeEditTodoModal}>
          <div className="w-full max-w-sm rounded-2xl bg-background border border-border-custom/80 shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-black text-text-primary uppercase tracking-wider">Edytuj zadanie</p>
              <button onClick={closeEditTodoModal} className="p-1 text-text-muted hover:text-text-primary transition-colors">
                <X size={18} />
              </button>
            </div>

            <input
              autoFocus
              value={editingTodoTitle}
              onChange={(e) => setEditingTodoTitle(e.target.value)}
              onBlur={saveTodoTitle}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="w-full rounded-xl border border-border-custom/60 bg-surface-solid px-3 py-2 text-[13px] font-semibold text-text-primary outline-none focus:border-primary/40"
            />

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Data i Czas</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={editingTodo.due_date || ''}
                  onChange={async (e) => {
                    const due_date = e.target.value || null;
                    const scheduled_time = editingTodo.scheduled_time && due_date
                      ? combineDateTimeWarsawISO(due_date, editingTodo.scheduled_time.slice(11, 16))
                      : editingTodo.scheduled_time;
                    setEditingTodo({ ...editingTodo, due_date, scheduled_time });
                    await updateTodoItem(editingTodo.id, { due_date, scheduled_time });
                    await fetchAllTodos();
                  }}
                  className="bg-slate-50 dark:bg-white/[0.02] border border-border-custom/60 rounded-xl px-2 py-2.5 text-[12px] font-semibold text-text-primary outline-none focus:border-primary/50 transition-all cursor-pointer"
                />
                <input
                  type="time"
                  value={editingTodo.scheduled_time ? editingTodo.scheduled_time.slice(11, 16) : ''}
                  onChange={async (e) => {
                    const timeVal = e.target.value;
                    const scheduled_time = timeVal && editingTodo.due_date
                      ? combineDateTimeWarsawISO(editingTodo.due_date, timeVal)
                      : null;
                    setEditingTodo({ ...editingTodo, scheduled_time });
                    await updateTodoItem(editingTodo.id, { scheduled_time });
                    await fetchAllTodos();
                  }}
                  className="bg-slate-50 dark:bg-white/[0.02] border border-border-custom/60 rounded-xl px-2 py-2.5 text-[12px] font-semibold text-text-primary outline-none focus:border-primary/50 transition-all cursor-pointer"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                await handleToggleTodo(editingTodo.id);
                const isDone = !completedTodoIds.has(editingTodo.id);
                setToastMessage(isDone ? `Ukończono: "${editingTodo.title}" ✅` : `Cofnięto ukończenie: "${editingTodo.title}"`);
                closeEditTodoModal();
              }}
              className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-[12px] font-black uppercase transition-all active:scale-[0.98] ${
                completedTodoIds.has(editingTodo.id)
                  ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/15 border border-amber-500/20'
                  : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/20'
              }`}
            >
              <Check size={14} />
              {completedTodoIds.has(editingTodo.id) ? 'Oznacz jako nieukończone' : 'Oznacz jako ukończone'}
            </button>

            {!completedTodoIds.has(editingTodo.id) && (
              <div className="rounded-xl border border-border-custom bg-surface-solid/30 p-3.5 space-y-2.5">
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  Przełóż na jutro
                </label>
                
                <textarea
                  placeholder="Dlaczego nie udało się zrobić tego zadania? (opcjonalnie)"
                  value={editingTodo.notes || ''}
                  onChange={(e) => {
                    setEditingTodo({ ...editingTodo, notes: e.target.value });
                  }}
                  className="w-full min-h-[60px] rounded-lg border border-border-custom bg-background px-2.5 py-2 text-[11px] font-medium text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/40 resize-y"
                />

                <button
                  type="button"
                  onClick={async () => {
                    const currentDateStr = editingTodo.due_date || today;
                    const tomorrowStr = addDays(currentDateStr, 1);
                    
                    let newScheduledTime = null;
                    if (editingTodo.scheduled_time) {
                      const timePart = editingTodo.scheduled_time.slice(11, 16);
                      newScheduledTime = combineDateTimeWarsawISO(tomorrowStr, timePart);
                    }

                    await updateTodoItem(editingTodo.id, {
                      due_date: tomorrowStr,
                      scheduled_time: newScheduledTime,
                      notes: editingTodo.notes?.trim() || null
                    });
                    await fetchAllTodos();
                    setToastMessage(`Przełożono na jutro: "${editingTodo.title}" ➡️`);
                    closeEditTodoModal();
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary/10 border border-primary/25 py-2 text-[11px] font-black uppercase text-primary hover:bg-primary/15 transition-all active:scale-[0.98]"
                >
                  Przełóż na jutro
                </button>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleDeleteTodo}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/5 py-2.5 text-[12px] font-black text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 size={13} /> Usuń
              </button>
            </div>
          </div>
        </div>
      )}

      {showBudgetConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]" onClick={() => setShowBudgetConfig(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-background border border-border-custom/80 shadow-2xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-black text-text-primary uppercase tracking-wider">Ustaw Budżety Czasu</p>
              <button onClick={() => setShowBudgetConfig(false)} className="p-1 text-text-muted hover:text-text-primary transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {LIFE_SPHERES.map((sphere) => {
                let placeholderMin = 'np. 3';
                let placeholderMax = 'brak';
                if (sphere.id === 'praca') {
                  placeholderMin = 'brak';
                  placeholderMax = 'np. 40';
                }
                return (
                  <div key={sphere.id} className="p-3.5 bg-surface-solid/10 dark:bg-white/[0.02] border border-border-custom/30 rounded-2xl space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${sphere.dot}`} />
                      <span className="text-[11px] font-black text-text-primary uppercase tracking-wider">{sphere.label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider block">Min (godz)</span>
                        <input
                          type="number"
                          step="0.5"
                          placeholder={placeholderMin}
                          value={budgetMinInputs[sphere.id] || ''}
                          onChange={(e) => setBudgetMinInputs({ ...budgetMinInputs, [sphere.id]: e.target.value })}
                          className="w-full bg-slate-100/50 dark:bg-black/20 border border-border-custom/50 rounded-xl px-3 py-2 text-[12px] font-bold text-text-primary outline-none focus:border-primary/50 transition-all focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider block">Max (godz)</span>
                        <input
                          type="number"
                          step="0.5"
                          placeholder={placeholderMax}
                          value={budgetMaxInputs[sphere.id] || ''}
                          onChange={(e) => setBudgetMaxInputs({ ...budgetMaxInputs, [sphere.id]: e.target.value })}
                          className="w-full bg-slate-100/50 dark:bg-black/20 border border-border-custom/50 rounded-xl px-3 py-2 text-[12px] font-bold text-text-primary outline-none focus:border-primary/50 transition-all focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveBudgets}
                className="w-full rounded-xl bg-primary hover:bg-primary-hover text-white py-3 text-[13px] font-black uppercase tracking-wider transition-colors shadow-lg shadow-primary/20 active:scale-[0.98]"
              >
                Zapisz Budżety
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification popup */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4.5 py-3 text-[12px] font-bold shadow-2xl animate-fade-in">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
