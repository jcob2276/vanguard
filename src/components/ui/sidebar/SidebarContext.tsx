import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

export type SidebarState = 'expanded' | 'collapsed';
export type SidebarCollapsible = 'offcanvas' | 'icon' | 'none';
export type SidebarVariant = 'sidebar' | 'floating' | 'inset';

export interface SidebarContextValue {
  state: SidebarState;
  open: boolean;
  setOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean | ((prev: boolean) => boolean)) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
  collapsible: SidebarCollapsible;
  variant: SidebarVariant;
}

const SIDEBAR_KEYBOARD_SHORTCUT = 'b';
const STORAGE_KEY = 'vanguard:sidebar:state';
const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider.');
  }
  return context;
}

export interface SidebarProviderProps {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  collapsible?: SidebarCollapsible;
  variant?: SidebarVariant;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  collapsible = 'icon',
  variant = 'sidebar',
  children,
}: SidebarProviderProps) {
  const [internalOpen, setInternalOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'expanded') return true;
      if (saved === 'collapsed') return false;
    } catch {
      // localStorage disabled or SSR fallback
    }
    return defaultOpen;
  });

  const [openMobile, setOpenMobile] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const setOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const openState = typeof value === 'function' ? value(open) : value;
      if (setOpenProp) {
        setOpenProp(openState);
      }
      if (!isControlled) {
        setInternalOpen(openState);
        try {
          localStorage.setItem(STORAGE_KEY, openState ? 'expanded' : 'collapsed');
        } catch {
          // localStorage disabled
        }
      }
    },
    [isControlled, open, setOpenProp]
  );

  // Responsive mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setOpenMobile((prev) => !prev);
    } else {
      setOpen((prev) => !prev);
    }
  }, [isMobile, setOpen]);

  // Global Ctrl+B / Cmd+B keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === SIDEBAR_KEYBOARD_SHORTCUT) {
        const activeEl = document.activeElement;
        const isInputField =
          activeEl instanceof HTMLInputElement ||
          activeEl instanceof HTMLTextAreaElement ||
          activeEl?.getAttribute('contenteditable') === 'true';

        if (!isInputField) {
          event.preventDefault();
          toggleSidebar();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  const state: SidebarState = open ? 'expanded' : 'collapsed';

  const contextValue = useMemo<SidebarContextValue>(
    () => ({
      state,
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      isMobile,
      toggleSidebar,
      collapsible,
      variant,
    }),
    [state, open, setOpen, openMobile, isMobile, toggleSidebar, collapsible, variant]
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  );
}
