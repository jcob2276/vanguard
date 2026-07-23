import { CSSProperties } from 'react';

export interface BorderBeamProps {
  /** Size of the beam element in px. Default 200 */
  size?: number;
  /** Animation duration in seconds. Default 12 */
  duration?: number;
  /** Animation delay in seconds. Default 0 */
  delay?: number;
  /** Start color of the beam gradient */
  colorFrom?: string;
  /** End color of the beam gradient */
  colorTo?: string;
  /** Thickness of the beam stroke in px. Default 1.5 */
  borderWidth?: number;
  /** Extra CSS classes */
  className?: string;
  /** Extra inline styles */
  style?: CSSProperties;
}
/**
 * BorderBeam component — creates an animated traveling glow beam around the border of any container.
 * Requires container to have `relative overflow-hidden` and a border-radius.
 */
export function BorderBeam({
  size = 200,
  duration = 12,
  delay = 0,
  colorFrom = 'var(--color-primary)',
  colorTo = 'var(--color-info-hover)',
  borderWidth = 1.5,
  className = '',
  style,
}: BorderBeamProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 rounded-[inherit] [border:var(--border-width)_solid_transparent] [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(var(--scrim),var(--scrim))] ${className}`}
      style={
        {
          '--border-width': `${borderWidth}px`,
          ...style,
        } as CSSProperties
      }
    >
      <div
        className="absolute aspect-square bg-gradient-to-l from-[var(--color-from)] via-[var(--color-to)] to-transparent"
        style={
          {
            width: `${size}px`,
            offsetPath: `rect(0 100% 100% 0 round calc(var(--border-width) * 2))`,
            '--color-from': colorFrom,
            '--color-to': colorTo,
            animation: `border-beam ${duration}s infinite linear`,
            animationDelay: `${delay}s`,
          } as CSSProperties
        }
      />
    </div>
  );
}
