// VitalBands: color tile by z-score vs personal EWMA baseline (Strand VitalBands.swift)
export function zToVitalColor(z: number | null | undefined, defaultColor: string): string {
  if (z == null) return defaultColor;
  if (z >= 1.0)        return 'text-success dark:text-success';
  if (z >= -1.0)       return defaultColor;
  if (z >= -2.0)       return 'text-warning dark:text-warning';
  return 'text-danger dark:text-danger';
}

export const CONF_PILL = {
  solid:       'bg-success/10 text-success dark:text-success',
  building:    'bg-warning/10 text-warning dark:text-warning',
  calibrating: 'bg-surface-solid text-text-muted border border-border-custom',
};

export const SIGNAL_PILL: Record<string, string> = {
  good:    'border-success/30 bg-success/8 text-success dark:text-success',
  neutral: 'border-border-custom bg-surface-solid text-text-muted',
  watch:   'border-warning/30 bg-warning/8 text-warning dark:text-warning',
  bad:     'border-danger/30 bg-danger/8 text-danger dark:text-danger',
};
export const CONF_LABEL = { solid: 'Solid', building: 'Building', calibrating: 'Calibrating' };

export const STATUS_RING = {
  green:  '!border-success/20',
  yellow: '!border-warning/20',
  red:    '!border-danger/25',
};
export const STATUS_GLOW = { green: 'bg-success/5', yellow: 'bg-warning/5', red: 'bg-danger/5' };

export const READINESS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  primed:       { label: '⚡ Gotowy do działania', color: 'text-success dark:text-success', bg: 'bg-success/10 border-success/20' },
  balanced:     { label: '✓ Zbalansowany',          color: 'text-info dark:text-info',         bg: 'bg-info/10 border-info/20' },
  strained:     { label: '⚠ Zmęczony',             color: 'text-warning dark:text-warning',      bg: 'bg-warning/10 border-warning/20' },
  rundown:      { label: '↓ Wyczerpany',            color: 'text-danger dark:text-danger',        bg: 'bg-danger/10 border-danger/20' },
  insufficient: { label: '– Za mało danych',        color: 'text-text-muted',                         bg: 'bg-surface-solid border-border-custom' },
};
export type { StrainComponents } from '../../lib/db-json-guards';
