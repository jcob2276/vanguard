import React from 'react';
import Spinner from './Spinner';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'tonal';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  children,
  className = '',
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  const baseClass = 'inline-flex items-center justify-center font-bold font-display rounded-[var(--radius-md)] transition-all duration-150 active:scale-97 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs gap-1',
    md: 'px-4.5 py-2.5 text-sm gap-1.5',
    lg: 'px-6 py-3.5 text-base gap-2',
  };

  const variantClasses = {
    primary: 'bg-primary text-white shadow-md shadow-primary/22 hover:bg-primary-hover hover:-translate-y-0.5 active:translate-y-0',
    secondary: 'bg-surface-solid border border-border-custom/80 text-text-primary hover:bg-surface-solid/80',
    outline: 'bg-white/2 dark:bg-white/[0.02] border border-border-custom text-text-secondary hover:bg-surface-solid hover:text-text-primary hover:-translate-y-0.5 active:translate-y-0',
    ghost: 'bg-transparent text-text-muted hover:bg-surface-solid hover:text-text-primary',
    danger: 'bg-danger text-white shadow-md shadow-danger/22 hover:bg-danger-hover hover:-translate-y-0.5 active:translate-y-0',
    tonal: 'bg-primary/8 text-primary hover:bg-primary/14 border border-primary/20',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${baseClass} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {loading && <Spinner size="sm" className="shrink-0" />}
      {!loading && icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
      {children}
      {!loading && icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
    </button>
  );
}
