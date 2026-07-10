import { BarChart2 } from 'lucide-react';
import type { UserStatsSnapshot } from './hooks/useUserStatsSnapshot';

interface MetricPillProps { value: number; label: string; color: string; }
function MetricPill({ value, label, color }: MetricPillProps) {
  return (
    <div className="flex-1 rounded-xl px-3 py-2.5 text-center" style={{ background: `${color}0D` }}>
      <p className="text-[17px] font-[800] leading-none" style={{ color }}>{value.toLocaleString('pl-PL')}</p>
      <p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{label}</p>
    </div>
  );
}

interface MiniBarChartProps { data: { inputs: number; cards: number; completedTodos: number }[]; }
function MiniBarChart({ data }: MiniBarChartProps) {
  const max = Math.max(...data.map(d => d.inputs + d.cards + d.completedTodos), 1);
  return (
    <div className="flex items-end gap-0.5 h-[42px]">
      {data.slice(0, 30).map((d, i) => {
        const total = d.inputs + d.cards + d.completedTodos;
        const h = Math.max(8, (total / max) * 42);
        return (
          <div key={i} className="flex-1 rounded-sm" style={{ height: h, background: 'rgba(91,108,255,0.65)', minWidth: 2 }} />
        );
      })}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      <div className="h-4 w-1/2 rounded-lg animate-pulse" style={{ background: 'rgba(153,161,175,0.12)' }} />
      <div className="flex gap-2">
        {[0,1,2].map(i => <div key={i} className="flex-1 h-14 rounded-xl animate-pulse" style={{ background: 'rgba(153,161,175,0.08)' }} />)}
      </div>
      <div className="h-[42px] rounded-lg animate-pulse" style={{ background: 'rgba(153,161,175,0.06)' }} />
    </div>
  );
}

interface Props { snapshot: UserStatsSnapshot | null; loading?: boolean; }

export function UserStatsOverviewCard({ snapshot, loading }: Props) {
  return (
    <div className="rounded-[20px] border p-4 space-y-3"
      style={{ background: 'white', borderColor: 'rgba(153,161,175,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(91,108,255,0.08)' }}>
          <BarChart2 size={13} style={{ color: '#5B6CFF' }} />
        </div>
        <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>Aktywność</span>
        {snapshot && (
          <span className="text-[11px] ml-auto" style={{ color: 'var(--color-text-tertiary)' }}>
            {snapshot.currentStreakDays} dni z rzędu
          </span>
        )}
      </div>

      {loading || !snapshot ? <Skeleton /> : (
        <>
          <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            {snapshot.totalInputs.toLocaleString('pl-PL')} rekordów · {snapshot.activeDays} aktywnych dni
          </p>

          <div className="flex gap-2">
            <MetricPill value={snapshot.totalInputs} label="Rekordy" color="#5B6CFF" />
            <MetricPill value={snapshot.totalCards} label="Karty" color="#10B981" />
            <MetricPill value={snapshot.totalCompletedTodos} label="Zadania" color="#F59E0B" />
          </div>

          <MiniBarChart data={snapshot.daily} />
        </>
      )}
    </div>
  );
}
