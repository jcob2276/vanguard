import { getHealthLevel, HEALTH_COLORS } from './projectUtils';

interface HealthScoreProps {
  score: number;
  size?: number; // diameter in px, default 44
  showLabel?: boolean;
}

/**
 * Animated SVG ring showing project health score 0–100.
 * Color: emerald ≥70 | blue 45–69 | amber 20–44 | rose <20
 */
const HEALTH_TOOLTIP: Record<string, string> = {
  great:    'Health 70–100: projekt aktywny, zadania idą do przodu',
  ok:       'Health 45–69: projekt działa, jest przestrzeń do przyspieszenia',
  warning:  'Health 20–44: projekt stoi lub brak aktywności >7 dni',
  critical: 'Health 0–19: projekt krytyczny — wymaga natychmiastowej uwagi',
};

export default function HealthScore({ score, size = 44, showLabel = false }: HealthScoreProps) {
  const level = getHealthLevel(score);
  const colors = HEALTH_COLORS[level];

  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;
  const gap = circumference - dash;

  return (
    <div className="flex flex-col items-center gap-1" title={HEALTH_TOOLTIP[level]}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        {/* Background ring */}
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="absolute inset-0 -rotate-90"
          style={{ transform: 'var(--legacy-inline-style-083)' }}
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={5}
            className="text-border-custom/40"
          />
          {/* Progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors.ring}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
            style={{
              transition: 'var(--legacy-inline-style-089)',
            }}
          />
        </svg>
        {/* Score label in center */}
        <span
          className={`relative text-xs font-black leading-none ${colors.fill}`}
          style={{ fontSize: size < 36 ? 'var(--health-score-font-small)' : 'var(--health-score-font-default)' }}
        >
          {score}
        </span>
      </div>
      {showLabel && (
        <span className={`text-2xs font-bold uppercase tracking-wider ${colors.text}`}>
          {colors.label}
        </span>
      )}
    </div>
  );
}
