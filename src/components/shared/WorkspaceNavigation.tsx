import { Pressable } from '../ui/ControlPrimitives';
import { Bell, BookOpen, Calendar, ListTodo, StickyNote } from 'lucide-react';
import WorkspaceToolsLauncher from './WorkspaceToolsLauncher';
import { useSidebar } from '../ui/sidebar';

export type WorkspaceDestination = 'keep' | 'todo' | 'kalendarz' | 'links' | 'projekty' | 'terminy';

const ITEMS = [
  { id: 'keep', label: 'Notatki', icon: StickyNote },
  { id: 'todo', label: 'Zadania', icon: ListTodo },
  { id: 'kalendarz', label: 'Kalendarz', icon: Calendar },
  { id: 'terminy', label: 'Terminy', icon: Bell },
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

  let isCollapsedIcon = false;
  try {
    const sidebar = useSidebar();
    isCollapsedIcon = sidebar.state === 'collapsed' && sidebar.collapsible === 'icon';
  } catch {
    // Fallback if outside SidebarProvider
  }

  if (horizontal) {
    return (
      <nav aria-label="Narzędzia" className={`workspace-tools-nav flex ${className}`}>
        {primaryAction && (
          <Pressable
            onClick={primaryAction.onClick}
            className="workspace-primary-action min-h-11 slate-pill px-4 text-xs font-medium tracking-tight"
            aria-label={primaryAction.label}
          >
            <span className="text-sm leading-none">+</span>
            {primaryAction.label}
          </Pressable>
        )}
        <WorkspaceToolsLauncher active={active} onNavigate={(destination) => onNavigate?.(destination as WorkspaceDestination)} />
      </nav>
    );
  }

  if (isCollapsedIcon) {
    return (
      <nav aria-label="Workspace" className={`flex flex-col items-center gap-1.5 ${className}`}>
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <Pressable
              key={id}
              onClick={() => onNavigate?.(id)}
              aria-current={isActive ? 'page' : undefined}
              title={label}
              aria-label={label}
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                isActive
                  ? 'bg-primary/20 text-primary font-bold shadow-xs'
                  : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-primary' : 'text-text-muted/95'} />
            </Pressable>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Workspace" className={`flex flex-col gap-0.5 ${className}`}>
      {ITEMS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <Pressable
            key={id}
            variant="ghost"
            size="sm"
            onClick={() => onNavigate?.(id)}
            aria-current={isActive ? 'page' : undefined}
            className={`w-full justify-start gap-2.5 slate-nav px-3 py-2 text-xs font-medium tracking-tight ${
              isActive
                ? 'nav-pill-active text-primary font-medium'
                : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
            }`}
            icon={<Icon size={14} className={isActive ? 'text-primary' : 'text-text-muted/95'} />}
          >
            {label}
          </Pressable>
        );
      })}
    </nav>
  );
}
