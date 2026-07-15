import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  selected?: boolean;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
}

const TONES = {
  neutral: 'bg-surface-2 text-text-secondary border-border-custom/50',
  primary: 'bg-primary/10 text-primary border-primary/20',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  danger: 'bg-danger/10 text-danger border-danger/20',
} as const;

function Chip({ children, selected = false, tone = 'neutral', className = '', type = 'button', ...props }: ChipProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-[var(--control-sm)] items-center gap-[var(--space-1)] rounded-[var(--radius-full)] border px-[var(--space-3)] text-xs font-semibold transition-[background-color,border-color,color,transform] duration-[var(--motion-fast)] ease-[var(--ease-out)] active:scale-[var(--ds-arbitrary-0-98)] disabled:cursor-not-allowed disabled:opacity-[var(--opacity-disabled)] ${selected ? 'bg-surface-tonal-strong text-primary border-primary/25' : TONES[tone]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default Chip;
