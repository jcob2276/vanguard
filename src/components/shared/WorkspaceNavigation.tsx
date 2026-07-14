import { Pressable } from '../ui/ControlPrimitives';
import { BookOpen, Calendar, ListTodo, StickyNote } from 'lucide-react';

export type WorkspaceDestination = 'keep' | 'todo' | 'kalendarz' | 'links';

const ITEMS = [
  { id: 'keep', label: 'Notatki', icon: StickyNote },
  { id: 'todo', label: 'Zadania', icon: ListTodo },
  { id: 'kalendarz', label: 'Kalendarz', icon: Calendar },
  { id: 'links', label: 'Pocket', icon: BookOpen },
] satisfies { id: WorkspaceDestination; label: string; icon: typeof StickyNote }[];

interface WorkspaceNavigationProps {
  active: WorkspaceDestination;
  onNavigate?: (destination: WorkspaceDestination) => void;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

export default function WorkspaceNavigation({
  active,
  onNavigate,
  orientation = 'vertical',
  className = '',
}: WorkspaceNavigationProps) {
  const horizontal = orientation === 'horizontal';

  return (
    <nav
      aria-label="Workspace"
      className={`${horizontal ? 'flex w-full' : 'flex flex-col gap-0.5'} ${className}`}
    >
      {ITEMS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <Pressable
            key={id}
            variant="ghost"
            size="sm"
            onClick={() => onNavigate?.(id)}
            aria-current={isActive ? 'page' : undefined}
            className={horizontal
              ? `min-h-14 flex-1 flex-col gap-0.5 rounded-none px-1 py-2 text-xs ${isActive ? 'text-primary' : 'text-text-muted'}`
              : `w-full justify-start gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'nav-pill-active text-primary'
                    : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                }`
            }
            icon={<Icon size={horizontal ? 20 : 14} className={isActive ? 'text-primary' : 'text-text-muted/60'} />}
          >
            {label}
          </Pressable>
        );
      })}
    </nav>
  );
}
