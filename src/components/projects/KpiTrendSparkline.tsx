import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatWarsawDate, getTodayWarsaw, getPastWeekStarts } from '../../lib/date';
import { getWeekStartWarsaw } from '../../lib/growth';

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

  const currentWeekStart = getWeekStartWarsaw(getTodayWarsaw());

  useEffect(() => {
    async function loadKpiHistory() {
      // 1. Fetch kpi_entries from the last 8 weeks
      const lastWeeks = getPastWeekStarts(currentWeekStart, 8);
      const { data: entries, error: entriesErr } = await supabase
        .from('kpi_entries')
        .select('week_start, value')
        .eq('user_id', userId)
        .eq('kpi_id', kpiId)
        .in('week_start', lastWeeks)
        .order('week_start', { ascending: true });

      if (entriesErr) {
        console.error('[KpiTrendSparkline] failed to fetch entries', entriesErr);
        return;
      }

      setPoints(
        (entries ?? []).map((e) => ({
          recorded_at: e.week_start,
          value: Number(e.value ?? 0),
        })),
      );
    }

    void loadKpiHistory();
  }, [kpiId, userId, currentWeekStart]);

  const latestFromHistory = points.length > 0 ? points[points.length - 1].value : null;
  const displayValue = latestFromHistory ?? currentValue ?? 0;

  const handleIncrement = async () => {
    if (!onValueChange) return;
    setLogging(true);
    try {
      const next = displayValue + 1;
      
      // Atomic increment in kpi_entries for current week_start
      const { error: incErr } = await supabase.rpc('increment_kpi_entry_for_week', {
        p_kpi_id: kpiId,
        p_week_start: currentWeekStart,
        p_delta: 1,
      });

      if (incErr) {
        // Fallback directly to direct upsert into kpi_entries if RPC fails
        const { error: upsertErr } = await supabase
          .from('kpi_entries')
          .upsert(
            { user_id: userId, kpi_id: kpiId, week_start: currentWeekStart, value: next },
            { onConflict: 'kpi_id,week_start' }
          );
        if (upsertErr) throw upsertErr;
      }

      // Update local state points
      setPoints((prev) => {
        const copy = [...prev];
        if (copy.length > 0 && copy[copy.length - 1].recorded_at === currentWeekStart) {
          copy[copy.length - 1].value = next;
          return copy;
        }
        return [...prev, { recorded_at: currentWeekStart, value: next }];
      });

      onValueChange(next);
    } catch (e: unknown) {
      console.error('[Background Error]', e);
    } finally {
      setLogging(false);
    }
  };

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
