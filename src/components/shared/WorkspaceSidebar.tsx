import { Pressable } from '../ui/ControlPrimitives';
import type { ReactNode } from 'react';
import { PanelLeft } from 'lucide-react';

interface WorkspaceSidebarProps {
  children: ReactNode;
  collapsed?: boolean;
  className?: string;
  onCollapse?: () => void;
}

export default function WorkspaceSidebar({ children, collapsed = false, className = '', onCollapse }: WorkspaceSidebarProps) {
  return (
    <>
      <aside
        className={`relative hidden w-[var(--sidebar-width)] shrink-0 flex-col overflow-y-auto border-r border-border-custom/30 bg-surface-1 px-[var(--space-3)] py-[var(--space-3)] transition-[width,padding,border-color] duration-[var(--motion-medium)] ease-[var(--spring)] md:flex glass-structural ${
          collapsed ? '!w-0 overflow-hidden !border-r-0 !px-0 !py-0' : ''
        } ${className}`}
      >
        {onCollapse && (
          <div className="absolute right-[var(--space-3)] top-[var(--space-3)] z-[var(--z-raised)] flex h-8 items-center justify-end">
            <Pressable variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onCollapse} aria-label="Zwiń panel boczny">
              <PanelLeft size={14} />
            </Pressable>
          </div>
        )}
        {children}
      </aside>
      {collapsed && onCollapse && (
        <Pressable
          onClick={onCollapse}
          aria-label="Rozwiń panel boczny"
          className="hidden md:flex fixed left-0 top-[var(--space-3)] z-[var(--z-overlay)] h-9 w-6 items-center justify-center rounded-r-lg bg-surface-1 border border-l-0 border-border-custom/30 text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors duration-[var(--motion-fast)] shadow-sm"
        >
          <PanelLeft size={13} className="rotate-180" />
        </Pressable>
      )}
    </>
  );
}

