import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTodayWarsaw } from '../../lib/date';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import {
  archiveTodoSection,
  createTodoItem,
  createTodoSection,
  listTodoItems,
  listTodoSections,
  renameTodoSection,
  setTodoStatus,
  updateTodoItem,
} from '../../lib/todo';
import { listProjects } from '../../lib/projects';
import { parseTodoQuickInput } from '../../lib/todoParser';
import { supabase } from '../../lib/supabase';
import { NETWORK_TIMEOUT_MS } from '../../lib/constants';
import { usePersistentDraft } from '../../hooks/usePersistentDraft';
import {
  nextOccurrenceDate,
  parseSubtasks,
  serializeSubtasks,
  PRIORITY_ORDER,
} from './todoUtils';
import type { Database } from '../../lib/database.types';

export type TodoItemRow = Database['public']['Tables']['todo_items']['Row'];
export type TodoSectionRow = Database['public']['Tables']['todo_sections']['Row'];
export type ProjectRow = Database['public']['Tables']['projects']['Row'];
export type DreamRow = Database['public']['Tables']['dreams']['Row'];

export interface UseTodoDataProps {
  session: any;
  onNavigateTo?: (dest: string) => void;
}

export function useTodoData({ session, onNavigateTo }: UseTodoDataProps) {
  const userId = session?.user?.id;
  const push = usePushNotifications(userId);
  const [pushSubscribed, setPushSubscribed] = useState<boolean | null>(null);
  const [sections, setSections] = useState<TodoSectionRow[]>([]);
  const [items, setItems] = useState<TodoItemRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [dreams, setDreams] = useState<Pick<DreamRow, 'id' | 'title' | 'life_goal'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [linkedPlanIds, setLinkedPlanIds] = useState<Set<string>>(new Set());

  // Filters
  const [activeFilterTag] = useState<string | null>(null);
  const [activeFilterSection, setActiveFilterSection] = useState<string | null>(null);

  const toggleExpand = useCallback((id: string) => setExpandedId(prev => prev === id ? null : id), []);

  const goTo = (dest: 'todo' | 'keep' | 'links' | 'kalendarz') => {
    if (onNavigateTo) onNavigateTo(dest);
  };

  // Persisted quick-add draft
  const [form, setForm] = usePersistentDraft(
    userId ? `vanguard_todo_quickadd_draft_${userId}` : null,
    { title: '', notes: '', priority: 'normal', tagsText: '', due_date: '', recurrence: '', section_id: '' },
  );

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: TodoItemRow } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [batchClassifying, setBatchClassifying] = useState(false);
  const quickCaptureRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [draggingItem, setDraggingItem] = useState<TodoItemRow | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const dragPosRef = useRef({ x: 0, y: 0 });
  const dragItemRef = useRef<TodoItemRow | null>(null);

  const todayZoneRef = useRef<HTMLDivElement>(null);
  const inboxZoneRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const toggleSectionCollapse = (id: string) => { setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] })); };

  // Auto-expand collapsed sections when dragging a card over them for 500ms
  useEffect(() => {
    if (draggingItem === null || !dragTarget) return;
    if (collapsedSections[dragTarget]) {
      const timer = setTimeout(() => {
        setCollapsedSections(prev => ({ ...prev, [dragTarget]: false }));
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [dragTarget, collapsedSections, draggingItem]);

  const today = getTodayWarsaw();

  const fetchAll = useCallback(async () => {
    const todayDate = getTodayWarsaw();
    try {
      const [s, i, { data: winData }, p, { data: d }] = await Promise.all([
        listTodoSections(userId),
        listTodoItems(userId),
        supabase.from('daily_wins').select('task_1_todo_id,task_2_todo_id,task_3_todo_id,task_4_todo_id,task_5_todo_id').eq('user_id', userId).eq('date', todayDate).maybeSingle(),
        listProjects(userId),
        supabase.from('dreams').select('id, title, life_goal').eq('user_id', userId),
      ]);
      setSections(s || []);
      setItems(i || []);
      setProjects(p || []);
      setDreams((d as any) || []);
      if (winData) {
        const winDataAny = winData as any;
        setLinkedPlanIds(new Set([1,2,3,4,5].map((n) => winDataAny[`task_${n}_todo_id`]).filter(Boolean)));
      }
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  }, [userId]);

  useEffect(() => {
    (async () => { setLoading(true); await fetchAll(); setLoading(false); })();
  }, [fetchAll]);

  useEffect(() => {
    push.isSubscribed().then(setPushSubscribed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formTitleRef = useRef('');
  useEffect(() => { formTitleRef.current = form.title; }, [form.title]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (quickCaptureRef.current && !quickCaptureRef.current.contains(e.target as Node)) {
        if (formTitleRef.current.trim() === '') {
          setIsExpanded(false);
        }
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.getAttribute('contenteditable') === 'true')
      ) {
        if (e.key === 'Escape') {
          target.blur();
          setExpandedId(null);
          setContextMenu(null);
        }
        return;
      }

      if (e.key === 'n' || e.key === 'N' || e.key === '/') {
        e.preventDefault();
        const inputEl = document.querySelector('input[placeholder="Nowe zadanie..."]') as HTMLInputElement;
        if (inputEl) {
          inputEl.focus();
        }
      } else if (e.key === 'Escape') {
        setExpandedId(null);
        setContextMenu(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Drag tracking ──
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
    const onMove = (e: any) => {
      e.preventDefault();
      const t = e.touches?.[0] ?? e;
      dragPosRef.current = { x: t.clientX, y: t.clientY };
      const b = getSectionAtPoint(t.clientX, t.clientY);
      setDragTarget((prev) => prev !== b ? b : prev);
    };
    const onEnd = (e: any) => {
      const t = e.changedTouches?.[0] ?? e;
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
  }, [draggingItem, getSectionAtPoint, fetchAll]);

  // ── Derived ──
  const sectionById = useMemo(() => Object.fromEntries(sections.map((s) => [s.id, s])), [sections]);

  const sectionGoalMap = useMemo(() => {
    const result: Record<string, string> = {};
    for (const sec of sections) {
      if (!sec.project_id) continue;
      const proj = projects.find(p => p.id === sec.project_id);
      if (!proj || !proj.dream_id) continue;
      const dream = dreams.find(d => d.id === proj.dream_id);
      const goal = dream?.life_goal;
      if (goal) result[sec.id] = goal;
    }
    return result;
  }, [sections, projects, dreams]);

  const sectionDreamMap = useMemo(() => {
    const result: Record<string, string> = {};
    for (const sec of sections) {
      if (!sec.project_id) continue;
      const proj = projects.find(p => p.id === sec.project_id);
      if (!proj || !proj.dream_id) continue;
      const dream = dreams.find(d => d.id === proj.dream_id);
      if (dream?.title) result[sec.id] = dream.title;
    }
    return result;
  }, [sections, projects, dreams]);

  const parsedInput = useMemo(() => parseTodoQuickInput(form.title), [form.title]);
  const openItems = useMemo(() => items.filter((i) => i.status === 'open'), [items]);
  const doneItems = useMemo(() => items.filter((i) => i.status === 'done'), [items]);

  const applyFilter = useCallback((arr: TodoItemRow[]) => arr.filter(i => {
    if (activeFilterTag && !(i.tags || []).includes(activeFilterTag)) return false;
    if (activeFilterSection && i.section_id !== activeFilterSection) return false;
    return true;
  }), [activeFilterTag, activeFilterSection]);

  const { todayItems, inboxItems, sectionsWithItems } = useMemo(() => {
    const todayList = openItems
      .filter((i) => (i.due_date && i.due_date <= today) || i.ai_bucket === 'today')
      .sort((a, b) => {
        const pA = PRIORITY_ORDER.indexOf(a.priority || 'normal');
        const pB = PRIORITY_ORDER.indexOf(b.priority || 'normal');
        if (pA !== pB) return pB - pA;
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
      });
    const todaySet = new Set(todayList.map((i) => i.id));
    const remainingItems = openItems.filter((i) => !todaySet.has(i.id));
    const inbox = applyFilter(remainingItems.filter((i) => i.section_id === null));
    const sectionsMap: Record<string, TodoItemRow[]> = {};
    sections.forEach(s => { sectionsMap[s.id] = []; });
    remainingItems.forEach((i) => {
      if (i.section_id && sectionsMap[i.section_id] !== undefined) {
        sectionsMap[i.section_id].push(i);
      }
    });
    const sectionsList = sections.map(s => ({
      ...s,
      items: applyFilter(sectionsMap[s.id] || [])
    }));
    return {
      todayItems: applyFilter(todayList),
      inboxItems: inbox,
      sectionsWithItems: sectionsList
    };
  }, [openItems, sections, today, applyFilter]);

  // ── Actions ──
  const run = async (fn: () => Promise<any> | any) => {
    setBusy(true);
    try { await fn(); await fetchAll(); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };

  const classifyInBackground = useCallback((item: TodoItemRow) => {
    const base = import.meta.env.VITE_SUPABASE_URL;
    fetch(`${base}/functions/v1/vanguard-todo-classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ itemId: item.id, userId, title: item.title, notes: item.notes || undefined, due_date: item.due_date || undefined, priority: item.priority !== 'normal' ? item.priority : undefined }),
      signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
    }).then(() => setTimeout(fetchAll, 200)).catch(() => {});
  }, [userId, session.access_token, fetchAll]);

  const batchClassify = useCallback(async () => {
    const unclassified = items.filter((i) => i.status === 'open' && !i.ai_bucket && !i.due_date);
    if (!unclassified.length || batchClassifying) return;
    setBatchClassifying(true);
    const base = import.meta.env.VITE_SUPABASE_URL;
    await Promise.allSettled(unclassified.map((item) =>
      fetch(`${base}/functions/v1/vanguard-todo-classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ itemId: item.id, userId, title: item.title, notes: item.notes || undefined, priority: item.priority !== 'normal' ? item.priority : undefined }),
        signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
      })
    ));
    await fetchAll();
    setBatchClassifying(false);
  }, [items, batchClassifying, userId, session.access_token, fetchAll]);

  const addItem = () => {
    const title = parsedInput.title || form.title.trim();
    if (!title) return;

    // Capture before reset
    const priority = parsedInput.priority || form.priority;
    const due_date = parsedInput.due_date || form.due_date || null;
    const duration_minutes = parsedInput.duration_minutes ?? null;
    const section_id = form.section_id || activeFilterSection || null;
    const notes = form.notes || null;
    const tagsText = form.tagsText;
    const recurrence = form.recurrence || null;
    const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean);

    // Optimistic: add instantly
    const tempId = `__temp_${Date.now()}`;
    const optimistic: TodoItemRow = {
      id: tempId, user_id: userId, title, notes, priority, due_date,
      section_id, recurrence, tags, status: 'open',
      ai_bucket: null, ai_classified_at: null, sort_order: 0,
      created_at: new Date().toISOString(), completed_at: null,
      updated_at: new Date().toISOString(), is_milestone: false,
      project_id: null, reminder_at: null, reminder_sent: false,
      scheduled_time: null, duration_minutes, is_important: false,
    };
    setItems((prev) => [optimistic, ...prev]);
    setForm({ title: '', notes: '', priority: 'normal', tagsText: '', due_date: '', recurrence: '', section_id: '' });
    setIsExpanded(false);

    createTodoItem(userId, { title, notes: notes || undefined, priority, due_date: due_date || undefined, duration_minutes: duration_minutes || undefined, section_id: section_id || undefined, recurrence: recurrence || undefined, tagsText })
      .then((newItem) => {
        setItems((prev) => prev.map((i) => i.id === tempId ? newItem : i));
        if (!due_date && priority === 'normal') classifyInBackground(newItem);
      })
      .catch((err) => {
        setItems((prev) => prev.filter((i) => i.id !== tempId));
        setError(err.message);
      });
  };

  const toggleSubtask = (item: TodoItemRow, idx: number) => {
    const { description, subtasks } = parseSubtasks(item.notes);
    run(() => updateTodoItem(item.id, { notes: serializeSubtasks(description, subtasks.map((st: any, i: number) => i === idx ? { ...st, checked: !st.checked } : st)) }));
  };
  const addSubtask = (item: TodoItemRow, text: string) => {
    if (!text.trim()) return;
    const { description, subtasks } = parseSubtasks(item.notes);
    run(() => updateTodoItem(item.id, { notes: serializeSubtasks(description, [...subtasks, { checked: false, text: text.trim() }]) }));
  };
  const deleteSubtask = (item: TodoItemRow, idx: number) => {
    const { description, subtasks } = parseSubtasks(item.notes);
    run(() => updateTodoItem(item.id, { notes: serializeSubtasks(description, subtasks.filter((_, i) => i !== idx)) }));
  };
  const saveEditTitle = (item: TodoItemRow) => {
    const title = editingTitle.trim();
    if (title && title !== item.title) run(() => updateTodoItem(item.id, { title }));
    setEditingId(null); setEditingTitle('');
  };

  const handleDragStart = useCallback((item: TodoItemRow, x: number, y: number) => {
    dragItemRef.current = item;
    dragPosRef.current = { x, y };
    setDraggingItem(item);
  }, []);

  const showContextMenu = useCallback((item: TodoItemRow, x: number, y: number) => {
    setContextMenu({ x, y, item });
    setExpandedId(null);
  }, []);

  const handleComplete = useCallback((item: TodoItemRow) => {
    const newStatus = item.status === 'done' ? 'open' : 'done';
    const now = new Date().toISOString();
    setItems(prev => prev.map(i => i.id === item.id
      ? { ...i, status: newStatus, completed_at: newStatus === 'done' ? now : null }
      : i
    ));
    setTodoStatus(item, newStatus)
      .then(async () => {
        if (newStatus === 'done' && item.recurrence) {
          const nextDate = nextOccurrenceDate(item.due_date, item.recurrence, today);
          const newItem = await createTodoItem(userId, {
            title: item.title, notes: item.notes ?? undefined, priority: item.priority || 'normal',
            tagsText: (item.tags || []).join(', '), section_id: item.section_id ?? undefined,
            due_date: nextDate || undefined, recurrence: item.recurrence ?? undefined,
          });
          setItems(prev => [...prev, newItem]);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setItems(prev => prev.map(i => i.id === item.id
          ? { ...i, status: item.status, completed_at: item.completed_at }
          : i
        ));
      });
  }, [today, userId]);

  return {
    userId,
    push,
    pushSubscribed, setPushSubscribed,
    sections, setSections,
    items, setItems,
    projects,
    dreams,
    loading,
    busy,
    error, setError,
    showDone, setShowDone,
    expandedId, setExpandedId,
    editingId, setEditingId,
    editingTitle, setEditingTitle,
    linkedPlanIds,
    activeFilterTag,
    activeFilterSection, setActiveFilterSection,
    collapsedSections, setCollapsedSections,
    toggleExpand,
    goTo,
    form, setForm,
    contextMenu, setContextMenu,
    isExpanded, setIsExpanded,
    batchClassifying,
    quickCaptureRef,
    draggingItem, setDraggingItem,
    dragTarget, setDragTarget,
    dragPosRef,
    todayZoneRef,
    inboxZoneRef,
    sectionRefs,
    toggleSectionCollapse,
    today,
    fetchAll,
    getSectionAtPoint,
    sectionById,
    sectionGoalMap,
    sectionDreamMap,
    parsedInput,
    openItems,
    doneItems,
    todayItems,
    inboxItems,
    sectionsWithItems,
    applyFilter,
    run,
    classifyInBackground,
    batchClassify,
    addItem,
    toggleSubtask,
    addSubtask,
    deleteSubtask,
    saveEditTitle,
    handleDragStart,
    showContextMenu,
    handleComplete
  };
}
