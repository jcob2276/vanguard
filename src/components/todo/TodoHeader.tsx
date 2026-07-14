import { Pressable } from '../ui/ControlPrimitives';
import type { RefObject } from 'react';
import { Bell, Clock3, History, Kanban, LayoutGrid, ListTodo, PanelLeft } from 'lucide-react';
import { WorkspaceHeader } from '../shared/WorkspaceHeader';
import { useTodoContext } from './context/TodoContext';

export type TodoViewMode = 'lista' | 'eisenhower' | 'kanban' | 'timeline';

const VIEW_TABS = [
  { key: 'lista', label: 'Lista', icon: <ListTodo size={14} /> },
  { key: 'eisenhower', label: 'Macierz', icon: <LayoutGrid size={14} /> },
  { key: 'kanban', label: 'Kanban', icon: <Kanban size={14} /> },
  { key: 'timeline', label: 'Oś czasu', icon: <Clock3 size={14} /> },
];

interface TodoHeaderProps {
  onBack: () => void;
  todoView: TodoViewMode;
  setTodoView: (value: TodoViewMode) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (value: boolean) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
}

export default function TodoHeader({ onBack, todoView, setTodoView, sidebarCollapsed, setSidebarCollapsed, searchInputRef }: TodoHeaderProps) {
  const { push, pushSubscribed, setPushSubscribed, showDone, setShowDone, searchQuery, setSearchQuery, setActiveSmartListId } = useTodoContext();

  return (
    <>
      <WorkspaceHeader
        title="Zadania"
        onBack={onBack}
        leading={sidebarCollapsed && (
          <Pressable variant="ghost" size="sm" onClick={() => setSidebarCollapsed(false)} aria-label="Rozwiń panel boczny">
            <PanelLeft size={16} />
          </Pressable>
        )}
        search={{
          value: searchQuery,
          onChange: (value) => { setSearchQuery(value); if (value) setActiveSmartListId(null); },
          placeholder: 'Szukaj zadań…',
          inputRef: searchInputRef,
        }}
        actions={
          <>
            {push.isSupported && pushSubscribed === false && (
              <Pressable variant="tonal" size="sm" onClick={async () => { const ok = await push.subscribe(); if (ok) setPushSubscribed(true); }} icon={<Bell size={12} />} className="hidden lg:flex">
                Powiadomienia
              </Pressable>
            )}
            <Pressable variant="ghost" size="sm" onClick={() => setShowDone((value) => !value)} className={showDone ? 'bg-primary/10 text-primary' : ''} aria-label="Historia">
              <History size={17} />
            </Pressable>
          </>
        }
        tabs={{ items: VIEW_TABS, active: todoView, onChange: (key) => setTodoView(key as TodoViewMode) }}
      />
    </>
  );
}
