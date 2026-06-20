import { getTodayWarsaw } from '../../lib/date';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  History,
  ListTodo,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  X,
  Zap,
  StickyNote,
  BookOpen,
} from 'lucide-react';

import DataStateNotice from '../core/DataStateNotice';
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

// Subcomponents and helpers
import {
  RECURRENCE_LABELS,
  RECURRENCE_CYCLE,
  nextOccurrenceDate,
  splitEmoji,
  relativeDate,
  parseSubtasks,
  serializeSubtasks,
  PRIORITY,
  PRIORITY_ORDER
} from './todoUtils';

import ContextMenu from './ContextMenu';
import DragGhost from './DragGhost';
import BucketHeader from './BucketHeader';
import TodoCard from './TodoCard';
import SectionTabs from './SectionTabs';

export default function Todo({ session, onBack, onNavigateTo }: { session: any; onBack: () => void; onNavigateTo?: (dest: string) => void }) {
  const userId = session?.user?.id;
  const [sections, setSections] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [dreams, setDreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [linkedPlanIds, setLinkedPlanIds] = useState<Set<string>>(new Set());

  // Filters
  const [activeFilterTag, setActiveFilterTag] = useState<string | null>(null);
  const [activeFilterSection, setActiveFilterSection] = useState<string | null>(null);

  // Options toggling
  const [showOptions, setShowOptions] = useState(false);

  const toggleExpand = useCallback((id: string) => setExpandedId(prev => prev === id ? null : id), []);

  const goTo = (dest: 'todo' | 'keep' | 'links') => {
    if (onNavigateTo) onNavigateTo(dest);
  };
  const [form, setForm] = useState({ title: '', notes: '', priority: 'normal', tagsText: '', due_date: '', recurrence: '', section_id: '' });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: any } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [batchClassifying, setBatchClassifying] = useState(false);
  const quickCaptureRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [draggingItem, setDraggingItem] = useState<any | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const dragPosRef = useRef({ x: 0, y: 0 });
  const dragItemRef = useRef<any | null>(null);
  
  const todayZoneRef = useRef<HTMLDivElement>(null);
  const inboxZoneRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const toggleSectionCollapse = (id: string) => { setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] })); };

  const today = getTodayWarsaw();
  const nextWeek = (() => {
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
  })();

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
      setDreams(d || []);
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
    const handleOutsideClick = (e: MouseEvent) => {
      if (quickCaptureRef.current && !quickCaptureRef.current.contains(e.target as Node)) {
        if (form.title.trim() === '') {
          setIsExpanded(false);
        }
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [form.title]);

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

  const allUniqueTags = useMemo(() => Array.from(new Set(openItems.flatMap(i => i.tags || []))).sort(), [openItems]);

  const applyFilter = useCallback((arr: any[]) => arr.filter(i => {
    if (activeFilterTag && !(i.tags || []).includes(activeFilterTag)) return false;
    if (activeFilterSection && i.section_id !== activeFilterSection) return false;
    return true;
  }), [activeFilterTag, activeFilterSection]);

  const { todayItems, inboxItems, sectionsWithItems } = useMemo(() => {
    const todayList = openItems
      .filter((i: any) => (i.due_date && i.due_date <= today) || i.ai_bucket === 'today')
      .sort((a: any, b: any) => {
        const pA = PRIORITY_ORDER.indexOf(a.priority);
        const pB = PRIORITY_ORDER.indexOf(b.priority);
        if (pA !== pB) return pB - pA;
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
      });
    const todaySet = new Set(todayList.map((i: any) => i.id));
    const remainingItems = openItems.filter((i: any) => !todaySet.has(i.id));
    const inbox = applyFilter(remainingItems.filter((i: any) => i.section_id === null));
    const sectionsMap: Record<string, any[]> = {};
    sections.forEach(s => { sectionsMap[s.id] = []; });
    remainingItems.forEach((i: any) => {
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

  // Optimistic mutation — updates local state immediately, reverts on error
  const mutate = (patch: (prev: any[]) => any[], apiFn: () => Promise<any>) => {
    setItems(patch);
    apiFn().catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
      fetchAll();
    });
  };

  const classifyInBackground = useCallback((item: any) => {
    const base = import.meta.env.VITE_SUPABASE_URL;
    fetch(`${base}/functions/v1/vanguard-todo-classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ itemId: item.id, userId, title: item.title, notes: item.notes || undefined, due_date: item.due_date || undefined, priority: item.priority !== 'normal' ? item.priority : undefined }),
    }).then(() => setTimeout(fetchAll, 200)).catch(() => {});
  }, [userId, session.access_token, fetchAll]);

  const batchClassify = useCallback(async () => {
    const unclassified = items.filter((i: any) => i.status === 'open' && !i.ai_bucket && !i.due_date);
    if (!unclassified.length || batchClassifying) return;
    setBatchClassifying(true);
    const base = import.meta.env.VITE_SUPABASE_URL;
    await Promise.allSettled(unclassified.map((item: any) =>
      fetch(`${base}/functions/v1/vanguard-todo-classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ itemId: item.id, userId, title: item.title, notes: item.notes || undefined, priority: item.priority !== 'normal' ? item.priority : undefined }),
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
    const section_id = form.section_id || activeFilterSection || null;
    const notes = form.notes || null;
    const tagsText = form.tagsText;
    const recurrence = form.recurrence || null;
    const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean);

    // Optimistic: add instantly
    const tempId = `__temp_${Date.now()}`;
    const optimistic: any = {
      id: tempId, user_id: userId, title, notes, priority, due_date,
      section_id, recurrence, tags, status: 'open',
      ai_bucket: null, ai_classified_at: null, sort_order: 0,
      created_at: new Date().toISOString(), completed_at: null,
    };
    setItems((prev) => [optimistic, ...prev]);
    setForm({ title: '', notes: '', priority: 'normal', tagsText: '', due_date: '', recurrence: '', section_id: '' });
    setIsExpanded(false);

    createTodoItem(userId, { title, notes: notes || undefined, priority, due_date: due_date || undefined, section_id: section_id || undefined, recurrence: recurrence || undefined, tagsText })
      .then((newItem) => {
        setItems((prev) => prev.map((i) => i.id === tempId ? newItem : i));
        if (!due_date && priority === 'normal') classifyInBackground(newItem);
      })
      .catch((err) => {
        setItems((prev) => prev.filter((i) => i.id !== tempId));
        setError(err.message);
      });
  };

  const toggleSubtask = (item: any, idx: number) => {
    const { description, subtasks } = parseSubtasks(item.notes);
    run(() => updateTodoItem(item.id, { notes: serializeSubtasks(description, subtasks.map((st: any, i: number) => i === idx ? { ...st, checked: !st.checked } : st)) }));
  };
  const addSubtask = (item: any, text: string) => {
    if (!text.trim()) return;
    const { description, subtasks } = parseSubtasks(item.notes);
    run(() => updateTodoItem(item.id, { notes: serializeSubtasks(description, [...subtasks, { checked: false, text: text.trim() }]) }));
  };
  const deleteSubtask = (item: any, idx: number) => {
    const { description, subtasks } = parseSubtasks(item.notes);
    run(() => updateTodoItem(item.id, { notes: serializeSubtasks(description, subtasks.filter((_, i) => i !== idx)) }));
  };
  const addSubtasksBatch = (item: any, texts: string[]) => {
    if (!texts.length) return;
    const { description, subtasks } = parseSubtasks(item.notes);
    const newItems = texts.map(t => ({ checked: false, text: t.trim() }));
    run(() => updateTodoItem(item.id, { notes: serializeSubtasks(description, [...subtasks, ...newItems]) }));
  };
  const saveEditTitle = (item: any) => {
    const title = editingTitle.trim();
    if (title && title !== item.title) run(() => updateTodoItem(item.id, { title }));
    setEditingId(null); setEditingTitle('');
  };

  const handleDragStart = useCallback((item: any, x: number, y: number) => {
    dragItemRef.current = item;
    dragPosRef.current = { x, y };
    setDraggingItem(item);
  }, []);

  const showContextMenu = useCallback((item: any, x: number, y: number) => {
    setContextMenu({ x, y, item });
    setExpandedId(null);
  }, []);

  const handleComplete = useCallback((item: any) => {
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
            title: item.title, notes: item.notes, priority: item.priority,
            tagsText: (item.tags || []).join(', '), section_id: item.section_id,
            due_date: nextDate, recurrence: item.recurrence,
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

  const renderCard = (item: any, { inToday = false }: { inToday?: boolean } = {}) => (
    <TodoCard
      key={item.id}
      item={item}
      busy={false}
      today={today}
      expanded={expandedId === item.id}
      onToggleExpand={toggleExpand}
      onToggle={() => handleComplete(item)}
      onSetPriority={(pid: string) => {
        if (pid === item.priority) return;
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, priority: pid } : i));
        updateTodoItem(item.id, { priority: pid }).catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, priority: item.priority } : i));
        });
      }}
      onDrop={() => {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'dropped' } : i));
        setTodoStatus(item, 'dropped').catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: item.status } : i));
        });
      }}
      onToggleSubtask={(idx: number) => toggleSubtask(item, idx)}
      onAddSubtask={(text: string) => addSubtask(item, text)}
      onDeleteSubtask={(idx: number) => deleteSubtask(item, idx)}
      isLinkedToPlan={linkedPlanIds.has(item.id)}
      sections={sections}
      onMoveSection={(sId: string | null) => {
        if (sId === item.section_id) return;
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, section_id: sId } : i));
        updateTodoItem(item.id, { section_id: sId }).catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, section_id: item.section_id } : i));
        });
      }}
      isEditing={editingId === item.id}
      editingTitle={editingTitle}
      onEditStart={(t: string) => { setEditingId(item.id); setEditingTitle(t); }}
      onEditChange={setEditingTitle}
      onEditSave={() => saveEditTitle(item)}
      sectionName={item.section_id ? sectionById[item.section_id]?.name : null}
      sectionGoalKey={item.section_id ? sectionGoalMap[item.section_id] ?? null : null}
      dreamTitle={item.section_id ? sectionDreamMap[item.section_id] ?? null : null}
      onDragStart={handleDragStart}
      isDragging={draggingItem !== null}
      onShowContextMenu={showContextMenu}
      onMoveToToday={!inToday ? () => {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, due_date: today, ai_bucket: 'today', ai_classified_at: new Date().toISOString() } : i));
        updateTodoItem(item.id, { due_date: today, ai_bucket: 'today', ai_classified_at: new Date().toISOString() }).catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, due_date: item.due_date, ai_bucket: item.ai_bucket, ai_classified_at: item.ai_classified_at } : i));
        });
      } : undefined}
      onSetRecurrence={(r: string | null) => {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, recurrence: r || null } : i));
        updateTodoItem(item.id, { recurrence: r || undefined }).catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, recurrence: item.recurrence } : i));
        });
      }}
      session={session}
      onAddSubtasksBatch={(texts: string[]) => addSubtasksBatch(item, texts)}
    />
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <DataStateNotice tone="loading" title="Zadania się ładują" detail="Pobieram otwarte zadania." />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-text-primary">
      {draggingItem && <DragGhost item={draggingItem} posRef={dragPosRef} />}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          today={today}
          sections={sections}
          onClose={() => setContextMenu(null)}
          onComplete={() => {
            const cm = contextMenu;
            const newStatus = cm.item.status === 'done' ? 'open' : 'done';
            setContextMenu(null);
            handleComplete(cm.item);
          }}
          onDrop={() => {
            const cm = contextMenu;
            setContextMenu(null);
            setItems(prev => prev.map(i => i.id === cm.item.id ? { ...i, status: 'dropped' } : i));
            setTodoStatus(cm.item, 'dropped').catch((err) => {
              setError(err instanceof Error ? err.message : String(err));
              setItems(prev => prev.map(i => i.id === cm.item.id ? { ...i, status: cm.item.status } : i));
            });
          }}
          onMoveToToday={() => {
            const cm = contextMenu;
            setContextMenu(null);
            setItems(prev => prev.map(i => i.id === cm.item.id ? { ...i, due_date: today, ai_bucket: 'today', ai_classified_at: new Date().toISOString() } : i));
            updateTodoItem(cm.item.id, { due_date: today, ai_bucket: 'today', ai_classified_at: new Date().toISOString() }).catch((err) => {
              setError(err instanceof Error ? err.message : String(err));
              setItems(prev => prev.map(i => i.id === cm.item.id ? { ...i, due_date: cm.item.due_date, ai_bucket: cm.item.ai_bucket, ai_classified_at: cm.item.ai_classified_at } : i));
            });
          }}
          onClearDueDate={() => {
            const cm = contextMenu;
            setContextMenu(null);
            setItems(prev => prev.map(i => i.id === cm.item.id ? { ...i, due_date: null, ai_bucket: null } : i));
            updateTodoItem(cm.item.id, { due_date: null, ai_bucket: null }).catch((err) => {
              setError(err instanceof Error ? err.message : String(err));
              setItems(prev => prev.map(i => i.id === cm.item.id ? { ...i, due_date: cm.item.due_date, ai_bucket: cm.item.ai_bucket } : i));
            });
          }}
          onMoveSection={(sId: string | null) => {
            const cm = contextMenu;
            setContextMenu(null);
            setItems(prev => prev.map(i => i.id === cm.item.id ? { ...i, section_id: sId } : i));
            updateTodoItem(cm.item.id, { section_id: sId }).catch((err) => {
              setError(err instanceof Error ? err.message : String(err));
              setItems(prev => prev.map(i => i.id === cm.item.id ? { ...i, section_id: cm.item.section_id } : i));
            });
          }}
        />
      )}

      {/* Sidebar */}
      <aside className="keep-sidebar">
        <p className="keep-sidebar-section-label">Workspace</p>
        <button className="keep-sidebar-item" onClick={() => goTo('keep')}>
          <StickyNote size={15} />
          <span>Notatki</span>
        </button>
        <button className="keep-sidebar-item active">
          <ListTodo size={15} />
          <span>Zadania</span>
        </button>
        <button className="keep-sidebar-item" onClick={() => goTo('links')}>
          <BookOpen size={15} />
          <span>Pocket</span>
        </button>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-custom/60 bg-background/90 px-5 py-4 backdrop-blur-xl">
          <button onClick={onBack} className="flex items-center gap-1 text-primary font-medium text-[16px]">
            <ChevronLeft size={22} strokeWidth={2.5} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[20px] font-bold text-text-primary tracking-tight">Zadania</h1>
          </div>
          <button
            onClick={() => setShowDone((v) => !v)}
            className={`rounded-full p-2 transition-colors ${showDone ? 'text-primary bg-primary/10' : 'text-text-muted hover:text-text-primary hover:bg-surface'}`}
            title="Historia"
          >
            <History size={17} />
          </button>
        </header>

        {/* Section tabs */}
        <SectionTabs
          sections={sections}
          active={activeFilterSection}
          onSelect={setActiveFilterSection}
          onAdd={(name) => run(() => createTodoSection(userId, name))}
          onRename={(id, name) => run(() => renameTodoSection(id, name))}
          onDelete={(id) => { setActiveFilterSection(null); run(() => archiveTodoSection(id)); }}
        />

        <main
          className="flex-1 overflow-y-auto"
          onClick={() => setExpandedId(null)}
        >
          <div className="max-w-[600px] mx-auto space-y-4 px-6 py-5 pb-24">
            {error && <DataStateNotice tone="warning" title="Błąd" detail={error} />}

            {/* Quick capture */}
            <div ref={quickCaptureRef} className="border-b border-border-custom/20 pb-3">
              <div className="flex items-center gap-2">
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
                  onFocus={() => setIsExpanded(true)}
                  placeholder="Nowe zadanie..."
                  className="min-w-0 flex-1 bg-transparent py-2 text-[14px] font-medium text-text-primary outline-none placeholder:text-text-muted/25"
                />
                {form.title && (
                  <button
                    onClick={() => setForm({ ...form, title: '' })}
                    className="p-1 text-text-muted/40 hover:text-text-primary transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
                {!isExpanded && (
                  <button
                    onClick={() => setIsExpanded(true)}
                    className="rounded-full border border-border-custom/60 text-text-muted hover:text-text-primary p-2 transition-colors shrink-0"
                  >
                    <Settings2 size={16} />
                  </button>
                )}
                <button
                  onClick={addItem}
                  disabled={busy || !form.title.trim()}
                  className="rounded-full bg-primary p-2 text-white shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-95 disabled:opacity-35 transition-all shrink-0"
                >
                  <Plus size={16} />
                </button>
              </div>

              {(isExpanded || form.title.trim() !== '' || showOptions) && (
                <div className="mt-3 space-y-3 border-t border-border-custom pt-3">
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    placeholder="Opis... (podzadania: - [ ] krok)"
                    className="w-full resize-none rounded-xl border border-border-custom/60 bg-surface-solid/50 px-3 py-2.5 text-[12px] font-medium text-text-primary outline-none placeholder:text-text-muted/30 focus:border-primary/30"
                  />
                  <div className="flex flex-wrap gap-3">
                    {/* Section Selector */}
                    <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
                      <span className="text-[10px] font-semibold text-text-muted">Sekcja</span>
                      <select
                        value={form.section_id || ''}
                        onChange={(e) => setForm({ ...form, section_id: e.target.value })}
                        className="rounded-xl border border-border-custom/60 bg-surface-solid/50 px-2.5 py-2 text-[12px] font-semibold text-text-secondary outline-none focus:border-primary/30 cursor-pointer"
                      >
                        <option value="">📥 Skrzynka (brak sekcji)</option>
                        {sections.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Priority Buttons */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-text-muted">Priorytet</span>
                      <div className="flex gap-1">
                        {['urgent', 'high', 'normal', 'low'].map(p => {
                          const isSelected = (parsedInput.priority || form.priority) === p;
                          const meta = PRIORITY[p];
                          const labelMap: Record<string, string> = { urgent: 'P1', high: 'P2', normal: 'P3', low: 'P4' };
                          return (
                            <button
                              type="button"
                              key={p}
                              onClick={() => setForm(f => ({ ...f, priority: p }))}
                              className={`rounded-xl px-3 py-2 text-[11px] font-bold border transition-all ${
                                isSelected
                                  ? `${meta.chip} border-current ring-1 ring-current`
                                  : 'border-border-custom/60 text-text-muted hover:text-text-primary hover:bg-surface-solid'
                              }`}
                            >
                              {labelMap[p]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Due Date Selector */}
                    <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                      <span className="text-[10px] font-semibold text-text-muted">Termin</span>
                      <div className="flex gap-1 items-center">
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, due_date: today }))}
                          className={`rounded-xl px-2.5 py-2 text-[11px] font-semibold border transition-all ${
                            (parsedInput.due_date || form.due_date) === today
                              ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20'
                              : 'border-border-custom/60 text-text-muted hover:text-text-primary hover:bg-surface-solid'
                          }`}
                        >
                          Dziś
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            const tomorrowStr = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
                            setForm(f => ({ ...f, due_date: tomorrowStr }));
                          }}
                          className={`rounded-xl px-2.5 py-2 text-[11px] font-semibold border transition-all ${
                            (parsedInput.due_date || form.due_date) === (() => {
                              const tomorrow = new Date();
                              tomorrow.setDate(tomorrow.getDate() + 1);
                              return tomorrow.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
                            })()
                              ? 'bg-sky-500/15 text-sky-500 border-sky-500/20'
                              : 'border-border-custom/60 text-text-muted hover:text-text-primary hover:bg-surface-solid'
                          }`}
                        >
                          Jutro
                        </button>
                        <input
                          type="date"
                          value={parsedInput.due_date || form.due_date}
                          onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                          className="min-w-0 flex-1 rounded-xl border border-border-custom/60 bg-surface-solid/50 px-2 py-1.5 text-[11px] font-bold text-text-secondary outline-none focus:border-primary/30 cursor-pointer"
                        />
                        {(parsedInput.due_date || form.due_date) && (
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, due_date: '' })}
                            className="p-1 text-text-muted hover:text-rose-500 transition-colors"
                            title="Wyczyść datę"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Recurrence Selector */}
                    <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
                      <span className="text-[10px] font-semibold text-text-muted">Powtarzanie</span>
                      <select
                        value={form.recurrence || ''}
                        onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
                        className="rounded-xl border border-border-custom/60 bg-surface-solid/50 px-2.5 py-2 text-[12px] font-semibold text-text-secondary outline-none focus:border-primary/30 cursor-pointer"
                      >
                        <option value="">Nigdy</option>
                        <option value="daily">Codziennie</option>
                        <option value="weekly">Co tydzień</option>
                        <option value="monthly">Co miesiąc</option>
                      </select>
                    </div>

                    {/* Tags Input */}
                    <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
                      <span className="text-[10px] font-semibold text-text-muted">Tagi</span>
                      <input
                        value={form.tagsText}
                        onChange={(e) => setForm({ ...form, tagsText: e.target.value })}
                        placeholder="np. zakup, praca"
                        className="min-w-0 rounded-xl border border-border-custom/60 bg-surface-solid/50 px-3 py-2 text-[12px] font-semibold text-text-primary outline-none placeholder:text-text-muted/30 focus:border-primary/30"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border-custom pt-3">
                    <div>
                      {parsedInput.tokens.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {parsedInput.tokens.map((token) => (
                            <span key={`${token.type}-${token.value}`}
                              className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                                token.type === 'priority' ? (PRIORITY[token.value]?.chip ?? 'bg-surface-solid text-text-muted') : 'bg-primary/10 text-primary'
                              }`}
                            >
                              {token.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setIsExpanded(false); }}
                        className="rounded-xl border border-border-custom/60 px-4 py-2 text-[12px] font-semibold text-text-muted hover:text-text-primary transition-colors"
                      >
                        Zwiń
                      </button>
                      <button
                        type="button"
                        onClick={addItem}
                        disabled={busy || !form.title.trim()}
                        className="rounded-xl bg-primary px-5 py-2 text-[12px] font-bold text-white shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-95 disabled:opacity-35 transition-all"
                      >
                        Dodaj
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Batch classify chip */}
            {(() => {
              const unclassifiedCount = items.filter((i: any) => i.status === 'open' && !i.ai_bucket && !i.due_date).length;
              if (!unclassifiedCount) return null;
              return (
                <button
                  onClick={batchClassify}
                  disabled={batchClassifying}
                  className="flex w-full items-center gap-2 rounded-2xl border border-primary/10 bg-primary/[0.03] px-4 py-2.5 text-left transition-all hover:bg-primary/[0.07] active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  <Sparkles size={12} className={`shrink-0 text-primary ${batchClassifying ? 'animate-pulse' : ''}`} />
                  <span className="text-[11px] font-bold text-text-primary">
                    {batchClassifying ? 'Klasyfikuję...' : `Klasyfikuj z AI (${unclassifiedCount} zadań bez bucketu)`}
                  </span>
                </button>
              );
            })()}

            {/* Main List */}
            <div className="space-y-4">
              {activeFilterSection ? (
                // Active Section View
                (() => {
                  const sec = sections.find(s => s.id === activeFilterSection);
                  if (!sec) return null;
                  const secItems = items.filter(i => i.status === 'open' && i.section_id === sec.id);
                  const sortedItems = [...secItems].sort((a, b) => {
                    const pA = PRIORITY_ORDER.indexOf(a.priority);
                    const pB = PRIORITY_ORDER.indexOf(b.priority);
                    if (pA !== pB) return pB - pA;
                    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
                    if (a.due_date) return -1;
                    if (b.due_date) return 1;
                    return 0;
                  });

                  return (
                    <div key={sec.id} ref={el => { sectionRefs.current[sec.id] = el; }}>
                      <div className="flex items-center gap-2 px-3 py-2">
                        <span className="text-[16px] leading-none">📂</span>
                        <span className="text-[15px] font-bold text-text-primary">{sec.name}</span>
                        <span className="rounded-full bg-text-primary/[0.07] px-2 py-0.5 text-[12px] font-semibold tabular-nums text-text-secondary">
                          {sortedItems.length}
                        </span>
                      </div>
                      <div className="pt-1">
                        {sortedItems.length === 0 ? (
                          <p className="px-3 py-5 text-center text-[11px] font-medium text-text-muted/50">
                            Brak otwartych zadań w tej sekcji.
                          </p>
                        ) : (
                          sortedItems.map((i: any) => renderCard(i))
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                // Overview Dashboard (Grouped sections)
                <>
                  {/* 1. Na dziś / Aktywne */}
                  {(todayItems.length > 0 || dragTarget === 'today') && (
                    <div ref={todayZoneRef}>
                      <BucketHeader
                        icon="🔥"
                        title="Na dziś / Aktywne"
                        count={todayItems.length}
                        collapsed={!!collapsedSections['today']}
                        onToggle={() => toggleSectionCollapse('today')}
                        isDropTarget={dragTarget === 'today'}
                      />
                      {!collapsedSections['today'] && (
                        <div className="pt-1">
                          {todayItems.length === 0 ? (
                            <p className="px-3 py-5 text-center text-[11px] font-medium text-orange-500/50">
                              ↓ Upuść tutaj — przeniesie na dziś
                            </p>
                          ) : (
                            todayItems.map((i: any) => renderCard(i, { inToday: true }))
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. Inbox / Skrzynka */}
                  {(inboxItems.length > 0 || dragTarget === 'inbox') && (
                    <div ref={inboxZoneRef}>
                      <BucketHeader
                        icon="📥"
                        title="Skrzynka / Inbox"
                        count={inboxItems.length}
                        collapsed={!!collapsedSections['inbox']}
                        onToggle={() => toggleSectionCollapse('inbox')}
                        isDropTarget={dragTarget === 'inbox'}
                      />
                      {!collapsedSections['inbox'] && (
                        <div className="pt-1">
                          {inboxItems.length === 0 ? (
                            <p className="px-3 py-3 text-center text-[11px] text-text-muted/40">
                              ↓ Upuść tutaj
                            </p>
                          ) : (
                            inboxItems.map((i: any) => renderCard(i))
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. Sections */}
                  {sectionsWithItems.map((sec) => {
                    const isCollapsed = !!collapsedSections[sec.id];
                    const hasItems = sec.items.length > 0;
                    if (!hasItems && dragTarget !== sec.id) return null;

                    return (
                      <div key={sec.id} ref={el => { sectionRefs.current[sec.id] = el; }}>
                        <BucketHeader
                          icon="📂"
                          title={sec.name}
                          count={sec.items.length}
                          collapsed={isCollapsed}
                          onToggle={() => toggleSectionCollapse(sec.id)}
                          isDropTarget={dragTarget === sec.id}
                        />
                        {!isCollapsed && (
                          <div className="pt-1">
                            {sec.items.length === 0 ? (
                              <p className="px-3 py-3 text-center text-[11px] text-text-muted/40">
                                ↓ Upuść tutaj
                              </p>
                            ) : (
                              sec.items.map((i: any) => renderCard(i))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {/* Done items history */}
              {showDone && doneItems.length > 0 && (
                <div className="border-t border-border-custom/20 pt-2">
                  <BucketHeader
                    icon="✅"
                    title="Historia"
                    count={doneItems.length}
                    collapsed={false}
                    onToggle={() => setShowDone(false)}
                    isDropTarget={false}
                  />
                  <div className="pt-1">
                    {doneItems.slice(0, 30).map((i: any) => renderCard(i))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 flex border-t border-border-custom bg-background/95 backdrop-blur-xl">
        <button onClick={() => onNavigateTo?.('keep')} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-text-muted active:bg-surface">
          <StickyNote size={22} />
          <span className="text-[11px] font-semibold">Notatki</span>
        </button>
        <button className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-primary">
          <ListTodo size={22} />
          <span className="text-[11px] font-semibold">Zadania</span>
        </button>
        <button onClick={() => onNavigateTo?.('links')} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-text-muted active:bg-surface">
          <BookOpen size={22} />
          <span className="text-[11px] font-semibold">Pocket</span>
        </button>
      </nav>
    </div>
  );
}
