import React from 'react';

interface StabilityRingProps {
  progress: number;
  size?: number;
}

export default function StabilityRing({ progress, size = 64 }: StabilityRingProps) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * progress;
  const color = progress === 1 ? 'var(--color-success)' : progress > 0.5 ? 'var(--color-warning)' : 'var(--color-info)';

  return (
    <svg width={size} height={size} style={{ transform: 'var(--ds-inline-style-rotate-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-theme-hex-ba25525525501)" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'var(--ds-inline-style-stroke-dasharray-0-1s-linear-stroke-0-3s)' }}
      />
    </svg>
  );
}
