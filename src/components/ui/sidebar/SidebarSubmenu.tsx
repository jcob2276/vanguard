import React from 'react';
import { useSidebar } from './SidebarContext';

export interface SidebarMenuSubProps extends React.HTMLAttributes<HTMLUListElement> {
  children?: React.ReactNode;
}

export function SidebarMenuSub({ children, className = '', ...props }: SidebarMenuSubProps) {
  const { state, collapsible } = useSidebar();
  if (state === 'collapsed' && collapsible === 'icon') {
    return null;
  }

  return (
    <ul
      data-sidebar="menu-sub"
      className={`ml-4 flex flex-col gap-1 border-l border-border-custom/30 pl-2.5 my-1 min-w-0 ${className}`}
      {...props}
    >
      {children}
    </ul>
  );
}

export interface SidebarMenuSubItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  children?: React.ReactNode;
}

export function SidebarMenuSubItem({ children, className = '', ...props }: SidebarMenuSubItemProps) {
  return (
    <li data-sidebar="menu-sub-item" className={`group/sub-item relative list-none ${className}`} {...props}>
      {children}
    </li>
  );
}

export interface SidebarMenuSubButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export function SidebarMenuSubButton({
  isActive = false,
  icon,
  children,
  className = '',
  ...props
}: SidebarMenuSubButtonProps) {
  return (
    <button
      data-sidebar="menu-sub-button"
      data-active={isActive}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs font-medium transition-colors outline-none ${
        isActive
          ? 'text-primary font-bold bg-primary/10'
          : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
      } ${className}`}
      {...props}
    >
      {icon ? icon : <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-primary' : 'bg-text-muted/40'}`} />}
      <span className="truncate flex-1">{children}</span>
    </button>
  );
}
