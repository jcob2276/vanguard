import { useCallback, useEffect, useRef, useState } from 'react';
import { getTodayWarsaw } from '../../../lib/date';
import { updateTodoItem } from '../../../lib/todo/todo';
import type { TodoItemRow, TodoSectionRow } from '../useTodoData';

interface UseTodoDragDropProps {
  sections: TodoSectionRow[];
  collapsedSections: Record<string, boolean>;
  setCollapsedSections: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setBusy: (busy: boolean) => void;
  setError: (err: string | null) => void;
  fetchAll: () => Promise<void>;
}

export function useTodoDragDrop({
  sections,
  collapsedSections,
  setCollapsedSections,
  setBusy,
  setError,
  fetchAll,
}: UseTodoDragDropProps) {
  const [draggingItem, setDraggingItem] = useState<TodoItemRow | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const dragPosRef = useRef({ x: 0, y: 0 });
  const dragItemRef = useRef<TodoItemRow | null>(null);

  const todayZoneRef = useRef<HTMLDivElement>(null);
  const inboxZoneRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-expand collapsed sections when dragging a card over them for 500ms
  useEffect(() => {
    if (draggingItem === null || !dragTarget) return;
    if (collapsedSections[dragTarget]) {
      const timer = setTimeout(() => {
        setCollapsedSections(prev => ({ ...prev, [dragTarget]: false }));
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [dragTarget, collapsedSections, draggingItem, setCollapsedSections]);

  const getSectionAtPoint = useCallback((x: number, y: number) => {
    if (todayZoneRef.current) {
      const r = todayZoneRef.current.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return 'today';
    }
    if (inboxZoneRef.current) {
      const r = inboxZoneRef.current.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return 'inbox';
    }
    for (const sec of sections) {
      const el = sectionRefs.current[sec.id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return sec.id;
    }
    return null;
  }, [sections]);

  useEffect(() => {
    if (!draggingItem) return;

    const onMove = (e: TouchEvent | MouseEvent) => {
      e.preventDefault();
      const t = ('touches' in e) ? e.touches?.[0] : e;
      if (!t) return;
      dragPosRef.current = { x: t.clientX, y: t.clientY };
      const b = getSectionAtPoint(t.clientX, t.clientY);
      setDragTarget((prev) => prev !== b ? b : prev);
    };

    const onEnd = (e: TouchEvent | MouseEvent) => {
      const t = ('changedTouches' in e) ? e.changedTouches?.[0] : e;
      if (!t) return;
      const target = getSectionAtPoint(t.clientX, t.clientY);
      const item = dragItemRef.current;
      if (target && item) {
        if (target === 'today') {
          const now = getTodayWarsaw();
          setBusy(true);
          updateTodoItem(item.id, { due_date: now, ai_bucket: 'today', ai_classified_at: new Date().toISOString() })
            .then(() => fetchAll())
            .catch((err) => setError(err.message))
            .finally(() => setBusy(false));
        } else if (target === 'inbox') {
          setBusy(true);
          updateTodoItem(item.id, { section_id: null })
            .then(() => fetchAll())
            .catch((err) => setError(err.message))
            .finally(() => setBusy(false));
        } else {
          setBusy(true);
          updateTodoItem(item.id, { section_id: target })
            .then(() => fetchAll())
            .catch((err) => setError(err.message))
            .finally(() => setBusy(false));
        }
      }
      dragItemRef.current = null;
      setDraggingItem(null);
      setDragTarget(null);
    };

    document.addEventListener('mousemove', onMove, { capture: true });
    document.addEventListener('touchmove', onMove, { passive: false, capture: true });
    document.addEventListener('mouseup', onEnd, { capture: true });
    document.addEventListener('touchend', onEnd, { capture: true });
    
    return () => {
      document.removeEventListener('mousemove', onMove, { capture: true });
      document.removeEventListener('touchmove', onMove, { capture: true });
      document.removeEventListener('mouseup', onEnd, { capture: true });
      document.removeEventListener('touchend', onEnd, { capture: true });
    };
  }, [draggingItem, getSectionAtPoint, fetchAll, setError, setBusy]);

  const handleDragStart = useCallback((item: TodoItemRow, x: number, y: number) => {
    dragItemRef.current = item;
    dragPosRef.current = { x, y };
    setDraggingItem(item);
  }, []);

  return {
    draggingItem,
    setDraggingItem,
    dragTarget,
    setDragTarget,
    dragPosRef,
    dragItemRef,
    todayZoneRef,
    inboxZoneRef,
    sectionRefs,
    handleDragStart,
  };
}
