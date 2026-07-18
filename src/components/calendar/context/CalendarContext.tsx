import { createContext, useContext } from 'react';
import type { useCalendarData } from '../hooks/useCalendarData';
import type { useCalendarTodos } from '../hooks/useCalendarTodos';
import type { useTimeBudgets } from '../hooks/useTimeBudgets';

export interface CalendarContextType {
  userId: string | undefined;
  accessToken: string | undefined;
  today: string;

  // useCalendarData
  calData: ReturnType<typeof useCalendarData>;

  // useCalendarTodos
  calTodos: ReturnType<typeof useCalendarTodos>;

  // useTimeBudgets
  timeBudgets: ReturnType<typeof useTimeBudgets>;

  // Weekly actual totals
  categoryWeeklyTotals: Record<string, number>;
  categoryPrevWeeklyTotals: Record<string, number>;

  // Sync / AI status
  isSyncing: boolean;
  isSyncingOura: boolean;
  isSyncingActivities: boolean;

  // Actions
  onSyncCalendar: () => void;
  syncOura: () => Promise<void>;
  syncActivities: () => Promise<void>;

  // Rich Interactive Todo modal state & handlers
  handleQuickSave: () => Promise<void>;
  handleEditSave: () => Promise<void>;
  closeEditTodoModal: () => void;
  saveTodoTitle: () => Promise<void>;
  saveTodoChanges: () => Promise<void>;
  deleteTodo: () => Promise<void>;
}

export const CalendarContext = createContext<CalendarContextType | null>(null);

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
}
