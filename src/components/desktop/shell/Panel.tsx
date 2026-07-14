import React from 'react';
import { Card } from '../../ui/Card';

export type ChartTooltipPayload = {
  color?: string;
  name?: string | number;
  value?: string | number;
};

export function Tip({ active = false, payload = [], label = '' }: { active?: boolean; payload?: ChartTooltipPayload[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border-custom bg-surface-solid px-3 py-2 shadow-lg text-[11px]">
      <p className="text-text-muted font-bold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-black">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export interface PanelProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Panel({ title, children, className = '' }: PanelProps) {
  return (
    <Card padding="1.25rem" className={className}>
      {title && (
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-text-muted mb-4 pb-2.5 border-b border-border-custom">
          {title}
        </p>
      )}
      {children}
    </Card>
  );
}
