import { Shield, Zap, Wallet } from 'lucide-react';

export const COLORS = [
  { id: 'indigo',  dot: 'bg-indigo-500',  bar: 'bg-indigo-500',  text: 'text-indigo-600 dark:text-indigo-400'  },
  { id: 'violet',  dot: 'bg-violet-500',  bar: 'bg-violet-500',  text: 'text-violet-600 dark:text-violet-400'  },
  { id: 'sky',     dot: 'bg-sky-500',     bar: 'bg-sky-500',     text: 'text-sky-600 dark:text-sky-400'        },
  { id: 'emerald', dot: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400'},
  { id: 'amber',   dot: 'bg-amber-500',   bar: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400'    },
  { id: 'rose',    dot: 'bg-rose-500',    bar: 'bg-rose-500',    text: 'text-rose-600 dark:text-rose-400'      },
];

export const colorOf = (id: string) => COLORS.find(c => c.id === id) ?? COLORS[0];

export const PILLAR_META = {
  cialo: { label: 'Ciało', icon: Shield, text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-500', color: 'emerald' },
  duch:  { label: 'Duch',  icon: Zap,    text: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30',  dot: 'bg-indigo-500',  color: 'indigo' },
  konto: { label: 'Konto', icon: Wallet, text: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   dot: 'bg-amber-500',   color: 'amber'  },
} as const;

export const GOAL_QUESTIONS = [
  { key: 'goal',           q: 'Jaki jest Twój cel?',               hint: 'Konkretny wynik + data. Np. "50k PLN na koncie do 01.10.2026"' },
  { key: 'why',            q: 'Po co Ci to?',                      hint: 'Dlaczego to ważne? Co się zmieni kiedy osiągniesz?' },
  { key: 'milestones',     q: 'Co musi się stać po drodze?',       hint: 'Wymień 3–4 etapy które musisz przejść' },
  { key: 'blockers',       q: 'Dlaczego może się nie udać?',       hint: 'Jakie są ryzyka? Co już próbowałeś i nie wyszło?' },
  { key: 'weekly_actions', q: 'Co robisz co tydzień żeby to osiągnąć?', hint: 'Konkretne powtarzalne działania — to będą Twoje KPI' },
] as const;

export const STATUS_TABS = [
  { id: 'active', label: 'Aktywne' },
  { id: 'paused', label: 'Pauza' },
  { id: 'done',   label: 'Gotowe' },
] as const;

export const STATUS_NEXT: Record<string, string> = { active: 'paused', paused: 'done', done: 'active' };
export const STATUS_LABEL: Record<string, string> = { active: 'Aktywny', paused: 'Pauza', done: 'Ukończony' };

export const PILLARS = ['cialo', 'duch', 'konto'] as const;
export type PillarId = typeof PILLARS[number];
