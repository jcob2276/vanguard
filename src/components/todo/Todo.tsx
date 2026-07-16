import { useRef, useState } from 'react';

import DataStateNotice from '../core/DataStateNotice';
import { createTodoSection, renameTodoSection, archiveTodoSection } from '../../lib/todo/todo';
import DragGhost from './DragGhost';
import TodoSidebar, { type TodoNavDest } from './TodoSidebar';
import TodoScanTextModal from './TodoScanTextModal';
import EisenhowerMatrix from './EisenhowerMatrix';
import KanbanView from './KanbanView';
import TodayEventsPanel from './TodayEventsPanel';
import { useTodoData, type TodoItemRow } from './useTodoData';

import { TodoContext, useTodoContext } from './context/TodoContext';
import './todo.css';
import { useTodoQuickAdd } from './hooks/useTodoQuickAdd';
import TodoContextMenuConnected from './TodoContextMenuConnected';
import TodoHeader, { type TodoViewMode } from './TodoHeader';
import TodoSearchBar from './TodoSearchBar';
import TodoListView from './TodoListView';
import WorkspaceNavigation from '../shared/WorkspaceNavigation';

function TodoInner({ onBack, onNavigateTo }: { onBack: () => void; onNavigateTo?: (dest: string) => void }) {
  const todoData = useTodoContext();
  const {
    userId, loading,
    setExpandedId,
    activeFilterSection, setActiveFilterSection,
    quickCaptureRef,
    draggingItem, dragPosRef,
    today,
    run,
  } = todoData;

  const [todoView, setTodoView] = useState<TodoViewMode>('lista');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [navDest, setNavDest] = useState<TodoNavDest>('overview');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    activeAddSectionId, scanTextOpen, setScanTextOpen,
    renderInlineQuickCapture, renderAddTodoButton,
  } = useTodoQuickAdd();

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

      <TodoContextMenuConnected />

      <TodoSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        navDest={navDest}
        onNavDest={(d) => { setNavDest(d); setActiveFilterSection(null); }}
        inboxCount={todoData.inboxItems.length}
        todayCount={todoData.todayItems.length}
        upcomingCount={todoData.upcomingItems.length}
        sections={todoData.sections}
        activeSectionId={activeFilterSection}
        onSelectSection={(id) => { setNavDest('overview'); setActiveFilterSection(id); }}
        onAddSection={(name) => run(() => createTodoSection(userId, name))}
        onRenameSection={(id, name) => run(() => renameTodoSection(id, name))}
        onDeleteSection={(id) => { setActiveFilterSection(null); run(() => archiveTodoSection(id)); }}
        onQuickAdd={() => {
          todoData.setIsExpanded(true);
          quickCaptureRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => quickCaptureRef.current?.querySelector('input')?.focus(), 50);
        }}
        onFocusSearch={() => {
          searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          searchInputRef.current?.focus();
        }}
        onNavigateTo={onNavigateTo}
      />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <TodoHeader
          onBack={onBack}
          todoView={todoView}
          setTodoView={setTodoView}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          searchInputRef={searchInputRef}
        />

        <TodoSearchBar />

        {todoView === 'eisenhower' && (
          <main className="flex-1 overflow-y-auto" onClick={() => setExpandedId(null)}>
            <EisenhowerMatrix items={todoData.items} setItems={(fn) => todoData.setItems((prev) => fn(prev) as TodoItemRow[])} />
          </main>
        )}

        {todoView === 'kanban' && (
          <main className="flex-1 overflow-hidden">
            <KanbanView
              items={todoData.items}
              sections={todoData.sections}
              setItems={(fn) => todoData.setItems((prev) => fn(prev) as TodoItemRow[])}
              today={today}
            />
          </main>
        )}

        {todoView === 'lista' && (
          <TodoListView
            navDest={navDest}
            renderInlineQuickCapture={renderInlineQuickCapture}
            renderAddTodoButton={renderAddTodoButton}
          />
        )}
      </div>

      {/* Desktop: today's calendar events panel */}
      <TodayEventsPanel userId={userId} today={today} />

      {/* Mobile bottom nav */}
      <WorkspaceNavigation
        active="todo"
        orientation="horizontal"
        onNavigate={onNavigateTo}
        className="md:hidden fixed bottom-0 inset-x-0 z-[var(--z-overlay)] border-t border-border-custom bg-background/95 backdrop-blur-[var(--blur-xl)]"
      />

      {scanTextOpen && (
        <TodoScanTextModal
          userId={userId}
          sectionId={['today', 'inbox', 'upcoming', null].includes(activeAddSectionId) ? null : activeAddSectionId}
          onClose={() => setScanTextOpen(false)}
          onCreated={(created) => todoData.setItems((prev) => [...created, ...prev])}
        />
      )}
    </div>
  );
}

export default function Todo({ onBack, onNavigateTo }: { onBack: () => void; onNavigateTo?: (dest: string) => void }) {
  const todoData = useTodoData();
  return (
    <TodoContext.Provider value={todoData}>
      <TodoInner onBack={onBack} onNavigateTo={onNavigateTo} />
    </TodoContext.Provider>
  );
}
