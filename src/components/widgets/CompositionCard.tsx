import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface Slice { label: string; value: number; color?: string; }
interface CompositionProps { slices: Slice[]; title?: string; }

const COLORS = ['#5B6CFF', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6'];

export function CompositionCard({ slices, title }: CompositionProps) {
  return (
    <div>
      {title && <p className="text-[12px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</p>}
      <div className="flex gap-3 items-center">
        <ResponsiveContainer width={80} height={80}>
          <PieChart>
            <Pie data={slices} dataKey="value" cx="50%" cy="50%" innerRadius={22} outerRadius={36} strokeWidth={0}>
              {slices.map((s, i) => <Cell key={i} fill={s.color ?? COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} formatter={(v: any) => [v, '']} />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-1">
          {slices.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color ?? COLORS[i % COLORS.length] }} />
              <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
              <span className="text-[11px] font-medium ml-auto" style={{ color: 'var(--text-primary)' }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
