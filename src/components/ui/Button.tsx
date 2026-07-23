import React, { forwardRef } from 'react';
import Spinner from './Spinner';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'tonal';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
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
}, ref) {
  const baseClass = 'inline-flex min-h-[44px] items-center justify-center font-semibold rounded-[16px] transition-all duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.96] touch-manipulation disabled:opacity-50 disabled:pointer-events-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45';

  const sizeClasses = {
    sm: 'px-3.5 py-2 text-xs gap-1.5 min-h-[36px] rounded-[12px]',
    md: 'px-4 py-2.5 text-sm gap-2 min-h-[44px]',
    lg: 'px-5 py-3 text-base gap-2.5 min-h-[48px] rounded-[20px]',
  };

  const variantClasses = {
    primary: 'bg-primary text-on-accent shadow-md hover:opacity-90 active:shadow-none border border-black/5 dark:border-white/10',
    secondary: 'bg-surface-2 border border-black/8 dark:border-white/10 text-text-primary hover:bg-surface-3',
    outline: 'bg-transparent border border-black/15 dark:border-white/15 text-text-secondary hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary',
    ghost: 'bg-transparent text-text-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary',
    danger: 'bg-danger text-on-accent shadow-md hover:opacity-90 active:shadow-none border border-black/5 dark:border-white/10',
    tonal: 'bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20',
  };

  return (
    <button
      ref={ref}
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
});

Button.displayName = 'Button';

export default Button;
