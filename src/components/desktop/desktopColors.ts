// SVG stroke/fill accept CSS var() directly — hex is only the fallback for pre-paint.
export const C = {
  indigo: 'var(--color-primary, var(--legacy-color-024))',
  emerald: 'var(--color-success, var(--legacy-color-004))',
  amber: 'var(--color-warning, var(--legacy-color-040))',
  rose: 'var(--color-danger, var(--legacy-color-038))',
  sky: 'var(--color-info, var(--legacy-color-019))',
  violet: 'var(--legacy-color-032)'
};
