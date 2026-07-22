import type { ReactNode } from 'react';
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarRail } from '../ui/sidebar';

export interface WorkspaceSidebarProps {
  children: ReactNode;
  collapsed?: boolean;
  className?: string;
  onCollapse?: () => void;
  collapsible?: 'offcanvas' | 'icon' | 'none';
  variant?: 'sidebar' | 'floating' | 'inset';
}

export default function WorkspaceSidebar({
  children,
  collapsed = false,
  className = '',
  onCollapse,
  collapsible = 'icon',
  variant = 'sidebar',
}: WorkspaceSidebarProps) {
  return (
    <SidebarProvider
      open={!collapsed}
      onOpenChange={(openState) => {
        if (!openState && !collapsed && onCollapse) {
          onCollapse();
        } else if (openState && collapsed && onCollapse) {
          onCollapse();
        }
      }}
      collapsible={collapsible}
      variant={variant}
    >
      <Sidebar className={className}>
        {onCollapse && (
          <div className="absolute right-2 top-2 z-[var(--z-raised)] flex h-8 items-center justify-end">
            <SidebarTrigger onClick={onCollapse} />
          </div>
        )}
        {children}
        <SidebarRail />
      </Sidebar>
    </SidebarProvider>
  );
}
