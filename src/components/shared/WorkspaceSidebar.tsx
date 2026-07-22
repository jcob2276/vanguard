import type { ReactNode } from 'react';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarTrigger, SidebarRail } from '../ui/sidebar';

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
        <SidebarHeader className={`flex items-center py-2 px-3 border-b border-border-custom/20 mb-1.5 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <span className="pixel-label text-text-muted/60 tracking-wider">Workspace</span>
          )}
          {onCollapse && (
            <SidebarTrigger onClick={onCollapse} className="hover:bg-surface-2 rounded-lg" />
          )}
        </SidebarHeader>
        {children}
        <SidebarRail />
      </Sidebar>
    </SidebarProvider>
  );
}
