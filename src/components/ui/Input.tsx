import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

type InputSize = 'sm' | 'md' | 'lg';

type InputOwnProps = {
  size?: InputSize;
  icon?: ReactNode;
  error?: string;
};

type InputProps = InputOwnProps & Omit<InputHTMLAttributes<HTMLInputElement>, keyof InputOwnProps>;

const SIZE_CLASSES: Record<InputSize, string> = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-base',
  lg: 'px-4 py-3.5 text-base',
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
          className={`w-full bg-surface-solid border rounded-xl font-semibold text-text-primary outline-none transition-all placeholder:text-text-muted/30 ${
            icon ? 'pl-9' : ''
          } ${SIZE_CLASSES[size]} ${
            error
              ? 'border-danger/50 focus:border-danger focus:ring-1 focus:ring-danger/30'
              : 'border-border-custom/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/30'
          } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
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
