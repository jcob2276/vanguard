import { Bar, BarChart as RechartsBar, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface BarChartData {
  points: Array<{ label: string; value: number }>;
  color?: string;
}

export function BarChartWidget({ data }: { data: BarChartData }) {
  const color = data.color ?? '#5B6CFF';
  if (!data.points?.length) {
    return <p className="text-[11px] text-text-tertiary py-4 text-center">Brak danych</p>;
  }

  return (
    <div className="h-[140px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <RechartsBar data={data.points} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }} axisLine={false} tickLine={false} width={28} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10 }} />
          <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={28} />
        </RechartsBar>
      </ResponsiveContainer>
    </div>
  );
}
