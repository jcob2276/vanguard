export interface BadgeProps {
  count?: number;
  variant?: 'count' | 'dot' | 'tag';
  color?: string;
  className?: string;
  children?: React.ReactNode;
}

export default function Badge({ count, variant = 'count', color, className = '', children }: BadgeProps) {
  if (variant === 'dot') {
    return (
      <span
        className={`inline-block h-2 w-2 rounded-full ${color ? '' : 'bg-primary'} ${className}`}
        style={color ? { backgroundColor: color } : undefined}
      />
    );
  }

  if (variant === 'tag') {
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
          color ? '' : 'bg-primary/10 text-primary'
        } ${className}`}
        style={color ? { backgroundColor: `color-mix(in srgb, ${color} 13%, transparent)`, color } : undefined}
      >
        {children}
      </span>
    );
  }

  // variant === 'count'
  if (count === undefined || count === null) return null;

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[var(--legacy-arbitrary-056)] h-[var(--legacy-arbitrary-057)] rounded-full px-1 text-xs font-black ${
        color ? '' : 'bg-primary text-on-accent'
      } ${className}`}
      style={color ? { backgroundColor: color, color: 'white' } : undefined}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
