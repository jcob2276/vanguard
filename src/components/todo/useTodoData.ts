import { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTodayWarsaw, combineDateTimeWarsawISO, warsawTimeOfDay } from '../../lib/date';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import {
  archiveTodoSection,
  createSmartList,
  createTodoItem,
  createTodoSection,
  deleteSmartList,
  listSmartLists,
  listTodoItems,
  listTodoSections,
  renameTodoSection,
  setTodoStatus,
  updateTodoItem,
} from '../../lib/todo';
import { listProjects } from '../../lib/projects';
import { buildSectionGoalMaps } from '../../lib/goalLineage';
import { parseTodoQuickInput } from '../../lib/todoParser';
import { supabase } from '../../lib/supabase';
import { NETWORK_TIMEOUT_MS } from '../../lib/constants';
import { usePersistentDraft } from '../../hooks/usePersistentDraft';
import {
  nextOccurrenceDate,
  matchesSmartQuery,
  PRIORITY_ORDER,
} from './todoUtils';
import type { Database } from '../../lib/database.types';

export type TodoItemRow = Database['public']['Tables']['todo_items']['Row'];
export type TodoSectionRow = Database['public']['Tables']['todo_sections']['Row'];
export type ProjectRow = Database['public']['Tables']['projects']['Row'];
export type DreamRow = Database['public']['Tables']['dreams']['Row'];
export type SmartListRow = Database['public']['Tables']['todo_smart_lists']['Row'];

export interface UseTodoDataProps {
  session: Session;
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
  const [smartLists, setSmartLists] = useState<SmartListRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSmartListId, setActiveSmartListId] = useState<string | null>(null);
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
    { title: '', notes: '', priority: 'normal', tagsText: '', due_date: '', recurrence: '', section_id: '', scheduled_time: '', reminder_at: '' },
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
      const [s, i, { data: winData }, p, { data: d }, sl] = await Promise.all([
        listTodoSections(userId),
        listTodoItems(userId),
        supabase.from('daily_wins').select('id, daily_win_tasks(todo_id)').eq('user_id', userId).eq('date', todayDate).maybeSingle(),
        listProjects(userId),
        supabase.from('dreams').select('id, title, life_goal').eq('user_id', userId),
        listSmartLists(userId),
      ]);
      setSections(s || []);
      setItems(i || []);
      setProjects(p || []);
      setDreams((d as any) || []);
      setSmartLists(sl || []);
      if (winData) {
        const winTasks = (winData as any).daily_win_tasks || [];
        setLinkedPlanIds(new Set(winTasks.map((t: any) => t.todo_id).filter(Boolean)));
      }
    } catch (err: unknown) { setError(err instanceof Error ? (err as Error).message : String(err)); }
  }, [userId]);

  useEffect(() => {
    (async () => { setLoading(true); await fetchAll(); setLoading(false); })();
  }, [fetchAll]);

  // Live refresh when a task lands via Telegram/capture while the app is open —
  // todo_items is already in the supabase_realtime publication (see
  // 20260706000001_realtime_publication.sql), this was just missing a subscriber.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`todo_items_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'todo_items', filter: `user_id=eq.${userId}` },
        () => { fetchAll(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchAll]);

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
    const onMove = (e: TouchEvent | MouseEvent | any) => {
      e.preventDefault();
      const t = e.touches?.[0] ?? e;
      dragPosRef.current = { x: t.clientX, y: t.clientY };
      const b = getSectionAtPoint(t.clientX, t.clientY);
      setDragTarget((prev) => prev !== b ? b : prev);
    };
    const onEnd = (e: TouchEvent | MouseEvent | any) => {
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

  const { sectionGoalMap, sectionDreamMap } = useMemo(
    () => buildSectionGoalMaps(sections, projects as any, dreams as any),
    [sections, projects, dreams],
  );

  const parsedInput = useMemo(() => parseTodoQuickInput(form.title), [form.title]);
  // Nested subtasks (parent_task_id) are rendered under their parent card, not as top-level list rows.
  const openItems = useMemo(() => items.filter((i) => i.status === 'open' && !i.parent_task_id), [items]);
  const doneItems = useMemo(() => items.filter((i) => i.status === 'done' && !i.parent_task_id), [items]);
  const childrenByParentId = useMemo(() => {
    const map: Record<string, TodoItemRow[]> = {};
    for (const i of items) {
      if (!i.parent_task_id) continue;
      (map[i.parent_task_id] = map[i.parent_task_id] || []).push(i);
    }
    return map;
  }, [items]);
  const getChildren = useCallback((itemId: string) => childrenByParentId[itemId] || [], [childrenByParentId]);

  const sectionNameById = useMemo(() => Object.fromEntries(sections.map((s) => [s.id, s.name])), [sections]);
  const activeSmartQuery = useMemo(() => {
    if (searchQuery.trim()) return searchQuery.trim();
    if (activeSmartListId) return smartLists.find(sl => sl.id === activeSmartListId)?.query || '';
    return '';
  }, [searchQuery, activeSmartListId, smartLists]);

  const applyFilter = useCallback((arr: TodoItemRow[]) => arr.filter(i => {
    if (activeFilterTag && !(i.tags || []).includes(activeFilterTag)) return false;
    if (activeFilterSection && i.section_id !== activeFilterSection) return false;
    if (activeSmartQuery && !matchesSmartQuery(activeSmartQuery, i, today, sectionNameById)) return false;
    return true;
  }), [activeFilterTag, activeFilterSection, activeSmartQuery, today, sectionNameById]);

  const { todayItems, inboxItems, upcomingItems, sectionsWithItems } = useMemo(() => {
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

    const upcomingCutoff = new Date(`${today}T12:00:00Z`);
    upcomingCutoff.setUTCDate(upcomingCutoff.getUTCDate() + 7);
    const upcomingCutoffStr = upcomingCutoff.toISOString().slice(0, 10);
    const upcoming = applyFilter(
      remainingItems
        .filter((i) => i.due_date && i.due_date > today && i.due_date <= upcomingCutoffStr)
        .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')),
    );

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
      upcomingItems: upcoming,
      sectionsWithItems: sectionsList
    };
  }, [openItems, sections, today, applyFilter]);

  // ── Actions ──
  const run = async (fn: () => Promise<any> | any) => {
    setBusy(true);
    try { await fn(); await fetchAll(); }
    catch (err: unknown) { setError(err instanceof Error ? (err as Error).message : String(err)); }
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
    const recurrence = parsedInput.recurrence || form.recurrence || null;
    // scheduled_time is a timestamptz column — combine the HH:MM the UI collects with due_date
    // before persisting; a bare "14:30" fails Postgres's cast (and silently drops with no date).
    const scheduledTimeHHMM = parsedInput.scheduled_time || form.scheduled_time || null;
    const scheduled_time = scheduledTimeHHMM && due_date ? combineDateTimeWarsawISO(due_date, scheduledTimeHHMM) : null;
    const reminder_at = form.reminder_at || (scheduled_time ? scheduled_time : null);
    const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean);

    // Optimistic: add instantly
    const tempId = `__temp_${Date.now()}`;
    const optimistic: TodoItemRow = {
      id: tempId, user_id: userId, title, notes, priority, due_date,
      section_id, recurrence, tags, status: 'open', parent_task_id: null,
      ai_bucket: null, ai_classified_at: null, sort_order: 0,
      created_at: new Date().toISOString(), completed_at: null,
      updated_at: new Date().toISOString(), is_milestone: false,
      project_id: null, reminder_at, reminder_sent: false,
      scheduled_time, duration_minutes, is_important: false,
      category: null,
    };
    setItems((prev) => [optimistic, ...prev]);
    setForm({ title: '', notes: '', priority: 'normal', tagsText: '', due_date: '', recurrence: '', section_id: '', scheduled_time: '', reminder_at: '' });
    setIsExpanded(false);

    createTodoItem(userId, { title, notes: notes || undefined, priority, due_date: due_date || undefined, duration_minutes: duration_minutes || undefined, section_id: section_id || undefined, recurrence: recurrence || undefined, tagsText, scheduled_time: scheduled_time || undefined, reminder_at: reminder_at || undefined })
      .then((newItem) => {
        setItems((prev) => prev.map((i) => i.id === tempId ? newItem : i));
        if (!due_date && priority === 'normal') classifyInBackground(newItem);
      })
      .catch((err) => {
        setItems((prev) => prev.filter((i) => i.id !== tempId));
        setError(err.message);
      });
  };

  // Nested subtask — a full todo_item with its own priority/due date/reminders.
  const addChildTask = (parent: TodoItemRow, title: string) => {
    if (!title.trim()) return;
    run(() => createTodoItem(userId, {
      title: title.trim(),
      section_id: parent.section_id || undefined,
      parent_task_id: parent.id,
    }));
  };

  const saveCurrentAsSmartList = (name: string) => {
    if (!activeSmartQuery.trim() || !name.trim()) return;
    run(async () => {
      const created = await createSmartList(userId, name, activeSmartQuery);
      setSmartLists((prev) => [...prev, created]);
    });
  };

  const removeSmartList = (id: string) => {
    if (activeSmartListId === id) setActiveSmartListId(null);
    setSmartLists((prev) => prev.filter((sl) => sl.id !== id));
    deleteSmartList(id).catch((err) => setError(err instanceof Error ? err.message : String(err)));
  };
  const saveEditTitle = (item: TodoItemRow) => {
    const rawTitle = editingTitle.trim();
    if (!rawTitle) {
      setEditingId(null);
      setEditingTitle('');
      return;
    }
    
    const parsed = parseTodoQuickInput(rawTitle);
    const title = parsed.title || rawTitle;
    
    const patch: any = { title };
    
    if (parsed.priority) patch.priority = parsed.priority;
    if (parsed.due_date) patch.due_date = parsed.due_date;
    if (parsed.recurrence) patch.recurrence = parsed.recurrence;
    if (parsed.duration_minutes !== null) patch.duration_minutes = parsed.duration_minutes;
    
    if (parsed.scheduled_time) {
      const activeDueDate = parsed.due_date || item.due_date || today;
      patch.scheduled_time = combineDateTimeWarsawISO(activeDueDate, parsed.scheduled_time);
      patch.reminder_at = patch.scheduled_time;
      patch.reminder_sent = false;
    }
    
    const hasChanges = Object.keys(patch).some(key => patch[key] !== (item as any)[key]);
    if (hasChanges) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...patch } : i));
      run(() => updateTodoItem(item.id, patch));
    }
    
    setEditingId(null);
    setEditingTitle('');
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
        if (newStatus === 'done' && item.recurrence && userId) {
          const nextDate = nextOccurrenceDate(item.due_date, item.recurrence, today);
          let nextScheduledTime: string | undefined = undefined;
          let nextReminderAt: string | undefined = undefined;
          
          if (item.scheduled_time && nextDate) {
            const timeStr = warsawTimeOfDay(item.scheduled_time);
            nextScheduledTime = combineDateTimeWarsawISO(nextDate, timeStr);
            if (item.reminder_at) {
              nextReminderAt = nextScheduledTime;
            }
          }

          const newItem = await createTodoItem(userId, {
            title: item.title, notes: item.notes ?? undefined, priority: item.priority || 'normal',
            tagsText: (item.tags || []).join(', '), section_id: item.section_id ?? undefined,
            due_date: nextDate || undefined, recurrence: item.recurrence ?? undefined,
            scheduled_time: nextScheduledTime, reminder_at: nextReminderAt,
          });
          setItems(prev => [...prev, newItem]);
        }
      })
      .catch((err) => {
        console.error('[handleComplete] setTodoStatus failed, rolling back:', err);
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
    upcomingItems,
    sectionsWithItems,
    applyFilter,
    run,
    classifyInBackground,
    batchClassify,
    addItem,
    saveEditTitle,
    handleDragStart,
    showContextMenu,
    handleComplete,
    getChildren,
    addChildTask,
    smartLists,
    searchQuery, setSearchQuery,
    activeSmartListId, setActiveSmartListId,
    saveCurrentAsSmartList,
    removeSmartList,
    activeSmartQuery,
  };
}
