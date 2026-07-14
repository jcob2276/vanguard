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
  const baseClass = 'inline-flex items-center justify-center font-bold font-display rounded-[var(--radius-md)] transition-[transform,background-color,color,border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)] active:scale-97 disabled:opacity-[var(--opacity-50)] disabled:pointer-events-none cursor-pointer';

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs gap-1',
    md: 'px-4.5 py-2.5 text-sm gap-1.5',
    lg: 'px-6 py-3.5 text-base gap-2',
  };

  const variantClasses = {
    primary: 'bg-primary text-on-accent shadow-sm hover:bg-primary-hover active:shadow-none',
    secondary: 'bg-surface-2 border border-transparent text-text-primary hover:bg-surface-3',
    outline: 'bg-transparent border border-border-custom text-text-secondary hover:bg-surface-2 hover:text-text-primary',
    ghost: 'bg-transparent text-text-muted hover:bg-surface-2 hover:text-text-primary',
    danger: 'bg-danger text-on-accent shadow-sm hover:bg-danger-hover active:shadow-none',
    tonal: 'bg-surface-tonal text-primary hover:bg-surface-tonal-strong border border-transparent',
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
