import React from 'react';
import { PanelLeft } from 'lucide-react';
import { useSidebar } from './SidebarContext';
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

export interface SidebarFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function SidebarFooter({ children, className = '', ...props }: SidebarFooterProps) {
  return (
    <div
      data-sidebar="footer"
      className={`flex flex-col gap-2 p-[var(--space-3)] shrink-0 border-t border-border-custom/20 mt-auto ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export interface SidebarContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function SidebarContent({ children, className = '', ...props }: SidebarContentProps) {
  return (
    <div
      data-sidebar="content"
      className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden p-[var(--space-3)] scrollbar-thin ${className}`}
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
      title="Przełącz panel boczny (Ctrl+B)"
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) {
          toggleSidebar();
        }
      }}
      className={`h-8 w-8 p-0 text-text-muted hover:text-text-primary transition-colors ${className}`}
      {...props}
    >
      {icon || <PanelLeft size={16} className={`transition-transform duration-200 ${state === 'collapsed' ? 'rotate-180' : ''}`} />}
    </Pressable>
  );
}

export interface SidebarRailProps extends React.HTMLAttributes<HTMLButtonElement> {}

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
      className={`absolute inset-y-0 right-0 z-20 hidden w-2 -translate-x-1/2 cursor-col-resize hover:after:bg-primary/50 transition-all after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex ${className}`}
      {...props}
    />
  );
}

export interface SidebarInsetProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function SidebarInset({ children, className = '', ...props }: SidebarInsetProps) {
  const { variant } = useSidebar();

  const insetStyles =
    variant === 'inset'
      ? 'md:my-2 md:mr-2 md:rounded-2xl border border-border-custom/30 bg-surface-base shadow-sm overflow-hidden'
      : '';

  return (
    <main
      data-sidebar="inset"
      className={`relative flex min-h-svh flex-1 flex-col bg-surface-base transition-[margin,border-radius] duration-200 ease-in-out ${insetStyles} ${className}`}
      {...props}
    >
      {children}
    </main>
  );
}
