import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Snapshot {
  recorded_at: string;
  value: number;
}

interface KpiTrendSparklineProps {
  kpiId: string;
  userId: string;
  unit?: string;
  target?: number | null;
  /** Bieżąca wartość z goal_kpis — pokazywana gdy brak historii wykresu */
  currentValue?: number | null;
  /** Kompaktowy tryb: bez wykresu, tylko wartość + opcjonalnie +1 */
  compact?: boolean;
  onValueChange?: (next: number) => void;
}

export function KpiTrendSparkline({
  kpiId,
  userId,
  unit,
  target,
  currentValue,
  compact = false,
  onValueChange,
}: KpiTrendSparklineProps) {
  const [points, setPoints] = useState<Snapshot[]>([]);
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    supabase
      .from('goal_kpi_snapshots')
      .select('recorded_at, value')
      .eq('user_id', userId)
      .eq('kpi_id', kpiId)
      .order('recorded_at', { ascending: true })
      .limit(30)
      .then(({ data }) => setPoints((data as Snapshot[]) ?? []));
  }, [kpiId, userId]);

  const latestFromHistory = points.length > 0 ? points[points.length - 1].value : null;
  const displayValue = latestFromHistory ?? currentValue ?? null;

  const handleIncrement = async () => {
    if (displayValue == null || !onValueChange) return;
    setLogging(true);
    try {
      const next = displayValue + 1;
      const { error: updErr } = await supabase.from('goal_kpis').update({ current_value: next }).eq('id', kpiId);
      if (updErr) throw updErr;
      const { error: snapErr } = await supabase
        .from('goal_kpi_snapshots')
        .insert({ kpi_id: kpiId, user_id: userId, value: next });
      if (snapErr) throw snapErr;
      setPoints((prev) => [...prev, { recorded_at: new Date().toISOString(), value: next }]);
      onValueChange(next);
    } catch (e) {
      console.warn('[KpiTrendSparkline] increment failed', e);
    } finally {
      setLogging(false);
    }
  };

  if (displayValue == null) {
    return null;
  }

  if (points.length < 2 || compact) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] font-bold text-text-secondary whitespace-nowrap tabular-nums">
          {displayValue}
          {target != null ? `/${target}` : ''}
          {unit ? ` ${unit}` : ''}
        </span>
        {onValueChange && (
          <button
            type="button"
            onClick={() => void handleIncrement()}
            disabled={logging}
            className="flex h-5 w-5 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary hover:bg-primary/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            title="+1"
          >
            <Plus size={10} strokeWidth={3} />
          </button>
        )}
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 120;
  const h = 28;
  const coords = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  const latest = values[values.length - 1];

  return (
    <div className="flex items-center gap-2">
      <svg width={w} height={h} className="text-primary">
        <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={coords} />
        {target != null && (
          <line
            x1={0}
            x2={w}
            y1={h - ((target - min) / range) * (h - 4) - 2}
            y2={h - ((target - min) / range) * (h - 4) - 2}
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeDasharray="3 2"
          />
        )}
      </svg>
      <span className="text-[10px] font-bold text-text-secondary whitespace-nowrap tabular-nums">
        {latest}
        {unit ? ` ${unit}` : ''}
      </span>
      {onValueChange && (
        <button
          type="button"
          onClick={() => void handleIncrement()}
          disabled={logging}
          className="flex h-5 w-5 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary hover:bg-primary/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          title="+1"
        >
          <Plus size={10} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}
