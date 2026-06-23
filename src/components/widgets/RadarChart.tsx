import { Radar, RadarChart as ReRadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

interface RadarPoint { axis: string; value: number; fullMark?: number; }
interface RadarChartProps { data: RadarPoint[]; title?: string; color?: string; }

export function RadarChart({ data, title, color = '#5B6CFF' }: RadarChartProps) {
  return (
    <div>
      {title && <p className="text-[12px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</p>}
      <ResponsiveContainer width="100%" height={160}>
        <ReRadarChart data={data}>
          <PolarGrid stroke="rgba(153,161,175,0.2)" />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 9, fill: 'var(--color-text-tertiary)' }} />
          <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.15} />
        </ReRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
