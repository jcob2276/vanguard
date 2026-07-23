import React from 'react';
import { PanelLeft } from 'lucide-react';
import { useSidebar } from './sidebarContextState';
import { Pressable } from '../ControlPrimitives';

export interface SidebarHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}
export function SidebarHeader({ children, className = '', ...props }: SidebarHeaderProps) {
  return (
    <div
      data-sidebar="header"
      className={`flex shrink-0 border-b border-border-custom/20 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export interface SidebarTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
}

export function SidebarTrigger({ className = '', icon, onClick, ...props }: SidebarTriggerProps) {
  const { toggleSidebar, state } = useSidebar();

  return (
    <Pressable
      variant="ghost"
      size="sm"
      aria-label="Przełącz panel boczny (Ctrl+B)"
      title={state === 'collapsed' ? 'Rozwiń panel boczny' : 'Zwiń panel boczny'}
      onClick={(e) => {
        if (onClick) {
          onClick(e);
        } else {
          toggleSidebar();
        }
      }}
      className={`h-8 w-8 p-0 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded-lg flex items-center justify-center transition-all ${className}`}
      {...props}
    >
      {icon || <PanelLeft size={16} className={`transition-transform duration-[var(--motion-medium)] ${state === 'collapsed' ? 'rotate-180 text-primary font-bold' : ''}`} />}
    </Pressable>
  );
}

export type SidebarRailProps = React.HTMLAttributes<HTMLButtonElement>;

export function SidebarRail({ className = '', onClick, ...props }: SidebarRailProps) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      data-sidebar="rail"
      aria-label="Zwiń / Rozwiń panel"
      tabIndex={-1}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) {
          toggleSidebar();
        }
      }}
      title="Zwiń / Rozwiń panel (Ctrl+B)"
      className={`absolute inset-y-0 right-0 z-[var(--z-popover)] hidden w-2 -translate-x-1/2 cursor-col-resize hover:after:bg-primary/50 transition-all after:absolute after:inset-y-0 after:left-1/2 after:w-[var(--ds-w-2px)] sm:flex ${className}`}
      {...props}
    />
  );
}
