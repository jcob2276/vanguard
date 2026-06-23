import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendPoint { label: string; value: number; }
interface TrendChartProps { data: TrendPoint[]; title?: string; color?: string; unit?: string; }

export function TrendChart({ data, title, color = '#5B6CFF', unit }: TrendChartProps) {
  return (
    <div>
      {title && <p className="text-[12px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{title}</p>}
      <ResponsiveContainer width="100%" height={100}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--color-text-tertiary)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: 'var(--color-text-tertiary)' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 11 }}
            formatter={(v: any) => [`${v}${unit ?? ''}`, '']}
          />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
