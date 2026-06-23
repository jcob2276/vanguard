import { BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface BarPoint { label: string; value: number; color?: string; }
interface BarChartProps { data: BarPoint[]; title?: string; color?: string; unit?: string; }

export function BarChart({ data, title, color = '#5B6CFF', unit }: BarChartProps) {
  return (
    <div>
      {title && <p className="text-[12px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{title}</p>}
      <ResponsiveContainer width="100%" height={100}>
        <ReBarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--color-text-tertiary)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: 'var(--color-text-tertiary)' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 11 }}
            formatter={(v: any) => [`${v}${unit ?? ''}`, '']}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.color ?? color} />)}
          </Bar>
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  );
}
