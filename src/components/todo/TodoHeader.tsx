import { Bell, ChevronLeft, Clock3, History, Kanban, LayoutGrid, ListTodo, PanelLeft } from 'lucide-react';
import { useTodoContext } from './context/TodoContext';

export type TodoViewMode = 'lista' | 'eisenhower' | 'kanban' | 'timeline';

interface TodoHeaderProps {
  onBack: () => void;
  todoView: TodoViewMode;
  setTodoView: (v: TodoViewMode) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
}

export default function TodoHeader({ onBack, todoView, setTodoView, sidebarCollapsed, setSidebarCollapsed }: TodoHeaderProps) {
  const { push, pushSubscribed, setPushSubscribed, showDone, setShowDone } = useTodoContext();

  return (
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
  );
}
