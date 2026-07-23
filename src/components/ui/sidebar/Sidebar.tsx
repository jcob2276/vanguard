import React from 'react';
import { useSidebar } from './sidebarContextState';
import Sheet from '../Sheet';

export interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'left' | 'right';
  children?: React.ReactNode;
  mobileTitle?: React.ReactNode;
}

export function Sidebar({
  side = 'left',
  children,
  className = '',
  mobileTitle = 'Nawigacja',
  style,
  ...props
}: SidebarProps) {
  const { openMobile, setOpenMobile, isMobile, state, collapsible, variant } = useSidebar();

  // Mobile Drawer view using existing Sheet primitive
  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} title={mobileTitle} side={side}>
        <div className="flex h-full w-full flex-col">{children}</div>
      </Sheet>
    );
  }

  // Width calculations based on state & collapsible mode
  const widthClass =
    state === 'collapsed'
      ? collapsible === 'icon'
        ? 'w-16 px-1'
        : 'w-0 overflow-hidden px-0 py-0 border-r-0'
      : 'w-64 px-2';

  const variantClass =
    variant === 'floating'
      ? 'm-2 rounded-2xl border border-border-custom/30 shadow-md bg-surface-1/90 backdrop-blur-[var(--blur-material)]'
      : variant === 'inset'
      ? 'bg-transparent border-r-0'
      : 'border-r border-border-custom/30 bg-surface-1/95 backdrop-blur-[var(--blur-subtle)]';

  return (
    <aside
      data-sidebar="sidebar"
      data-state={state}
      data-side={side}
      data-collapsible={collapsible}
      data-variant={variant}
      className={`relative hidden h-svh shrink-0 flex-col overflow-y-auto py-3 transition-[width,padding,margin,border-color] duration-[var(--motion-medium)] ease-[var(--ease-in-out)] md:flex ${widthClass} ${variantClass} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </aside>
  );
}
