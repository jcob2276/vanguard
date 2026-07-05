import React from 'react';

interface StabilityRingProps {
  progress: number;
  size?: number;
}

export default function StabilityRing({ progress, size = 64 }: StabilityRingProps) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * progress;
  const color = progress === 1 ? '#22c55e' : progress > 0.5 ? '#f59e0b' : '#3b82f6';

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.1s linear, stroke 0.3s' }}
      />
    </svg>
  );
}
