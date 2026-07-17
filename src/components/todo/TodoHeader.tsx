import { Pressable } from '../ui/ControlPrimitives';
import { Bell, Kanban, LayoutGrid, ListTodo, PanelLeft } from 'lucide-react';
import { WorkspaceHeader } from '../shared/WorkspaceHeader';
import { useTodoContext } from './context/TodoContext';

export type TodoViewMode = 'lista' | 'eisenhower' | 'kanban';

const VIEW_TABS = [
  { key: 'lista', label: 'Lista', icon: <ListTodo size={14} /> },
  { key: 'eisenhower', label: 'Macierz', icon: <LayoutGrid size={14} /> },
  { key: 'kanban', label: 'Kanban', icon: <Kanban size={14} /> },
];

interface TodoHeaderProps {
  onBack: () => void;
  todoView: TodoViewMode;
  setTodoView: (value: TodoViewMode) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (value: boolean) => void;
}

export default function TodoHeader({ onBack, todoView, setTodoView, sidebarCollapsed, setSidebarCollapsed }: TodoHeaderProps) {
  const { push, pushSubscribed, setPushSubscribed } = useTodoContext();

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
        actions={
          <>
            {push.isSupported && pushSubscribed === false && (
              <Pressable variant="tonal" size="sm" onClick={async () => { const ok = await push.subscribe(); if (ok) setPushSubscribed(true); }} icon={<Bell size={12} />} className="flex">
                Powiadomienia
              </Pressable>
            )}
          </>
        }
        tabs={{ items: VIEW_TABS, active: todoView, onChange: (key) => setTodoView(key as TodoViewMode) }}
      />
    </>
  );
}
