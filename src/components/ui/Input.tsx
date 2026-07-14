import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

type InputSize = 'sm' | 'md' | 'lg';

type InputOwnProps = {
  size?: InputSize;
  icon?: ReactNode;
  error?: string;
};

type InputProps = InputOwnProps & Omit<InputHTMLAttributes<HTMLInputElement>, keyof InputOwnProps>;

const SIZE_CLASSES: Record<InputSize, string> = {
  sm: 'h-[var(--control-sm)] px-[var(--space-3)] text-sm',
  md: 'h-[var(--control-md)] px-[var(--space-4)] text-base',
  lg: 'h-[var(--control-lg)] px-[var(--space-4)] text-base',
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ size = 'md', icon, error, className = '', disabled, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/50 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          disabled={disabled}
          className={`w-full rounded-[var(--radius-md)] border bg-surface-solid font-semibold text-text-primary outline-none transition-[background-color,border-color,box-shadow] duration-[var(--motion-fast)] placeholder:text-text-muted/40 ${
            icon ? 'pl-9' : ''
          } ${SIZE_CLASSES[size]} ${
            error
              ? 'border-danger/50 focus:border-danger focus:ring-1 focus:ring-danger/30'
              : 'border-border-custom/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/30'
          } ${disabled ? 'cursor-not-allowed opacity-[var(--opacity-disabled)]' : ''} ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-danger font-medium">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
