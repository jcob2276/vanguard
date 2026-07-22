import React from 'react';
import { useSidebar } from './SidebarContext';

export interface SidebarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function SidebarGroup({ children, className = '', ...props }: SidebarGroupProps) {
  return (
    <div
      data-sidebar="group"
      className={`relative flex w-full min-w-0 flex-col py-1 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export interface SidebarGroupLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function SidebarGroupLabel({ children, className = '', ...props }: SidebarGroupLabelProps) {
  const { state, collapsible } = useSidebar();
  const isCollapsedIcon = state === 'collapsed' && collapsible === 'icon';

  if (isCollapsedIcon) {
    return <div className="h-2 w-full" aria-hidden="true" />;
  }

  return (
    <div
      data-sidebar="group-label"
      className={`flex h-7 shrink-0 items-center px-2.5 text-xs font-black uppercase tracking-wider text-text-muted/60 font-display transition-opacity duration-150 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export interface SidebarGroupActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

export function SidebarGroupAction({ children, className = '', ...props }: SidebarGroupActionProps) {
  const { state, collapsible } = useSidebar();
  if (state === 'collapsed' && collapsible === 'icon') return null;

  return (
    <button
      data-sidebar="group-action"
      className={`absolute right-2 top-1.5 flex h-5 w-5 items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export interface SidebarGroupContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function SidebarGroupContent({ children, className = '', ...props }: SidebarGroupContentProps) {
  return (
    <div data-sidebar="group-content" className={`w-full text-sm ${className}`} {...props}>
      {children}
    </div>
  );
}

export interface SidebarMenuProps extends React.HTMLAttributes<HTMLUListElement> {
  children?: React.ReactNode;
}

export function SidebarMenu({ children, className = '', ...props }: SidebarMenuProps) {
  return (
    <ul data-sidebar="menu" className={`flex w-full min-w-0 flex-col gap-1 ${className}`} {...props}>
      {children}
    </ul>
  );
}

export interface SidebarMenuItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  children?: React.ReactNode;
}

export function SidebarMenuItem({ children, className = '', ...props }: SidebarMenuItemProps) {
  return (
    <li data-sidebar="menu-item" className={`group/menu-item relative list-none ${className}`} {...props}>
      {children}
    </li>
  );
}

export interface SidebarMenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean;
  tooltip?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export function SidebarMenuButton({
  isActive = false,
  tooltip,
  icon,
  children,
  className = '',
  ...props
}: SidebarMenuButtonProps) {
  const { state, collapsible } = useSidebar();
  const isCollapsedIcon = state === 'collapsed' && collapsible === 'icon';

  const labelText = typeof children === 'string' ? children : tooltip;

  return (
    <button
      data-sidebar="menu-button"
      data-active={isActive}
      title={isCollapsedIcon ? labelText : undefined}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm font-medium transition-all duration-150 outline-none
        ${
          isActive
            ? 'bg-primary/10 text-primary font-semibold shadow-xs'
            : 'text-text-muted hover:bg-surface-2 hover:text-text-primary active:bg-surface-3'
        }
        ${isCollapsedIcon ? 'justify-center !px-0 !w-10 !h-10 mx-auto' : ''}
        ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0 text-current">{icon}</span>}
      {!isCollapsedIcon && <span className="truncate flex-1">{children}</span>}
    </button>
  );
}

export interface SidebarMenuBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function SidebarMenuBadge({ children, className = '', ...props }: SidebarMenuBadgeProps) {
  const { state, collapsible } = useSidebar();
  const isCollapsedIcon = state === 'collapsed' && collapsible === 'icon';

  if (isCollapsedIcon) {
    return <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />;
  }

  return (
    <div
      data-sidebar="menu-badge"
      className={`ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-surface-3 px-1.5 text-[11px] font-bold text-text-muted ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
