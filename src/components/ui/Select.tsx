import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options: SelectOption[];
  label?: string;
  error?: string;
  controlSize?: 'sm' | 'md' | 'lg';
}

const HEIGHTS = { sm: 'h-[var(--control-sm)]', md: 'h-[var(--control-md)]', lg: 'h-[var(--control-lg)]' } as const;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, label, error, controlSize = 'md', className = '', id, ...props }, ref) => {
    const selectId = id ?? props.name;
    return (
      <label className="grid w-full gap-[var(--space-1)]" htmlFor={selectId}>
        {label && <span className="text-xs font-semibold text-text-secondary">{label}</span>}
        <span className="relative block">
          <select
            ref={ref}
            id={selectId}
            className={`w-full appearance-none rounded-[var(--radius-md)] border bg-surface-solid px-[var(--space-3)] pr-9 text-sm font-medium text-text-primary outline-none transition-[border-color,box-shadow,background-color] duration-[var(--motion-fast)] focus:border-primary/40 focus:shadow-focus disabled:cursor-not-allowed disabled:opacity-[var(--opacity-disabled)] ${HEIGHTS[controlSize]} ${error ? 'border-danger/50' : 'border-border-custom/60'} ${className}`}
            {...props}
          >
            {options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
          </select>
          <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
        </span>
        {error && <span className="text-xs font-medium text-danger">{error}</span>}
      </label>
    );
  },
);

Select.displayName = 'Select';

export default Select;
