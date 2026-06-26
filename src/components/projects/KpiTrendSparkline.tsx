import { useEffect, useState } from 'react';
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
}

export function KpiTrendSparkline({ kpiId, userId, unit, target }: KpiTrendSparklineProps) {
  const [points, setPoints] = useState<Snapshot[]>([]);

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

  if (points.length < 2) {
    return <span className="text-[9px] text-text-muted">Brak historii</span>;
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 120;
  const h = 28;
  const coords = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

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
      <span className="text-[10px] font-bold text-text-secondary whitespace-nowrap">
        {latest}{unit ? ` ${unit}` : ''}
      </span>
    </div>
  );
}
