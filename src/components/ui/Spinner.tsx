const SIZE_CLASS = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-[var(--ds-arbitrary-3px-coll-2)]',
};

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Ładowanie"
      className={`animate-spin rounded-full border-primary border-t-transparent ${SIZE_CLASS[size]} ${className}`}
    />
  );
}
