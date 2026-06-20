import React from 'react';
import { C } from './desktopUtils';

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
    <div className={`rounded-[20px] border border-border-custom bg-surface p-5 shadow-sm ${className}`}>
      {title && (
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-text-muted mb-4 pb-2.5 border-b border-border-custom">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

export interface KPIProps {
  label: string;
  value?: any;
  unit?: string;
  color?: string;
  barMax?: number;
  note?: string | null;
  trend?: { up: boolean; delta: number } | null;
}

export function KPI({ label, value, unit, color = 'text-text-primary', barMax, note, trend }: KPIProps) {
  const pct = barMax && value ? Math.min((value / barMax) * 100, 100) : null;
  return (
    <div className="rounded-[16px] border border-border-custom bg-surface px-4 py-3.5 flex flex-col gap-0.5 shadow-sm">
      <p className="text-[8px] font-black uppercase tracking-[0.18em] text-text-muted">{label}</p>
      <p className={`font-display text-[26px] font-black leading-none ${color}`}>
        {value ?? '—'}
        {unit && <span className="text-[11px] font-semibold text-text-muted ml-1">{unit}</span>}
      </p>
      {trend && (
        <p className={`text-[9px] font-bold mt-0.5 ${trend.up ? 'text-emerald-500' : 'text-rose-500'}`}>
          {trend.up ? '↑' : '↓'} {trend.delta} vs 7d temu
        </p>
      )}
      {note && <p className="text-[9px] text-text-muted mt-0.5">{note}</p>}
      {pct !== null && (
        <div className="h-1 mt-1.5 bg-border-custom rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: C.indigo }} />
        </div>
      )}
    </div>
  );
}
