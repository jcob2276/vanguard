// SVG stroke/fill accept CSS var() directly — hex is only the fallback for pre-paint.
export const C = {
  indigo: 'var(--color-primary, var(--color-theme-hex-6366f1))',
  emerald: 'var(--color-success)',
  amber: 'var(--color-warning)',
  rose: 'var(--color-danger)',
  sky: 'var(--color-info)',
  violet: 'var(--color-theme-hex-a78bfa)'
};
