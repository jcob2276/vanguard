import { Shield, Zap, Wallet } from 'lucide-react';

export const PILLARS = [
  {
    id: 'cialo',
    label: 'Ciało',
    icon: Shield,
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/8',
    border: 'border-emerald-500/20',
    chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'duch',
    label: 'Duch',
    icon: Zap,
    text: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-500/8',
    border: 'border-indigo-500/20',
    chip: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'konto',
    label: 'Konto',
    icon: Wallet,
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/8',
    border: 'border-amber-500/20',
    chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
] as const;

export type PillarId = typeof PILLARS[number]['id'];

export const PILLAR_BRIEF_KEYS: Record<string, string> = {
  cialo: 'cialo',
  duch: 'duch',
  konto: 'konto',
};

export function getWeekStart(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  return mon.toLocaleDateString('en-CA');
}

export function getPrevWeekStart(ws: string): string {
  const d = new Date(ws + 'T00:00:00');
  d.setDate(d.getDate() - 7);
  return d.toLocaleDateString('en-CA');
}

export function getPastWeekStarts(current: string, n: number): string[] {
  const result: string[] = [];
  const d = new Date(current + 'T00:00:00');
  for (let i = 0; i < n; i++) {
    result.unshift(d.toLocaleDateString('en-CA'));
    d.setDate(d.getDate() - 7);
  }
  return result;
}

export function formatWeek(ws: string): string {
  const d = new Date(ws + 'T00:00:00');
  const sun = new Date(d);
  sun.setDate(d.getDate() + 6);
  const fmt = (x: Date) => x.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  return `${fmt(d)} – ${fmt(sun)}`;
}

export interface Kpi {
  id: string;
  pillar: string;
  name: string;
  unit: string;
  higher_is_better: boolean;
  sort_order: number;
  target: number | null;
}
