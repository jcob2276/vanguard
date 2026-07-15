import { Pressable } from '../ui/ControlPrimitives';
import type { ReactNode } from 'react';
import { Bell, ChevronDown, PanelLeft } from 'lucide-react';

interface WorkspaceSidebarProps {
  children: ReactNode;
  collapsed?: boolean;
  className?: string;
  onCollapse?: () => void;
}

export default function WorkspaceSidebar({ children, collapsed = false, className = '', onCollapse }: WorkspaceSidebarProps) {
  return (
    <aside
      className={`hidden w-[var(--sidebar-width)] shrink-0 flex-col overflow-y-auto border-r border-border-custom/30 bg-surface-1 px-[var(--space-3)] py-[var(--space-3)] transition-[width,padding,border-color] duration-[var(--motion-medium)] ease-[var(--spring)] md:flex glass-structural ${
        collapsed ? '!w-0 overflow-hidden !border-r-0 !px-0 !py-0' : ''
      } ${className}`}
    >
      <div className="mb-3 flex h-9 shrink-0 items-center justify-between px-1">
        <div className="flex min-w-0 items-center gap-2 rounded-xl px-1.5 py-1">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-black text-primary">K</div>
          <span className="truncate text-sm font-bold text-text-primary">Kuba</span>
          <ChevronDown size={12} className="text-text-muted/60" />
        </div>
        <div className="flex items-center gap-0.5">
          <Pressable variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Powiadomienia"><Bell size={14} /></Pressable>
          {onCollapse && <Pressable variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onCollapse} aria-label="Zwiń panel boczny"><PanelLeft size={14} /></Pressable>}
        </div>
      </div>
      {children}
    </aside>
  );
}
