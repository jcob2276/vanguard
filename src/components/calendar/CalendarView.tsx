/**
 * @component CalendarView
 * @role Top-level orchestrator widoku kalendarza.
 * @folders hooks/ = fetch+mutacje danych | calendarView/ = logika wydzielona z tego pliku pod limit 300 linii
 *          (actions/integrations/effects) | components/ = modale + header/sidebar | grid/ = warianty
 *          renderowania day/week/agenda (patrz CalendarGrid) | context/ = CalendarContext
 * @composes CalendarGrid (renderowanie siatki, patrz grid/)
 * @usedBy Dashboard, WeeklyBalanceHexagon
 */
import { useEffect, useMemo } from 'react';
import type { Session } from '@supabase/supabase-js';

import { useCalendarData } from './hooks/useCalendarData';
import { useTimeBudgets } from './hooks/useTimeBudgets';
import { useCalendarTodos } from './hooks/useCalendarTodos';
import { CalendarGrid } from './CalendarGrid';
import { CalendarEventModal } from './CalendarEventModal';

import { todayStr, addDays, weekMon } from './calendarHelpers';

import { CalendarContext, CalendarContextType } from './context/CalendarContext';
import CalendarSidebar from './components/CalendarSidebar';
import CalendarHeader from './components/CalendarHeader';
import CalendarTodoModal from './components/CalendarTodoModal';
import CalendarBudgetModal from './components/CalendarBudgetModal';

import { calculateWeeklyTotals } from './calendarView/calendarViewHelpers';
import { useCalendarActions } from './calendarView/hooks/useCalendarActions';
import { useCalendarIntegrations } from './calendarView/hooks/useCalendarIntegrations';
import { useCalendarEffects } from './calendarView/hooks/useCalendarEffects';
import WorkspaceNavigation from '../shared/WorkspaceNavigation';
import './calendar.css';

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
  const today = todayStr();

  const calTodos = useCalendarTodos({
    userId: userId || '',
    rangeStart: calData.visibleRange.rangeStart,
    rangeEnd: calData.visibleRange.rangeEnd,
  });

  const timeBudgets = useTimeBudgets(userId || '');

  const categoryWeeklyTotals = useMemo(() => {
    return calculateWeeklyTotals(calData.events, calData.weekStart, 0);
  }, [calData.events, calData.weekStart]);

  const categoryPrevWeeklyTotals = useMemo(() => {
    return calculateWeeklyTotals(calData.events, calData.weekStart, -7);
  }, [calData.events, calData.weekStart]);

  const actions = useCalendarActions({
    userId,
    accessToken,
    calData,
    calTodos,
    onResyncCalendar,
  });

  const integrations = useCalendarIntegrations({
    userId,
    accessToken,
    selectedDay: calData.selectedDay,
    createEventMutation: calData.createEventMutation,
    updateEventMutation: calData.updateEventMutation,
    fetchEvents: calData.fetchEvents,
    setToastMessage: calData.setToastMessage,
  });

  useCalendarEffects({
    quickCreate: calData.quickCreate,
    setQuickCreate: calData.setQuickCreate,
    editingTodo: calData.editingTodo,
    setEditingTodo: calData.setEditingTodo,
    selectedEvent: calData.selectedEvent,
    setSelectedEvent: calData.setSelectedEvent,
    showBudgetConfig: calData.showBudgetConfig,
    setShowBudgetConfig: calData.setShowBudgetConfig,
    setCalView: calData.setCalView,
    toastMessage: calData.toastMessage,
    setToastMessage: calData.setToastMessage,
  });

  // Global keyboard navigation listener for left/right arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip navigation if typing in an input element or editable area
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (calData.calView === 'dzien') {
          const prev = addDays(calData.selectedDay, -1);
          calData.setSelectedDay(prev);
          calData.setWeekStart(weekMon(prev));
        } else if (calData.calView === 'tydzien') {
          const prev = addDays(calData.weekStart, -7);
          calData.setSelectedDay(prev);
          calData.setWeekStart(prev);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (calData.calView === 'dzien') {
          const next = addDays(calData.selectedDay, 1);
          calData.setSelectedDay(next);
          calData.setWeekStart(weekMon(next));
        } else if (calData.calView === 'tydzien') {
          const next = addDays(calData.weekStart, 7);
          calData.setSelectedDay(next);
          calData.setWeekStart(next);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [calData.calView, calData.selectedDay, calData.weekStart, calData.setSelectedDay, calData.setWeekStart]);

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
    isSyncingOura: integrations.isSyncingOura,
    isSyncingActivities: integrations.isSyncingActivities,
    onSyncCalendar,
    syncOura: integrations.syncOura,
    syncActivities: integrations.syncActivities,
    handleQuickSave: actions.handleQuickSave,
    handleEditSave: actions.handleEditSave,
    closeEditTodoModal: actions.closeEditTodoModal,
    saveTodoTitle: actions.saveTodoTitle,
    deleteTodo: actions.handleDeleteTodo,
  };

  return (
    <CalendarContext.Provider value={contextValue}>
      <div className="calendar-shell flex h-screen bg-background overflow-hidden relative font-sans">
        <CalendarSidebar
          onBack={onBack}
          onNavigateTo={onNavigateTo}
          collapsed={calData.sidebarCollapsed}
          onToggleCollapse={calData.toggleSidebar}
        />

        <div className="flex-1 flex flex-col min-w-0 bg-surface/5">
          <CalendarHeader onBack={onBack} />

          <CalendarGrid
            calData={calData}
            userId={userId}
            onSyncCalendar={onSyncCalendar}
            isSyncing={isSyncing}
            handleToggleTodo={calTodos.handleToggleTodo}
            completedTodoIds={calTodos.completedTodoIds}
            todosForDay={calTodos.todosForDay}
            goalChipFor={calTodos.goalChipFor}
            scheduleTodoAt={calTodos.scheduleTodoAt}
          />
        </div>
        <CalendarEventModal
          calData={calData}
          handleQuickSave={actions.handleQuickSave}
          handleEditSave={actions.handleEditSave}
        />
        <CalendarTodoModal />
        <CalendarBudgetModal />
        <WorkspaceNavigation
          active="kalendarz"
          orientation="horizontal"
          onNavigate={onNavigateTo}
          className="fixed inset-x-0 bottom-0 z-[var(--z-overlay)] border-t border-border-custom bg-background/95 backdrop-blur-[var(--blur-xl)] md:hidden"
        />
        {calData.toastMessage && (
          <div className="fixed bottom-4 right-4 z-[var(--z-emergency)] bg-text-primary text-background text-xs font-black uppercase tracking-wider px-4 py-3 rounded-xl shadow-lg animate-in slide-in-from-bottom duration-[var(--motion-medium)]">
            {calData.toastMessage}
          </div>
        )}
      </div>
    </CalendarContext.Provider>
  );
}
