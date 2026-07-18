import { Pressable } from '../ui/ControlPrimitives';
import { BookOpen, Calendar, ListTodo, StickyNote } from 'lucide-react';
import WorkspaceToolsLauncher from './WorkspaceToolsLauncher';

export type WorkspaceDestination = 'keep' | 'todo' | 'kalendarz' | 'links' | 'projekty';

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
  primaryAction?: { label: string; onClick: () => void };
}

export default function WorkspaceNavigation({
  active,
  onNavigate,
  orientation = 'vertical',
  className = '',
  primaryAction,
}: WorkspaceNavigationProps) {
  const horizontal = orientation === 'horizontal';

  if (horizontal) {
    return (
      <nav aria-label="Narzędzia" className={`workspace-tools-nav flex ${className}`}>
        {primaryAction && (
          <Pressable
            onClick={primaryAction.onClick}
            className="workspace-primary-action min-h-12 rounded-full px-5 text-sm font-bold"
            aria-label={primaryAction.label}
          >
            <span className="text-lg leading-none">+</span>
            {primaryAction.label}
          </Pressable>
        )}
        <WorkspaceToolsLauncher active={active} onNavigate={destination => onNavigate?.(destination as WorkspaceDestination)} />
      </nav>
    );
  }

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
              ? `min-h-14 flex-1 flex-col gap-0.5 rounded-none px-1 py-2 text-xs ${isActive ? 'text-primary' : 'text-text-secondary'}`
              : `w-full justify-start gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm font-semibold ${
                  isActive
                    ? 'nav-pill-active text-primary'
                    : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                }`
            }
            icon={<Icon size={horizontal ? 20 : 14} className={isActive ? 'text-primary' : 'text-text-muted/95'} />}
          >
            {label}
          </Pressable>
        );
      })}
    </nav>
  );
}
