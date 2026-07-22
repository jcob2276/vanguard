import { useEffect } from 'react';
import type { CalRow } from '../../calendarHelpers';
import type { CalendarTodo } from '../../hooks/useCalendarTodos';
import type { QuickCreateState } from '../../hooks/useCalendarData';

interface UseCalendarEffectsOptions {
  quickCreate: QuickCreateState | null;
  closeQuickCreate: () => void;
  editingTodo: CalendarTodo | null;
  setEditingTodo: (v: CalendarTodo | null) => void;
  selectedEvent: CalRow | null;
  setSelectedEvent: (v: CalRow | null) => void;
  showBudgetConfig: boolean;
  setShowBudgetConfig: (v: boolean) => void;
  setCalView: (v: 'dzien' | '3dni' | 'tydzien' | 'miesiac') => void;
  toastMessage: string | null;
  setToastMessage: (v: string | null) => void;
}

export function useCalendarEffects({
  quickCreate,
  closeQuickCreate,
  editingTodo,
  setEditingTodo,
  selectedEvent,
  setSelectedEvent,
  showBudgetConfig,
  setShowBudgetConfig,
  setCalView,
  toastMessage,
  setToastMessage,
}: UseCalendarEffectsOptions) {
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
          closeQuickCreate();
          setEditingTodo(null);
          setSelectedEvent(null);
          setShowBudgetConfig(false);
        }
      } else if (
        e.key.toLowerCase() === 't' &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
      ) {
        setCalView('dzien');
      } else if (
        e.key.toLowerCase() === 'w' &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
      ) {
        setCalView('tydzien');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    quickCreate,
    editingTodo,
    selectedEvent,
    showBudgetConfig,
    closeQuickCreate,
    setEditingTodo,
    setSelectedEvent,
    setShowBudgetConfig,
    setCalView,
  ]);
}
