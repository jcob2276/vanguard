import type { ReactNode } from 'react';
import ContentContainer from './ContentContainer';

export function ListPageTemplate({ children }: { children: ReactNode }) {
  return <main className="min-h-0 flex-1 overflow-y-auto"><ContentContainer width="default" className="grid gap-[var(--space-5)]">{children}</ContentContainer></main>;
}

export function GridPageTemplate({ children }: { children: ReactNode }) {
  return <main className="min-h-0 flex-1 overflow-y-auto"><ContentContainer width="wide" className="grid grid-cols-1 gap-[var(--space-4)] md:grid-cols-2 xl:grid-cols-3">{children}</ContentContainer></main>;
}

export function DashboardPageTemplate({ children }: { children: ReactNode }) {
  return <main className="min-h-0 flex-1 overflow-y-auto"><ContentContainer width="wide" className="grid grid-cols-12 gap-[var(--space-4)]">{children}</ContentContainer></main>;
}

export function TimelinePageTemplate({ children }: { children: ReactNode }) {
  return <main className="min-h-0 flex-1 overflow-auto bg-surface-1">{children}</main>;
}
