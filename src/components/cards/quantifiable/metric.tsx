import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardData {
  value: string | number;
  unit?: string;
  label: string;
  change?: number;
  changeLabel?: string;
  color?: string;
}

export function MetricCard({ data }: { data: MetricCardData }) {
  const color = data.color ?? 'var(--color-primary)';
  const trend = data.change == null ? null : data.change > 0 ? 'up' : data.change < 0 ? 'down' : 'flat';
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium" style={{ color: 'var(--color-text-tertiary)' }}>{data.label}</p>
      <div className="flex items-end gap-1.5">
        <span className="font-data text-2xl" style={{ color }}>{data.value}</span>
        {data.unit && <span className="text-sm font-medium mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{data.unit}</span>}
      </div>
      {trend && (
        <div className="flex items-center gap-1">
          {trend === 'up' && <TrendingUp size={11} style={{ color: 'var(--color-success)' }} />}
          {trend === 'down' && <TrendingDown size={11} style={{ color: 'var(--color-danger)' }} />}
          {trend === 'flat' && <Minus size={11} style={{ color: 'var(--color-text-tertiary)' }} />}
          <span className="text-xs font-medium" style={{ color: trend === 'up' ? 'var(--color-success)' : trend === 'down' ? 'var(--color-danger)' : 'var(--color-text-tertiary)' }}>
            {data.changeLabel ?? `${data.change! > 0 ? '+' : ''}${data.change}`}
          </span>
        </div>
      )}
    </div>
  );
}
