// VitalBands: color tile by z-score vs personal EWMA baseline (Strand VitalBands.swift)
export function zToVitalColor(z: number | null | undefined, defaultColor: string): string {
  if (z == null) return defaultColor;
  if (z >= 1.0)        return 'text-emerald-500 dark:text-emerald-400';
  if (z >= -1.0)       return defaultColor;
  if (z >= -2.0)       return 'text-amber-500 dark:text-amber-400';
  return 'text-rose-500 dark:text-rose-400';
}

export const CONF_PILL = {
  solid:       'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  building:    'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  calibrating: 'bg-surface-solid text-text-muted border border-border-custom',
};

export const SIGNAL_PILL: Record<string, string> = {
  good:    'border-emerald-500/30 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400',
  neutral: 'border-border-custom bg-surface-solid text-text-muted',
  watch:   'border-amber-500/30 bg-amber-500/8 text-amber-600 dark:text-amber-400',
  bad:     'border-rose-500/30 bg-rose-500/8 text-rose-600 dark:text-rose-400',
};
export const CONF_LABEL = { solid: 'Solid', building: 'Building', calibrating: 'Calibrating' };

export const STATUS_RING = {
  green:  '!border-emerald-500/20',
  yellow: '!border-amber-500/20',
  red:    '!border-rose-500/25',
};
export const STATUS_GLOW = { green: 'bg-emerald-500/5', yellow: 'bg-amber-500/5', red: 'bg-rose-500/5' };

export const READINESS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  primed:       { label: '⚡ Gotowy do działania', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  balanced:     { label: '✓ Zbalansowany',          color: 'text-sky-600 dark:text-sky-400',         bg: 'bg-sky-500/10 border-sky-500/20' },
  strained:     { label: '⚠ Zmęczony',             color: 'text-amber-600 dark:text-amber-400',      bg: 'bg-amber-500/10 border-amber-500/20' },
  rundown:      { label: '↓ Wyczerpany',            color: 'text-rose-600 dark:text-rose-400',        bg: 'bg-rose-500/10 border-rose-500/20' },
  insufficient: { label: '– Za mało danych',        color: 'text-text-muted',                         bg: 'bg-surface-solid border-border-custom' },
};
