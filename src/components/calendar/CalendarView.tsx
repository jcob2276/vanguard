import { useMemo } from 'react';
import type { Session } from '@supabase/supabase-js';

import { useCalendarData } from './hooks/useCalendarData';
import { useTimeBudgets } from './hooks/useTimeBudgets';
import { useCalendarTodos } from './hooks/useCalendarTodos';
import { CalendarGrid } from './CalendarGrid';
import { CalendarEventModal } from './CalendarEventModal';

import { todayStr } from './calendarHelpers';

import { CalendarContext, CalendarContextType } from './context/CalendarContext';
import CalendarSidebar from './components/CalendarSidebar';
import CalendarHeader from './components/CalendarHeader';
import CalendarTodoModal from './components/CalendarTodoModal';
import CalendarBudgetModal from './components/CalendarBudgetModal';

import { calculateWeeklyTotals } from './calendarView/calendarViewHelpers';
import { useCalendarActions } from './calendarView/hooks/useCalendarActions';
import { useCalendarIntegrations } from './calendarView/hooks/useCalendarIntegrations';
import { useCalendarEffects } from './calendarView/hooks/useCalendarEffects';

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
      <div className="flex h-screen bg-background overflow-hidden relative font-sans">
        {!calData.sidebarCollapsed && (
          <CalendarSidebar onBack={onBack} onNavigateTo={onNavigateTo} />
        )}

        <button
          onClick={calData.toggleSidebar}
          className="absolute top-1/2 -translate-y-1/2 left-0 z-50 h-20 w-3 rounded-r-lg border border-l-0 border-border-custom/50 bg-surface/80 hover:bg-surface flex items-center justify-center text-text-muted hover:text-text-primary transition-all shadow-md focus:outline-none cursor-pointer"
          style={{ left: calData.sidebarCollapsed ? 0 : 280 }}
        >
          <span className="text-2xs font-black">{calData.sidebarCollapsed ? '›' : '‹'}</span>
        </button>

        <div className="flex-1 flex flex-col min-w-0 bg-surface/5">
          <CalendarHeader />

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
        {calData.toastMessage && (
          <div className="fixed bottom-4 right-4 z-[9999] bg-text-primary text-background text-xs font-black uppercase tracking-wider px-4 py-3 rounded-xl shadow-lg animate-in slide-in-from-bottom duration-200">
            {calData.toastMessage}
          </div>
        )}
      </div>
    </CalendarContext.Provider>
  );
}
