import { useState } from 'react';
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
} from 'lucide-react';

import DataStateNotice from '../core/DataStateNotice';
import {
  archiveTodoSection,
  createTodoSection,
  renameTodoSection,
  setTodoStatus,
  updateTodoItem,
} from '../../lib/todo';
import ContextMenu from './ContextMenu';
import DragGhost from './DragGhost';
import BucketHeader from './BucketHeader';
import TodoCard from './TodoCard';
import SectionTabs from './SectionTabs';
import TodoQuickCapture from './TodoQuickCapture';
import EisenhowerMatrix from './EisenhowerMatrix';
import KanbanView from './KanbanView';
import { useTodoData } from './useTodoData';

export default function Todo({ session, onBack, onNavigateTo }: { session: any; onBack: () => void; onNavigateTo?: (dest: string) => void }) {
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
    todayItems, inboxItems, sectionsWithItems,
    run, addItem,
    toggleSubtask, addSubtask, deleteSubtask, saveEditTitle,
    handleDragStart, showContextMenu, handleComplete,
  } = useTodoData({ session, onNavigateTo });

  const [todoView, setTodoView] = useState<'lista' | 'eisenhower' | 'kanban'>('lista');

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

        {todoView === 'lista' && (
        <main
          className="flex-1 overflow-y-auto"
          onClick={() => setExpandedId(null)}
        >
          <div className="max-w-[600px] mx-auto space-y-4 px-6 py-5 pb-24">
            {error && <DataStateNotice tone="warning" title="Błąd" detail={error} />}

            {/* Quick capture */}
            <TodoQuickCapture
              quickCaptureRef={quickCaptureRef}
              form={form}
              setForm={setForm}
              isExpanded={isExpanded}
              setIsExpanded={setIsExpanded}
              busy={busy}
              addItem={addItem}
              sections={sections}
              parsedInput={parsedInput}
              today={today}
            />

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
            <div className="space-y-4">
              {activeFilterSection ? (
                // Active Section View
                (() => {
                  const sec = sectionsWithItems.find(s => s.id === activeFilterSection);
                  if (!sec) return null;
                  const sortedItems = sec.items;

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
                          <div className="mx-1 my-2 rounded-xl border border-dashed border-border-custom/25 p-6 text-center text-text-muted/30 bg-surface-solid/10">
                            <span className="block text-[14px] mb-1">📂</span>
                            <span className="text-[11px] font-bold tracking-wide">Brak otwartych zadań w tej sekcji.</span>
                          </div>
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
                            todayItems.map((i: any) => renderCard(i, { inToday: true }))
                          )}
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
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. Sections */}
                  {sectionsWithItems.map((sec) => {
                    const isCollapsed = !!collapsedSections[sec.id];
                    const hasItems = sec.items.length > 0;
                    if (!hasItems && draggingItem === null) return null;

                    return (
                      <div
                        key={sec.id}
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
        )}
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
