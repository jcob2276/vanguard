import { Shield, Wallet, Zap } from 'lucide-react';

export const SPHERE_SLOTS = [
  {
    category: 'cialo',
    label: 'Ciało',
    icon: Shield,
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    placeholder: 'Priorytet Ciało — co dziś?',
  },
  {
    category: 'duch',
    label: 'Duch',
    icon: Zap,
    text: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
    placeholder: 'Priorytet Duch — co dziś?',
  },
  {
    category: 'konto',
    label: 'Konto',
    icon: Wallet,
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    placeholder: 'Priorytet Konto — co dziś?',
  },
];

export const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-emerald-500',
  normal: 'bg-blue-500',
  high: 'bg-indigo-500',
  urgent: 'bg-rose-500',
};
