import type { LucideIcon } from 'lucide-react';

export interface StatHeroProps {
  /** The main numeric/text value displayed large */
  value: React.ReactNode;
  /** Small label above or below the value */
  label: string;
  /** Unit suffix next to the value (e.g. "kcal", "/21", "pts") */
  suffix?: string;
  /** Optional leading icon */
  icon?: LucideIcon;
  /** Tailwind color class for the value (e.g. "text-success", "text-danger") */
  color?: string;
  /** Size variant — 'md' is the default hero size, 'sm' is compact inline */
  size?: 'sm' | 'md';
  /** Additional classes for the root element */
  className?: string;
}

/**
 * Reusable stat display: large value + small label + optional icon/trend.
 * Uses .stat-hero-number for the large variant, standard sizing for small.
 */
export function StatHero({
  value,
  label,
  suffix,
  icon: Icon,
  color = 'text-text-primary',
  size = 'md',
  className = '',
}: StatHeroProps) {
  if (size === 'sm') {
    return (
      <div className={`text-center ${className}`}>
        <p className="text-3xs font-black uppercase tracking-wider text-text-muted mb-0.5 flex items-center justify-center gap-0.5">
          {Icon && <Icon size={9} className={color} />}
          {label}
        </p>
        <p className={`font-display text-lg font-black leading-none ${color}`}>
          {value}{suffix && <span className="text-2xs text-text-muted font-normal ml-0.5">{suffix}</span>}
        </p>
      </div>
    );
  }

  return (
    <div className={`text-center ${className}`}>
      <p className="text-2xs font-black uppercase tracking-[var(--ds-arbitrary-0-15em)] text-text-muted mb-1 flex items-center justify-center gap-1">
        {Icon && <Icon size={10} className={color} />}
        {label}
      </p>
      <p className={`stat-hero-number ${color}`}>
        {value}
        {suffix && <span className="text-sm font-bold text-text-secondary ml-1">{suffix}</span>}
      </p>
    </div>
  );
}
