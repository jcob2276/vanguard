import { useState, useRef, useCallback } from 'react';

interface UseTodoCardSwipeOptions {
  isDragging: boolean;
  isDone: boolean;
  onToggle: () => void;
  onDrop: () => void;
  onShowContextMenu: (item: any, clientX: number, clientY: number) => void;
  item: any;
  onDragStart?: (item: any, clientX: number, clientY: number) => void;
  expanded: boolean;
  isEditing: boolean;
  onEditStart: (title: string) => void;
  onToggleExpand: (id: string) => void;
}

export function useTodoCardSwipe({
  isDragging,
  isDone,
  onToggle,
  onDrop,
  onShowContextMenu,
  item,
  onDragStart,
  expanded,
  isEditing,
  onEditStart,
  onToggleExpand,
}: UseTodoCardSwipeOptions) {
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null);
  const longPressTimer = useRef<any>(null);
  const gripLongPressTimer = useRef<any>(null);
  const prevSwipeRef = useRef(0);
  const [completing, setCompleting] = useState(false);
  const [completingOut, setCompletingOut] = useState(false);

  const handleComplete = useCallback(() => {
    if (isDone) {
      onToggle();
      setSwipeOffset(0);
      setSwipeDir(null);
      return;
    }
    setCompleting(true);
    setTimeout(() => setCompletingOut(true), 130);
    setTimeout(() => {
      onToggle();
      setCompleting(false);
      setCompletingOut(false);
      setSwipeOffset(0);
      setSwipeDir(null);
    }, 420);
  }, [isDone, onToggle]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (isDragging) return;
    const t = e.targetTouches[0];
    setTouchStartX(t.clientX);
    setTouchStartY(t.clientY);
    longPressTimer.current = setTimeout(() => {
      onShowContextMenu(item, t.clientX, t.clientY);
    }, 600);
  }, [isDragging, onShowContextMenu, item]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    clearTimeout(longPressTimer.current);
    if (isDragging) return;
    const dx = e.targetTouches[0].clientX - touchStartX;
    const dy = Math.abs(e.targetTouches[0].clientY - touchStartY);
    if (dy > 12) return;
    const newOffset = Math.max(-130, Math.min(130, dx));
    prevSwipeRef.current = newOffset;
    setSwipeOffset(newOffset);
    setSwipeDir(dx > 40 ? 'right' : dx < -40 ? 'left' : null);
  }, [isDragging, touchStartX, touchStartY]);

  const onTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);
    prevSwipeRef.current = 0;
    if (!isDragging) {
      if (swipeOffset > 100) {
        setSwipeOffset(500);
        handleComplete();
        return;
      } else if (swipeOffset < -100) {
        setSwipeOffset(-500);
        setTimeout(() => {
          onDrop();
          setSwipeOffset(0);
          setSwipeDir(null);
        }, 150);
        return;
      }
    }
    setSwipeOffset(0);
    setSwipeDir(null);
  }, [isDragging, swipeOffset, handleComplete, onDrop]);

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
    clearTimeout(gripLongPressTimer.current);
  }, []);

  const onGripTouchMove = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    clearTimeout(gripLongPressTimer.current);
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

    const onMouseUp = (upEvent: MouseEvent) => {
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
    touchStartX, touchStartY, swipeOffset, swipeDir, completing, completingOut,
    onTouchStart, onTouchMove, onTouchEnd,
    onGripTouchStart, onGripTouchEnd, onGripTouchMove, onGripMouseDown,
    handleContentMouseDown, handleComplete,
  };
}
