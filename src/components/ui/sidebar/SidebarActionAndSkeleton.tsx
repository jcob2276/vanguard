import React from 'react';
import { useSidebar } from './sidebarContextState';
import Skeleton from '../Skeleton';

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
