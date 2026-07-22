import React from 'react';
import { useSidebar } from './SidebarContext';
import Skeleton from '../Skeleton';

export interface SidebarMenuActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  showOnHover?: boolean;
  children?: React.ReactNode;
}

export function SidebarMenuAction({
  showOnHover = true,
  children,
  className = '',
  ...props
}: SidebarMenuActionProps) {
  const { state, collapsible } = useSidebar();
  if (state === 'collapsed' && collapsible === 'icon') {
    return null;
  }

  return (
    <button
      data-sidebar="menu-action"
      className={`absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-3 transition-all duration-150 outline-none ${
        showOnHover ? 'opacity-0 group-hover/menu-item:opacity-100 group-focus-within/menu-item:opacity-100' : 'opacity-100'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export interface SidebarMenuSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  showIcon?: boolean;
}

export function SidebarMenuSkeleton({ showIcon = true, className = '', ...props }: SidebarMenuSkeletonProps) {
  const { state, collapsible } = useSidebar();
  const isCollapsedIcon = state === 'collapsed' && collapsible === 'icon';

  if (isCollapsedIcon) {
    return (
      <div className="flex items-center justify-center p-1.5">
        <Skeleton className="h-8 w-8 rounded-xl" />
      </div>
    );
  }

  return (
    <div
      data-sidebar="menu-skeleton"
      className={`flex items-center gap-2.5 px-2.5 py-2 ${className}`}
      {...props}
    >
      {showIcon && <Skeleton className="h-4 w-4 shrink-0 rounded-md" />}
      <Skeleton className="h-4 flex-1 rounded-md" />
    </div>
  );
}
