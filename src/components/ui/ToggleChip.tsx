import { Pressable } from './ControlPrimitives';

interface ToggleChipProps {
  active: boolean;
  onClick: () => void;
  variant?: 'primary' | 'success' | 'danger' | 'warning';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

const variantStyles = {
  primary: {
    active: 'border-primary/40 bg-primary/10 text-primary',
    inactive: 'border-border-custom text-text-muted hover:text-text-secondary',
  },
  success: {
    active: 'border-success/40 bg-success/10 text-success',
    inactive: 'border-border-custom text-text-muted hover:text-text-secondary',
  },
  danger: {
    active: 'border-danger/40 bg-danger/10 text-danger',
    inactive: 'border-border-custom text-text-muted hover:text-text-secondary',
  },
  warning: {
    active: 'border-warning/40 bg-warning/10 text-warning',
    inactive: 'border-border-custom text-text-muted hover:text-text-secondary',
  },
};

const sizeStyles = {
  sm: 'px-1.5 py-0.5 text-2xs',
  md: 'px-2.5 py-1 text-2xs',
};

export function ToggleChip({
  active,
  onClick,
  variant = 'primary',
  size = 'md',
  icon,
  children,
  disabled,
  className,
}: ToggleChipProps) {
  return (
    <Pressable
      className={`flex items-center gap-1 rounded-lg border font-black uppercase tracking-widest transition-all cursor-pointer disabled:opacity-[var(--opacity-60)] ${
        active ? variantStyles[variant].active : variantStyles[variant].inactive
      } ${sizeStyles[size]} ${className ?? ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      {children}
    </Pressable>
  );
}
