import { useState, useRef, useCallback } from 'react';
import type { TodoItemRow } from '../../lib/todo/todo';

type SwipeableItem = TodoItemRow;

interface UseTodoCardSwipeOptions {
  isDone: boolean;
  onToggle: () => void;
  item: SwipeableItem;
  onDragStart?: (item: SwipeableItem, clientX: number, clientY: number) => void;
  expanded: boolean;
  isEditing: boolean;
  onEditStart: (title: string) => void;
  onToggleExpand: (id: string) => void;
}

export function useTodoCardSwipe({
  isDone,
  onToggle,
  item,
  onDragStart,
  expanded,
  isEditing,
  onEditStart,
  onToggleExpand,
}: UseTodoCardSwipeOptions) {
  const gripLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completingOut, setCompletingOut] = useState(false);

  const handleComplete = useCallback(() => {
    if (isDone) {
      onToggle();
      return;
    }
    setCompleting(true);
    setTimeout(() => setCompletingOut(true), 130);
    setTimeout(() => {
      onToggle();
      setCompleting(false);
      setCompletingOut(false);
    }, 420);
  }, [isDone, onToggle]);

  // Grip: long press (mobile) / mousedown (desktop)
  const onGripTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    const t = e.touches[0];
    gripLongPressTimer.current = setTimeout(() => {
      onDragStart?.(item, t.clientX, t.clientY);
    }, 350);
  }, [onDragStart, item]);

  const onGripTouchEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    if (gripLongPressTimer.current) clearTimeout(gripLongPressTimer.current);
  }, []);

  const onGripTouchMove = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    if (gripLongPressTimer.current) clearTimeout(gripLongPressTimer.current);
  }, []);

  const onGripMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onDragStart?.(item, e.clientX, e.clientY);
  }, [onDragStart, item]);

  const handleContentMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (isEditing) return;

    const startX = e.clientX;
    const startY = e.clientY;
    let dragStarted = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 5) {
        dragStarted = true;
        cleanup();
        onDragStart?.(item, moveEvent.clientX, moveEvent.clientY);
      }
    };

    const onMouseUp = (_upEvent: MouseEvent) => {
      cleanup();
      if (!dragStarted) {
        if (expanded) {
          if (!isEditing) onEditStart(item.title);
        } else {
          onToggleExpand(item.id);
        }
      }
    };

    const cleanup = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [isEditing, expanded, onDragStart, item, onEditStart, onToggleExpand]);

  return {
    completing, completingOut,
    onGripTouchStart, onGripTouchEnd, onGripTouchMove, onGripMouseDown,
    handleContentMouseDown, handleComplete,
  };
}
