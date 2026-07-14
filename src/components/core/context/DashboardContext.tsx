import { createContext, useContext } from 'react';
import type { useDashboardState } from '../hooks/useDashboardState';

export type DashboardContextType = ReturnType<typeof useDashboardState>;

export const DashboardContext = createContext<DashboardContextType | null>(null);

export function useDashboardContext() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboardContext must be used within a DashboardProvider');
  }
  return context;
}
