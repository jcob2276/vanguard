import { useCallback, useRef } from 'react';
import type { TodoViewMode } from '../TodoHeader';

const VIEW_ORDER: TodoViewMode[] = ['lista', 'eisenhower', 'kanban'];

export function useTodoViewSwipe(
  currentView: TodoViewMode,
  setCurrentView: (view: TodoViewMode) => void,
) {
  const start = useRef<{ x: number; y: number; blocked: boolean } | null>(null);

  const onTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;
    const target = event.target as HTMLElement;
    start.current = {
      x: touch.clientX,
      y: touch.clientY,
      blocked: Boolean(target.closest('input, textarea, select, button, [data-no-view-swipe]')),
    };
  }, []);

  const onTouchEnd = useCallback((event: React.TouchEvent) => {
    const gesture = start.current;
    start.current = null;
    const touch = event.changedTouches[0];
    if (!gesture || gesture.blocked || !touch) return;

    const deltaX = touch.clientX - gesture.x;
    const deltaY = touch.clientY - gesture.y;
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return;

    const currentIndex = VIEW_ORDER.indexOf(currentView);
    const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
    const nextView = VIEW_ORDER[nextIndex];
    if (nextView) setCurrentView(nextView);
  }, [currentView, setCurrentView]);

  return { onTouchStart, onTouchEnd };
}
