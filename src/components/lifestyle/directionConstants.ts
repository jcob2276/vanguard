export const DAYS_PL = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];

export const SENTIMENTS = [
  { value: 'bad', label: 'Słabo' },
  { value: 'ok', label: 'Okej' },
  { value: 'good', label: 'Dobrze' },
  { value: 'excellent', label: 'Wygrany' },
];

export const GOAL_CHIP: Record<string, { label: string; chip: string }> = {
  goal_cialo: { label: 'Ciało', chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  goal_duch:  { label: 'Duch',  chip: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'   },
  goal_konto: { label: 'Konto', chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400'       },
};
