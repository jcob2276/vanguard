import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  ChevronLeft,
  History,
  ListTodo,
  Sparkles,
  StickyNote,
  BookOpen,
  LayoutGrid,
  Kanban,
  Clock3,
  Calendar,
  Search,
  X,
  Bookmark,
  PanelLeft,
  Trash2,
  Check,
} from 'lucide-react';

import DataStateNotice from '../core/DataStateNotice';
import {
  archiveTodoSection,
  createTodoSection,
  renameTodoSection,
  setTodoStatus,
  updateTodoItem,
  deleteTodoItem,
  createTodoItem,
} from '../../lib/todo';
import { supabase } from '../../lib/supabase';
import ContextMenu from './ContextMenu';
import DragGhost from './DragGhost';
import BucketHeader from './BucketHeader';
import TodoCard from './TodoCard';
import TodoSidebar, { type TodoNavDest } from './TodoSidebar';
import TodoQuickCapture from './TodoQuickCapture';
import TodoScanTextModal from './TodoScanTextModal';
import EisenhowerMatrix from './EisenhowerMatrix';
import KanbanView from './KanbanView';
import TimelineView from './TimelineView';
import TodayEventsPanel from './TodayEventsPanel';
import { useTodoData } from './useTodoData';
import { Session } from '@supabase/supabase-js';

export default function Todo({ session, onBack, onNavigateTo }: { session: Session; onBack: () => void; onNavigateTo?: (dest: string) => void }) {
  const {
    userId,
    push, pushSubscribed, setPushSubscribed,
    sections, items, setItems, doneItems,
    loading, busy, error, setError,
    showDone, setShowDone,
    expandedId, setExpandedId,
    editingId, setEditingId,
    editingTitle, setEditingTitle,
    linkedPlanIds,
    activeFilterSection, setActiveFilterSection,
    collapsedSections, toggleSectionCollapse,
    toggleExpand, goTo,
    form, setForm,
    contextMenu, setContextMenu,
    isExpanded, setIsExpanded,
    batchClassifying, batchClassify,
    quickCaptureRef,
    draggingItem, dragTarget,
    dragPosRef,
    todayZoneRef, inboxZoneRef, sectionRefs,
    today,
    sectionById, sectionGoalMap, sectionDreamMap,
    parsedInput,
    todayItems, inboxItems, upcomingItems, sectionsWithItems,
    run, addItem, fetchAll,
    saveEditTitle,
    handleDragStart, showContextMenu, handleComplete,
    getChildren, addChildTask,
    smartLists, searchQuery, setSearchQuery,
    activeSmartListId, setActiveSmartListId,
    saveCurrentAsSmartList, removeSmartList, activeSmartQuery,
  } = useTodoData({ session, onNavigateTo });

  const [todoView, setTodoView] = useState<'lista' | 'eisenhower' | 'kanban' | 'timeline'>('lista');
  const [activeAddSectionId, setActiveAddSectionId] = useState<string | null>(null);
  const [addingSectionIndex, setAddingSectionIndex] = useState<number | null>(null);
  const [newSectionForm, setNewSectionForm] = useState({ name: '', notes: '' });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSaveSmartList, setShowSaveSmartList] = useState(false);
  const [newSmartListName, setNewSmartListName] = useState('');
  const [visibleDoneCount, setVisibleDoneCount] = useState(30);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    isDanger?: boolean;
  } | null>(null);
  const [navDest, setNavDest] = useState<TodoNavDest>('overview');
  const [scanTextOpen, setScanTextOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-open quick capture when navigated with ?new=1 (PWA shortcut / Telegram)
  const autoNewTaskHandled = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1' && !autoNewTaskHandled.current) {
      autoNewTaskHandled.current = true;
      window.history.replaceState({}, '', window.location.pathname);
      setActiveAddSectionId('today');
      setIsExpanded(true);
      setForm({
        title: '',
        notes: '',
        priority: 'normal',
        tagsText: '',
        due_date: today,
        recurrence: '',
        section_id: '',
        scheduled_time: '',
        reminder_at: '',
      });
    }
  }, []);

  const renderInlineQuickCapture = (sectionId: string) => {
    if (activeAddSectionId !== sectionId) return null;
    return (
      <div className="pt-2">
        <TodoQuickCapture
          quickCaptureRef={quickCaptureRef}
          form={form}
          setForm={setForm}
          isExpanded={isExpanded}
          setIsExpanded={(val) => {
            setIsExpanded(val);
            if (!val) setActiveAddSectionId(null);
          }}
          busy={busy}
          addItem={() => {
            addItem();
            setActiveAddSectionId(null);
          }}
          sections={sections}
          parsedInput={parsedInput}
          today={today}
          onOpenScanText={() => setScanTextOpen(true)}
        />
      </div>
    );
  };

  const renderAddTodoButton = (sectionId: string) => {
    if (activeAddSectionId === sectionId) return null;
    return (
      <button
        onClick={() => {
          setActiveAddSectionId(sectionId);
          setIsExpanded(true);
          const defaultDate = sectionId === 'today' ? today : '';
          const defaultSec = sectionId === 'today' || sectionId === 'inbox' ? '' : sectionId;
          setForm({
            title: '',
            notes: '',
            priority: 'normal',
            tagsText: '',
            due_date: defaultDate,
            recurrence: '',
            section_id: defaultSec,
            scheduled_time: '',
            reminder_at: '',
          });
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-[13px] font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer group mt-2"
      >
        <span className="text-[16px] text-primary group-hover:text-primary font-bold">+</span>
        <span>Dodaj zadanie</span>
      </button>
    );
  };

  const renderCard = (item: any, { inToday = false, hideSectionChip = false }: { inToday?: boolean; hideSectionChip?: boolean } = {}) => (
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
      sectionName={!hideSectionChip && item.section_id ? sectionById[item.section_id]?.name : null}
      sectionGoalKey={item.section_id ? sectionGoalMap[item.section_id] ?? null : null}
      dreamTitle={item.section_id ? sectionDreamMap[item.section_id] ?? null : null}
      onDragStart={handleDragStart}
      isDragging={draggingItem?.id === item.id}
      onShowContextMenu={showContextMenu}
      onMoveToToday={!inToday ? () => {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, due_date: today, ai_bucket: 'today', ai_classified_at: new Date().toISOString() } : i));
        updateTodoItem(item.id, { due_date: today, ai_bucket: 'today', ai_classified_at: new Date().toISOString() }).catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, due_date: item.due_date, ai_bucket: item.ai_bucket, ai_classified_at: item.ai_classified_at } : i));
        });
      } : undefined}
      onSetDueDate={(date: string | null) => {
        const patch = { due_date: date, ai_bucket: null };
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...patch } : i));
        updateTodoItem(item.id, patch as any).catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, due_date: item.due_date, ai_bucket: item.ai_bucket } : i));
        });
      }}
      onSetRecurrence={(r: string | null) => {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, recurrence: r || null } : i));
        updateTodoItem(item.id, { recurrence: r || undefined }).catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, recurrence: item.recurrence } : i));
        });
      }}
      onSetReminder={(isoDatetime: string) => {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, reminder_at: isoDatetime, reminder_sent: false } : i));
        updateTodoItem(item.id, { reminder_at: isoDatetime, reminder_sent: false } as any).catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, reminder_at: item.reminder_at, reminder_sent: item.reminder_sent } : i));
        });
      }}
      onCancelReminder={() => {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, reminder_at: null, reminder_sent: false } : i));
        updateTodoItem(item.id, { reminder_at: null, reminder_sent: false } as any).catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
        });
      }}
      onSetTags={(tags: string[]) => {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, tags } : i));
        updateTodoItem(item.id, { tags } as any).catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, tags: item.tags } : i));
        });
      }}
      onSetSphere={(sphere: string | null) => {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, category: sphere } : i));
        updateTodoItem(item.id, { category: sphere } as any).catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, category: item.category } : i));
        });
      }}
      onAiBreakdown={async () => {
        const { data, error } = await supabase.functions.invoke('vanguard-task-breakdown', {
          body: { itemId: item.id, userId, title: item.title, notes: item.notes },
        });
        if (error) throw error;
        return (data?.subtasks as string[]) ?? [];
      }}
      onSetTitle={(newTitle: string) => {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, title: newTitle } : i));
        updateTodoItem(item.id, { title: newTitle } as any).catch(() => {
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, title: item.title } : i));
        });
      }}
      onSetNotes={(newNotes: string | null) => {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, notes: newNotes } : i));
        updateTodoItem(item.id, { notes: newNotes || null } as any).catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, notes: item.notes } : i));
        });
      }}
      childTasks={getChildren(item.id)}
      onAddChildTask={(title: string) => addChildTask(item, title)}
      onToggleChildTask={(child: any) => handleComplete(child)}
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
    <div className="todoist-theme flex h-screen overflow-hidden bg-background text-text-primary">
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
            setContextMenu(null);
            handleComplete(cm.item);
          }}
          onDelete={() => {
            const cm = contextMenu;
            setContextMenu(null);
            setConfirmModal({
              title: 'Usunąć zadanie?',
              message: `Czy na pewno chcesz usunąć na stałe zadanie "${cm.item.title}"? Tego nie można cofnąć.`,
              confirmText: 'Usuń',
              isDanger: true,
              onConfirm: () => {
                setItems(prev => prev.filter(i => i.id !== cm.item.id));
                deleteTodoItem(cm.item.id).catch((err) => {
                  setError(err instanceof Error ? err.message : String(err));
                  setItems(prev => [...prev, cm.item]);
                });
              }
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
          onSetDueDate={(dateStr) => {
            const cm = contextMenu;
            setContextMenu(null);
            setItems(prev => prev.map(i => i.id === cm.item.id ? { ...i, due_date: dateStr, ai_bucket: dateStr ? i.ai_bucket : null } : i));
            updateTodoItem(cm.item.id, { due_date: dateStr, ...(dateStr ? {} : { ai_bucket: null }) }).catch((err) => {
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
          onEditStart={() => {
            const cm = contextMenu;
            setContextMenu(null);
            setEditingId(cm.item.id);
            setEditingTitle(cm.item.title);
          }}
          onSetPriority={(priority) => {
            const cm = contextMenu;
            setContextMenu(null);
            setItems(prev => prev.map(i => i.id === cm.item.id ? { ...i, priority } : i));
            updateTodoItem(cm.item.id, { priority }).catch((err) => {
              setError(err instanceof Error ? err.message : String(err));
              setItems(prev => prev.map(i => i.id === cm.item.id ? { ...i, priority: cm.item.priority } : i));
            });
          }}
          onDuplicate={() => {
            const cm = contextMenu;
            setContextMenu(null);
            createTodoItem(userId, {
              title: `${cm.item.title} (Kopia)`,
              notes: cm.item.notes || undefined,
              priority: cm.item.priority,
              due_date: cm.item.due_date || undefined,
              section_id: cm.item.section_id || undefined,
              recurrence: cm.item.recurrence || undefined,
              tagsText: (cm.item.tags || []).join(', ')
            }).then((newItem) => {
              setItems(prev => [...prev, newItem]);
            }).catch((err) => {
              setError(err instanceof Error ? err.message : String(err));
            });
          }}
          onToggleImportant={() => {
            const cm = contextMenu;
            setContextMenu(null);
            const nextVal = !cm.item.is_important;
            setItems(prev => prev.map(i => i.id === cm.item.id ? { ...i, is_important: nextVal } : i));
            updateTodoItem(cm.item.id, { is_important: nextVal }).catch((err) => {
              setError(err instanceof Error ? err.message : String(err));
              setItems(prev => prev.map(i => i.id === cm.item.id ? { ...i, is_important: cm.item.is_important } : i));
            });
          }}
        />
      )}

      {/* Todo nav sidebar */}
      <TodoSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        navDest={navDest}
        onNavDest={(d) => { setNavDest(d); setActiveFilterSection(null); }}
        inboxCount={inboxItems.length}
        todayCount={todayItems.length}
        upcomingCount={upcomingItems.length}
        sections={sections}
        activeSectionId={activeFilterSection}
        onSelectSection={(id) => { setNavDest('overview'); setActiveFilterSection(id); }}
        onAddSection={(name) => run(() => createTodoSection(userId, name))}
        onRenameSection={(id, name) => run(() => renameTodoSection(id, name))}
        onDeleteSection={(id) => { setActiveFilterSection(null); run(() => archiveTodoSection(id)); }}
        onQuickAdd={() => {
          setIsExpanded(true);
          quickCaptureRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => quickCaptureRef.current?.querySelector('input')?.focus(), 50);
        }}
        onFocusSearch={() => {
          searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          searchInputRef.current?.focus();
        }}
        onNavigateTo={onNavigateTo}
      />

      {/* Main column */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-custom/60 bg-background/90 px-5 py-4 backdrop-blur-xl">
          <button onClick={onBack} className="flex items-center gap-1 text-primary font-medium text-[16px] shrink-0">
            <ChevronLeft size={22} strokeWidth={2.5} />
          </button>
          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-text-primary/[0.04] rounded-lg transition-colors cursor-pointer shrink-0"
              title="Rozwiń panel boczny"
            >
              <PanelLeft size={16} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-[20px] font-bold text-text-primary tracking-tight">Zadania</h1>
          </div>
          {push.isSupported && pushSubscribed === false && (
            <button
              onClick={async () => {
                const ok = await push.subscribe();
                if (ok) setPushSubscribed(true);
              }}
              title="Włącz powiadomienia push"
              className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/8 px-3 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/15 transition-colors"
            >
              <Bell size={12} /> Powiadomienia
            </button>
          )}
          {/* View switcher */}
          <div className="flex items-center rounded-xl border border-border-custom/50 bg-surface/40 p-0.5 gap-0.5">
            <button
              onClick={() => setTodoView('lista')}
              className={`rounded-lg p-1.5 transition-all ${todoView === 'lista' ? 'bg-primary/15 text-primary' : 'text-text-muted hover:text-text-primary'}`}
              title="Lista"
            >
              <ListTodo size={15} />
            </button>
            <button
              onClick={() => setTodoView('eisenhower')}
              className={`rounded-lg p-1.5 transition-all ${todoView === 'eisenhower' ? 'bg-primary/15 text-primary' : 'text-text-muted hover:text-text-primary'}`}
              title="Macierz Eisenhowera"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setTodoView('kanban')}
              className={`rounded-lg p-1.5 transition-all ${todoView === 'kanban' ? 'bg-primary/15 text-primary' : 'text-text-muted hover:text-text-primary'}`}
              title="Kanban"
            >
              <Kanban size={15} />
            </button>
            <button
              onClick={() => setTodoView('timeline')}
              className={`rounded-lg p-1.5 transition-all ${todoView === 'timeline' ? 'bg-primary/15 text-primary' : 'text-text-muted hover:text-text-primary'}`}
              title="Oś czasu"
            >
              <Clock3 size={15} />
            </button>
          </div>
          <button
            onClick={() => setShowDone((v) => !v)}
            className={`rounded-full p-2 transition-colors ${showDone ? 'text-primary bg-primary/10' : 'text-text-muted hover:text-text-primary hover:bg-surface'}`}
            title="Historia"
          >
            <History size={17} />
          </button>
        </header>

        {/* Search + Smart Lists */}
        <div className="px-4 pt-3 pb-1 space-y-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/50 pointer-events-none" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); if (e.target.value) setActiveSmartListId(null); }}
              placeholder="Szukaj… tag:x priority:high due:week section:nazwa"
              className="w-full rounded-xl border border-border-custom/50 bg-surface-solid/40 pl-8 pr-8 py-2 text-[12px] font-medium text-text-primary outline-none placeholder:text-text-muted/35 focus:border-primary/30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {(smartLists.length > 0 || activeSmartQuery) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {smartLists.map((sl) => (
                <button
                  key={sl.id}
                  onClick={() => { setSearchQuery(''); setActiveSmartListId(cur => cur === sl.id ? null : sl.id); }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setConfirmModal({
                      title: 'Usunąć Smart Listę?',
                      message: `Czy na pewno chcesz usunąć Smart Listę "${sl.name}"?`,
                      confirmText: 'Usuń',
                      isDanger: true,
                      onConfirm: () => removeSmartList(sl.id)
                    });
                  }}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all ${
                    activeSmartListId === sl.id
                      ? 'bg-primary/15 border-primary/30 text-primary'
                      : 'border-border-custom/50 text-text-muted hover:text-text-primary hover:bg-surface-solid/40'
                  }`}
                  title="Kliknij prawym, aby usunąć"
                >
                  <span>{sl.icon}</span>
                  {sl.name}
                </button>
              ))}
              {searchQuery.trim() && !activeSmartListId && (
                showSaveSmartList ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={newSmartListName}
                      onChange={(e) => setNewSmartListName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newSmartListName.trim()) {
                          saveCurrentAsSmartList(newSmartListName);
                          setNewSmartListName('');
                          setShowSaveSmartList(false);
                        } else if (e.key === 'Escape') setShowSaveSmartList(false);
                      }}
                      placeholder="Nazwa Smart Listy…"
                      className="rounded-full border border-primary/30 bg-surface-solid/60 px-2.5 py-1 text-[10px] font-semibold text-text-primary outline-none w-32"
                    />
                    <button
                      onClick={() => {
                        if (newSmartListName.trim()) {
                          saveCurrentAsSmartList(newSmartListName);
                          setNewSmartListName('');
                          setShowSaveSmartList(false);
                        }
                      }}
                      className="text-primary text-[10px] font-black px-1.5"
                    >
                      Zapisz
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSaveSmartList(true)}
                    className="flex items-center gap-1 rounded-full border border-dashed border-border-custom/60 px-2.5 py-1 text-[10px] font-bold text-text-muted hover:text-primary hover:border-primary/40 transition-all"
                  >
                    <Bookmark size={10} /> Zapisz jako Smart Listę
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {todoView === 'eisenhower' && (
          <main className="flex-1 overflow-y-auto" onClick={() => setExpandedId(null)}>
            <EisenhowerMatrix items={items as any} setItems={setItems as any} />
          </main>
        )}

        {todoView === 'kanban' && (
          <main className="flex-1 overflow-hidden">
            <KanbanView items={items as any} sections={sections} setItems={setItems as any} today={today} />
          </main>
        )}

        {todoView === 'timeline' && (
          <main className="flex-1 overflow-hidden">
            <TimelineView
              items={todayItems as any}
              sectionGoalMap={sectionGoalMap}
              today={today}
              onToggle={(item: any) => handleComplete(item)}
              onExpand={(id: string) => toggleExpand(id)}
            />
          </main>
        )}

        {todoView === 'lista' && (
        <main
          className="flex-1 overflow-y-auto"
          onClick={() => setExpandedId(null)}
        >
          <div className="max-w-[600px] mx-auto space-y-4 px-6 py-5 pb-24">
            {error && <DataStateNotice tone="warning" title="Błąd" detail={error} />}



            {/* Batch classify chip */}
            {(() => {
              const unclassifiedCount = items.filter((i: any) => i.status === 'open' && !i.ai_bucket && !i.due_date).length;
              if (!unclassifiedCount) return null;
              return (
                <button
                  onClick={batchClassify}
                  disabled={batchClassifying}
                  className="relative overflow-hidden w-full flex items-center justify-between rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 px-4 py-3 text-left transition-all hover:scale-[1.01] hover:border-indigo-500/30 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] active:scale-[0.99] disabled:opacity-50 cursor-pointer group animate-[pulse_4s_infinite] shadow-[0_0_12px_rgba(99,102,241,0.06)]"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
                      <Sparkles size={14} className={`${batchClassifying ? 'animate-spin' : 'animate-pulse group-hover:scale-110 transition-transform'}`} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[12px] font-bold text-text-primary">
                        {batchClassifying ? 'Porządkowanie zadań...' : 'Szybka klasyfikacja z AI'}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {batchClassifying ? 'Analizuję treść przez DeepSeek' : `${unclassifiedCount} zadań czeka na automatyczne przypisanie`}
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] font-bold bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full uppercase tracking-wider scale-90 group-hover:scale-95 transition-transform">
                    Start
                  </div>
                </button>
              );
            })()}

            {/* Main List */}
            <div className="space-y-8">
              {navDest === 'today' ? (
                // Dziś (flat smart view — tasks due today or ai_bucket='today', across all sections)
                <div>
                  <div className="flex items-center gap-2 px-1 pt-6 pb-4">
                    <span className="text-[20px] leading-none">📅</span>
                    <span className="text-[24px] font-extrabold text-text-primary tracking-tight">Dziś</span>
                    <span className="text-[13px] font-medium text-text-muted/50 ml-1">
                      {todayItems.length}
                    </span>
                  </div>
                  <div className="pt-1">
                    {todayItems.length === 0 ? (
                      <div className="mx-1 my-2 rounded-xl border border-dashed border-border-custom/25 p-6 text-center text-text-muted/30 bg-surface-solid/10">
                        <span className="block text-[14px] mb-1">📅</span>
                        <span className="text-[11px] font-bold tracking-wide">Brak zadań na dziś.</span>
                      </div>
                    ) : (
                      todayItems.map((i: any) => renderCard(i, { inToday: true }))
                    )}
                    {renderInlineQuickCapture('today')}
                    {renderAddTodoButton('today')}
                  </div>
                </div>
              ) : navDest === 'inbox' ? (
                // Skrzynka (flat smart view — tasks with no section)
                <div>
                  <div className="flex items-center gap-2 px-1 pt-6 pb-4">
                    <span className="text-[20px] leading-none">📥</span>
                    <span className="text-[24px] font-extrabold text-text-primary tracking-tight">Skrzynka</span>
                    <span className="text-[13px] font-medium text-text-muted/50 ml-1">
                      {inboxItems.length}
                    </span>
                  </div>
                  <div className="pt-1">
                    {inboxItems.length === 0 ? (
                      <div className="mx-1 my-2 rounded-xl border border-dashed border-border-custom/25 p-6 text-center text-text-muted/30 bg-surface-solid/10">
                        <span className="block text-[14px] mb-1">📥</span>
                        <span className="text-[11px] font-bold tracking-wide">Skrzynka pusta.</span>
                      </div>
                    ) : (
                      inboxItems.map((i: any) => renderCard(i))
                    )}
                    {renderInlineQuickCapture('inbox')}
                    {renderAddTodoButton('inbox')}
                  </div>
                </div>
              ) : navDest === 'upcoming' ? (
                // Nadchodzące (flat smart view — open tasks due in the next 7 days, grouped by date)
                <div>
                  <div className="flex items-center gap-2 px-1 pt-6 pb-4">
                    <span className="text-[20px] leading-none">🗓️</span>
                    <span className="text-[24px] font-extrabold text-text-primary tracking-tight">Nadchodzące</span>
                    <span className="text-[13px] font-medium text-text-muted/50 ml-1">
                      {upcomingItems.length}
                    </span>
                  </div>
                  <div className="pt-1">
                    {upcomingItems.length === 0 ? (
                      <div className="mx-1 my-2 rounded-xl border border-dashed border-border-custom/25 p-6 text-center text-text-muted/30 bg-surface-solid/10">
                        <span className="block text-[14px] mb-1">🗓️</span>
                        <span className="text-[11px] font-bold tracking-wide">Brak zadań w najbliższych 7 dniach.</span>
                      </div>
                    ) : (
                      (() => {
                        let lastDate: string | null = null;
                        return upcomingItems.map((i: any) => {
                          const showDateHeader = i.due_date !== lastDate;
                          lastDate = i.due_date;
                          return (
                            <React.Fragment key={i.id}>
                              {showDateHeader && i.due_date && (
                                <div className="px-3 pt-3 pb-1 text-[10px] font-black uppercase tracking-wider text-text-muted/50">
                                  {new Date(`${i.due_date}T12:00:00Z`).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </div>
                              )}
                              {renderCard(i)}
                            </React.Fragment>
                          );
                        });
                      })()
                    )}
                    {renderInlineQuickCapture('upcoming')}
                    {renderAddTodoButton('upcoming')}
                  </div>
                </div>
              ) : activeFilterSection ? (
                // Active Section View
                (() => {
                  const sec = sectionsWithItems.find(s => s.id === activeFilterSection);
                  if (!sec) return null;
                  const sortedItems = sec.items;

                  return (
                    <div key={sec.id} ref={el => { sectionRefs.current[sec.id] = el; }}>
                      <div className="flex items-center gap-2 px-1 pt-6 pb-4">
                        <span className="text-[20px] leading-none">📂</span>
                        <span className="text-[24px] font-extrabold text-text-primary tracking-tight">{sec.name}</span>
                        <span className="text-[13px] font-medium text-text-muted/50 ml-1">
                          {sortedItems.length}
                        </span>
                      </div>
                      <div className="pt-1">
                        {sortedItems.length === 0 ? (
                          <div className="mx-1 my-2 rounded-xl border border-dashed border-border-custom/25 p-6 text-center text-text-muted/30 bg-surface-solid/10">
                            <span className="block text-[14px] mb-1">📂</span>
                            <span className="text-[11px] font-bold tracking-wide">Brak otwartych zadań w tej sekcji.</span>
                          </div>
                        ) : (
                          sortedItems.map((i: any) => renderCard(i, { hideSectionChip: true }))
                        )}
                        {renderInlineQuickCapture(sec.id)}
                        {renderAddTodoButton(sec.id)}
                      </div>
                    </div>
                  );
                })()
              ) : (
                // Overview Dashboard (Grouped sections)
                <>
                  {/* 1. Na dziś / Aktywne */}
                  {(todayItems.length > 0 || draggingItem !== null) && (
                    <div
                      ref={todayZoneRef}
                      className={`rounded-2xl p-2 transition-all duration-200 ${
                        draggingItem !== null
                          ? dragTarget === 'today'
                            ? 'border border-orange-500/40 bg-orange-500/10 scale-[1.01] shadow-[0_4px_25px_rgba(249,115,22,0.12)]'
                            : 'border border-dashed border-orange-500/20 bg-orange-500/5'
                          : 'border border-transparent bg-transparent'
                      }`}
                    >
                      <BucketHeader
                        icon="🔥"
                        title="Na dziś / Aktywne"
                        count={todayItems.length}
                        collapsed={!!collapsedSections['today']}
                        onToggle={() => toggleSectionCollapse('today')}
                        isDropTarget={dragTarget === 'today'}
                      />
                      {(() => {
                        const totalMin = todayItems.reduce((s: number, i: any) => s + (i.duration_minutes || 0), 0);
                        if (totalMin === 0) return null;
                        const capMin = 480;
                        const pct = Math.min(100, Math.round((totalMin / capMin) * 100));
                        const over = totalMin > capMin;
                        const label = totalMin >= 60
                          ? `${Math.floor(totalMin / 60)}h${totalMin % 60 > 0 ? ` ${totalMin % 60}m` : ''}`
                          : `${totalMin}m`;
                        return (
                          <div className="mb-2 -mt-1 px-0.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] font-semibold uppercase tracking-wider text-text-muted/40">Zaplanowane</span>
                              <span className={`text-[9px] font-bold tabular-nums ${over ? 'text-rose-400' : 'text-text-muted/50'}`}>{label} / 8h</span>
                            </div>
                            <div className="h-[3px] rounded-full bg-surface-solid overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-rose-400/70' : 'bg-orange-400/60'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                      {!collapsedSections['today'] && (
                        <div className="pt-1">
                          {todayItems.length === 0 ? (
                            <div className={`mx-1 my-2 rounded-xl border border-dashed p-6 text-center transition-all duration-200 ${
                              dragTarget === 'today'
                                ? 'border-orange-500 bg-orange-500/5 text-orange-500 scale-[1.01] shadow-lg shadow-orange-500/5'
                                : 'border-orange-500/25 text-orange-500/40 bg-surface-solid/10'
                            }`}>
                              <span className="block text-[14px] mb-1">🔥</span>
                              <span className="text-[11px] font-bold tracking-wide">Upuść tutaj, aby zaplanować na dziś</span>
                            </div>
                          ) : (
                            <>
                              {(() => {
                                const pending = todayItems.filter((i: any) => i.status !== 'done' && i.status !== 'dropped');
                                if (pending.length < 2) return null;
                                const focus = pending[0];
                                const [focusEmoji] = focus.title.match(/^\p{Emoji}/u) ?? [''];
                                const focusLabel = focusEmoji ? focus.title.slice([...focusEmoji].length).trim() : focus.title;
                                return (
                                  <button
                                    onClick={() => toggleExpand(focus.id)}
                                    className="w-full mb-2 flex items-center gap-2.5 rounded-xl border border-orange-500/20 bg-orange-500/6 px-3 py-2.5 text-left hover:bg-orange-500/10 transition-all btn-press"
                                  >
                                    <span className="text-[16px] leading-none shrink-0">{focusEmoji || '🎯'}</span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[9px] font-black uppercase tracking-widest text-orange-400/70 mb-0.5">Co teraz?</p>
                                      <p className="text-[13px] font-semibold text-text-primary leading-snug truncate">{focusLabel}</p>
                                    </div>
                                    <span className="shrink-0 rounded-lg bg-orange-500/15 px-2 py-1 text-[10px] font-bold text-orange-400">Zacznij →</span>
                                  </button>
                                );
                              })()}
                              {todayItems.map((i: any) => renderCard(i, { inToday: true }))}
                            </>
                          )}
                          {renderInlineQuickCapture('today')}
                          {renderAddTodoButton('today')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. Inbox / Skrzynka */}
                  {(inboxItems.length > 0 || draggingItem !== null) && (
                    <div
                      ref={inboxZoneRef}
                      className={`rounded-2xl p-2 transition-all duration-200 ${
                        draggingItem !== null
                          ? dragTarget === 'inbox'
                            ? 'border border-primary/40 bg-primary/10 scale-[1.01] shadow-[0_4px_25px_rgba(99,102,241,0.12)]'
                            : 'border border-dashed border-primary/20 bg-primary/5'
                          : 'border border-transparent bg-transparent'
                      }`}
                    >
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
                            <div className={`mx-1 my-2 rounded-xl border border-dashed p-6 text-center transition-all duration-200 ${
                              dragTarget === 'inbox'
                                ? 'border-primary bg-primary/5 text-primary scale-[1.01] shadow-lg shadow-primary/5'
                                : 'border-border-custom/25 text-text-muted/30 bg-surface-solid/10'
                            }`}>
                              <span className="block text-[14px] mb-1">📥</span>
                              <span className="text-[11px] font-bold tracking-wide">Upuść tutaj, aby przenieść do skrzynki</span>
                            </div>
                          ) : (
                            inboxItems.map((i: any) => renderCard(i))
                          )}
                          {renderInlineQuickCapture('inbox')}
                          {renderAddTodoButton('inbox')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. Sections */}
                  {sectionsWithItems.map((sec, idx) => {
                    const isCollapsed = !!collapsedSections[sec.id];
                    const hasItems = sec.items.length > 0;
                    if (!hasItems && draggingItem === null) return null;

                    return (
                      <React.Fragment key={sec.id}>
                        {/* Hover separator BEFORE section */}
                        {idx > 0 && (
                          <div
                            onClick={() => {
                              setAddingSectionIndex(idx);
                              setNewSectionForm({ name: '', notes: '' });
                            }}
                            className="todoist-section-divider-line animate-fade-in"
                          />
                        )}

                        {/* Inline Add Section Form */}
                        {addingSectionIndex === idx && (
                          <div className="border border-border-custom bg-surface-solid/40 rounded-2xl p-4.5 mb-3 flex flex-col gap-3 shadow-lg">
                            <input
                              autoFocus
                              value={newSectionForm.name}
                              onChange={(e) => setNewSectionForm({ ...newSectionForm, name: e.target.value })}
                              placeholder="Nazwij tę sekcję"
                              className="w-full bg-transparent text-[14px] font-bold text-text-primary outline-none placeholder:text-text-muted/40"
                            />
                            <textarea
                              value={newSectionForm.notes}
                              onChange={(e) => setNewSectionForm({ ...newSectionForm, notes: e.target.value })}
                              rows={2}
                              placeholder="Dodaj opis"
                              className="w-full resize-none bg-transparent text-[12px] font-medium text-text-secondary outline-none placeholder:text-text-muted/40"
                            />
                            <div className="flex gap-2 justify-start mt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  run(async () => {
                                    if (newSectionForm.name.trim()) {
                                      await createTodoSection(userId, newSectionForm.name.trim());
                                      fetchAll();
                                    }
                                    setAddingSectionIndex(null);
                                  });
                                }}
                                disabled={!newSectionForm.name.trim()}
                                className="todoist-btn-primary"
                              >
                                Dodaj sekcję
                              </button>
                              <button
                                type="button"
                                onClick={() => setAddingSectionIndex(null)}
                                className="todoist-btn-secondary"
                              >
                                Anuluj
                              </button>
                            </div>
                          </div>
                        )}

                        <div
                          ref={el => { sectionRefs.current[sec.id] = el; }}
                          className={`rounded-2xl p-2 transition-all duration-200 ${
                            draggingItem !== null
                              ? dragTarget === sec.id
                                ? 'border border-primary/40 bg-primary/10 scale-[1.01] shadow-[0_4px_25px_rgba(99,102,241,0.12)]'
                                : 'border border-dashed border-primary/20 bg-primary/5'
                              : 'border border-transparent bg-transparent'
                          }`}
                        >
                          <BucketHeader
                            icon="📂"
                            title={sec.name}
                            count={sec.items.length}
                            collapsed={isCollapsed}
                            onToggle={() => toggleSectionCollapse(sec.id)}
                            isDropTarget={dragTarget === sec.id}
                            onRename={(name) => run(() => renameTodoSection(sec.id, name))}
                            onDelete={() => run(() => archiveTodoSection(sec.id))}
                          />
                          {!isCollapsed && (
                            <div className="pt-1">
                              {sec.items.length === 0 ? (
                                <div className={`mx-1 my-2 rounded-xl border border-dashed p-6 text-center transition-all duration-200 ${
                                  dragTarget === sec.id
                                    ? 'border-primary bg-primary/5 text-primary scale-[1.01] shadow-lg shadow-primary/5'
                                    : 'border-border-custom/25 text-text-muted/30 bg-surface-solid/10'
                                }`}>
                                  <span className="block text-[14px] mb-1">📂</span>
                                  <span className="text-[11px] font-bold tracking-wide">Upuść tutaj, aby przypisać do sekcji</span>
                                </div>
                              ) : (
                                sec.items.map((i: any) => renderCard(i, { hideSectionChip: true }))
                              )}
                              {renderInlineQuickCapture(sec.id)}
                              {renderAddTodoButton(sec.id)}
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })}

                  {/* Hover separator at the end */}
                  {sectionsWithItems.length > 0 && (
                    <div
                      onClick={() => {
                        setAddingSectionIndex(sectionsWithItems.length);
                        setNewSectionForm({ name: '', notes: '' });
                      }}
                      className="todoist-section-divider-line animate-fade-in"
                    />
                  )}
                  {addingSectionIndex === sectionsWithItems.length && (
                    <div className="border border-border-custom bg-surface-solid/40 rounded-2xl p-4.5 mb-3 flex flex-col gap-3 shadow-lg">
                      <input
                        autoFocus
                        value={newSectionForm.name}
                        onChange={(e) => setNewSectionForm({ ...newSectionForm, name: e.target.value })}
                        placeholder="Nazwij tę sekcję"
                        className="w-full bg-transparent text-[14px] font-bold text-text-primary outline-none placeholder:text-text-muted/40"
                      />
                      <textarea
                        value={newSectionForm.notes}
                        onChange={(e) => setNewSectionForm({ ...newSectionForm, notes: e.target.value })}
                        rows={2}
                        placeholder="Dodaj opis"
                        className="w-full resize-none bg-transparent text-[12px] font-medium text-text-secondary outline-none placeholder:text-text-muted/40"
                      />
                      <div className="flex gap-2 justify-start mt-1">
                        <button
                          type="button"
                          onClick={() => {
                            run(async () => {
                              if (newSectionForm.name.trim()) {
                                await createTodoSection(userId, newSectionForm.name.trim());
                                fetchAll();
                              }
                              setAddingSectionIndex(null);
                            });
                          }}
                          disabled={!newSectionForm.name.trim()}
                          className="todoist-btn-primary"
                        >
                          Dodaj sekcję
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddingSectionIndex(null)}
                          className="todoist-btn-secondary"
                        >
                          Anuluj
                        </button>
                      </div>
                    </div>
                  )}
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
                  <div className="pt-1 space-y-1">
                    {doneItems.slice(0, visibleDoneCount).map((i: any) => renderCard(i))}
                  </div>
                  {doneItems.length > visibleDoneCount && (
                    <div className="flex justify-center mt-3 mb-2">
                      <button
                        type="button"
                        onClick={() => setVisibleDoneCount(prev => prev + 30)}
                        className="px-4 py-2 rounded-xl border border-border-custom bg-surface hover:bg-surface-solid text-[10.5px] font-bold uppercase tracking-wider text-text-secondary transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                      >
                        Pokaż więcej ukończonych ({doneItems.length - visibleDoneCount} pozostało)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
        )}
      </div>

      {/* Desktop: today's calendar events panel */}
      <TodayEventsPanel userId={userId} today={today} />

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
        <button onClick={() => onNavigateTo?.('kalendarz')} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-text-muted active:bg-surface">
          <Calendar size={22} />
          <span className="text-[11px] font-semibold">Kalendarz</span>
        </button>
        <button onClick={() => onNavigateTo?.('links')} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-text-muted active:bg-surface">
          <BookOpen size={22} />
          <span className="text-[11px] font-semibold">Pocket</span>
        </button>
      </nav>

      {scanTextOpen && (
        <TodoScanTextModal
          userId={userId}
          sectionId={['today', 'inbox', 'upcoming', null].includes(activeAddSectionId) ? null : activeAddSectionId}
          onClose={() => setScanTextOpen(false)}
          onCreated={(created) => setItems((prev) => [...created, ...prev])}
        />
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-surface/95 border border-border-custom rounded-3xl p-6 shadow-2xl backdrop-blur-xl flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center ${
              confirmModal.isDanger 
                ? 'bg-rose-500/10 border border-rose-500/20 text-rose-500' 
                : 'bg-primary/10 border border-primary/20 text-primary'
            }`}>
              {confirmModal.isDanger ? <Trash2 size={20} /> : <Check size={20} />}
            </div>
            <div className="text-center">
              <h3 className="text-[15px] font-bold text-text-primary">{confirmModal.title}</h3>
              <p className="mt-1.5 text-[12px] text-text-secondary leading-relaxed px-1">
                {confirmModal.message}
              </p>
            </div>
            <div className="flex gap-2.5 mt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2 rounded-xl border border-border-custom hover:bg-text-primary/[0.04] text-[12px] font-bold transition-all cursor-pointer text-center text-text-secondary outline-none"
              >
                Anuluj
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className={`flex-1 py-2 rounded-xl text-white text-[12px] font-bold transition-all cursor-pointer text-center outline-none ${
                  confirmModal.isDanger ? 'bg-rose-500 hover:bg-rose-600' : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {confirmModal.confirmText || 'Potwierdź'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
