import { Shield, Wallet, Zap } from 'lucide-react';

export const SPHERE_SLOTS = [
  {
    category: 'cialo',
    label: 'Ciało',
    icon: Shield,
    text: 'text-success dark:text-success',
    bg: 'bg-success/10',
    border: 'border-success/20',
    placeholder: 'Priorytet Ciało — co dziś?',
  },
  {
    category: 'duch',
    label: 'Duch',
    icon: Zap,
    text: 'text-primary dark:text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
    placeholder: 'Priorytet Duch — co dziś?',
  },
  {
    category: 'konto',
    label: 'Konto',
    icon: Wallet,
    text: 'text-warning dark:text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/20',
    placeholder: 'Priorytet Konto — co dziś?',
  },
];

export const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-success',
  normal: 'bg-info',
  high: 'bg-primary',
  urgent: 'bg-danger',
};
