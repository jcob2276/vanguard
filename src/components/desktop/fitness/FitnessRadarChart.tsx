import type { ScoreKey } from './fitnessScoreUtils';

const RADAR_KEYS: ScoreKey[] = ['endurance', 'strength', 'habits', 'progress', 'volume', 'consistency'];

const RADAR_LABELS = [
  { key: 'endurance' as const, name: 'Wydolność', align: 'start' as const, xOff: 8, yOff: -3 },
  { key: 'strength' as const, name: 'Siła', align: 'start' as const, xOff: 10, yOff: 4 },
  { key: 'habits' as const, name: 'Regeneracja', align: 'start' as const, xOff: 8, yOff: 10 },
  { key: 'progress' as const, name: 'Adaptacja', align: 'end' as const, xOff: -8, yOff: 10 },
  { key: 'volume' as const, name: 'Obciążenie', align: 'end' as const, xOff: -10, yOff: 4 },
  { key: 'consistency' as const, name: 'Regularność', align: 'end' as const, xOff: -8, yOff: -3 },
];

interface FitnessRadarChartProps {
  profile: Record<ScoreKey, number>;
  theme: string;
  grid: string;
}

export default function FitnessRadarChart({ profile, theme, grid }: FitnessRadarChartProps) {
  const cx = 190;
  const cy = 155;
  const r = 92;

  return (
    <div className="flex justify-center items-center py-2">
      <svg width="100%" height={320} viewBox="0 0 380 320" className="overflow-visible max-w-[var(--legacy-maxw-058)]">
        <defs>
          <filter id="radar-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {[2, 4, 6, 8, 10].map((k) => {
          const points = [0, 1, 2, 3, 4, 5]
            .map((index) => {
              const angle = ((index * 60 - 60) * Math.PI) / 180;
              const val = k / 10;
              return `${cx + r * val * Math.cos(angle)},${cy + r * val * Math.sin(angle)}`;
            })
            .join(' ');
          return (
            <polygon
              key={k}
              points={points}
              fill="none"
              stroke={grid}
              strokeWidth="1"
              strokeDasharray={k === 10 ? 'none' : '2,3'}
              className="opacity-[var(--opacity-70)]"
            />
          );
        })}

        {[0, 1, 2, 3, 4, 5].map((index) => {
          const angle = ((index * 60 - 60) * Math.PI) / 180;
          return (
            <line
              key={index}
              x1={cx}
              y1={cy}
              x2={cx + r * Math.cos(angle)}
              y2={cy + r * Math.sin(angle)}
              stroke={grid}
              strokeWidth="1"
              className="opacity-[var(--opacity-50)]"
            />
          );
        })}

        <polygon
          points={[0, 1, 2, 3, 4, 5]
            .map((index) => {
              const key = RADAR_KEYS[index];
              const score = profile[key];
              const angle = ((index * 60 - 60) * Math.PI) / 180;
              const val = score / 10;
              return `${cx + r * val * Math.cos(angle)},${cy + r * val * Math.sin(angle)}`;
            })
            .join(' ')}
          fill="var(--legacy-color-099)"
          stroke="var(--legacy-color-048)"
          strokeWidth="2"
          filter="url(#radar-glow)"
        />

        {[0, 1, 2, 3, 4, 5].map((index) => {
          const key = RADAR_KEYS[index];
          const score = profile[key];
          const angle = ((index * 60 - 60) * Math.PI) / 180;
          const val = score / 10;
          return (
            <circle
              key={index}
              cx={cx + r * val * Math.cos(angle)}
              cy={cy + r * val * Math.sin(angle)}
              r="4"
              fill="var(--legacy-color-048)"
              stroke={theme === 'dark' ? 'var(--scrim)' : 'white'}
              strokeWidth="1.5"
            />
          );
        })}

        {RADAR_LABELS.map((lbl, index) => {
          const angle = ((index * 60 - 60) * Math.PI) / 180;
          const score = profile[lbl.key];
          const x = cx + (r + 16) * Math.cos(angle) + lbl.xOff;
          const y = cy + (r + 16) * Math.sin(angle) + lbl.yOff;
          return (
            <g key={lbl.key}>
              <text
                x={x}
                y={y}
                textAnchor={lbl.align}
                className="text-2xs font-black uppercase tracking-wider fill-text-primary"
              >
                {lbl.name}
              </text>
              <text
                x={x}
                y={y + 12}
                textAnchor={lbl.align}
                className="text-xs font-black italic fill-primary font-display"
              >
                {score.toFixed(1)}
                <tspan className="text-2xs font-normal fill-text-muted not-italic">/10</tspan>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
