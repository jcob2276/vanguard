import React from 'react';

interface StabilityRingProps {
  progress: number;
  size?: number;
}

export default function StabilityRing({ progress, size = 64 }: StabilityRingProps) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * progress;
  const color = progress === 1 ? 'var(--legacy-color-010)' : progress > 0.5 ? 'var(--color-warning)' : 'var(--legacy-color-020)';

  return (
    <svg width={size} height={size} style={{ transform: 'var(--legacy-inline-style-083)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--legacy-color-130)" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'var(--legacy-inline-style-088)' }}
      />
    </svg>
  );
}
