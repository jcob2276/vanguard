import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface TrendChartData {
  points: Array<{ label: string; value: number }>;
  unit?: string;
  color?: string;
}

export function TrendChart({ data }: { data: TrendChartData }) {
  const color = data.color ?? 'var(--color-primary)';
  if (!data.points?.length) {
    return <p className="text-[11px] text-text-tertiary py-4 text-center">Brak danych</p>;
  }

  return (
    <div className="h-[140px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <AreaChart data={data.points} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }} axisLine={false} tickLine={false} width={28} />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--color-border-custom)' }}
            formatter={(v) => [`${v}${data.unit ? ` ${data.unit}` : ''}`, '']}
          />
          <Area type="monotone" dataKey="value" stroke={color} fill="url(#trendFill)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
