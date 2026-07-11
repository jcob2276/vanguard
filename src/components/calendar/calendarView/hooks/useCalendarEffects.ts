import { useEffect } from 'react';

interface UseCalendarEffectsOptions {
  quickCreate: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  setQuickCreate: (v: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  editingTodo: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  setEditingTodo: (v: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  selectedEvent: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  setSelectedEvent: (v: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  showBudgetConfig: boolean;
  setShowBudgetConfig: (v: boolean) => void;
  setCalView: (v: 'dzien' | 'tydzien' | 'agenda') => void;
  toastMessage: string | null;
  setToastMessage: (v: string | null) => void;
}

export function useCalendarEffects({
  quickCreate,
  setQuickCreate,
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
          setQuickCreate(null);
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
      } else if (
        e.key.toLowerCase() === 'a' &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
      ) {
        setCalView('agenda');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    quickCreate,
    editingTodo,
    selectedEvent,
    showBudgetConfig,
    setQuickCreate,
    setEditingTodo,
    setSelectedEvent,
    setShowBudgetConfig,
    setCalView,
  ]);
}
