import { createContext, useContext } from 'react';

export type SidebarState = 'expanded' | 'collapsed';
export type SidebarCollapsible = 'offcanvas' | 'icon' | 'none';
export type SidebarVariant = 'sidebar' | 'floating' | 'inset';

export interface SidebarContextValue {
  state: SidebarState;
  open: boolean;
  setOpen: (open: boolean | ((previous: boolean) => boolean)) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean | ((previous: boolean) => boolean)) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
  collapsible: SidebarCollapsible;
  variant: SidebarVariant;
}

export const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error('useSidebar must be used within a SidebarProvider.');
  return context;
}
