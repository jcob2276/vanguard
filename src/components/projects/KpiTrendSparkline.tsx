import Button from '../ui/Button';
import { notify } from '../../lib/notify';
import { Plus } from 'lucide-react';
import { getTodayWarsaw } from '../../lib/date';
import { getWeekStartWarsaw } from '../../lib/growth/growth';
import { useKpiHistoryQuery, useIncrementKpiMutation } from '../../lib/kpiTrendApi';

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
  const currentWeekStart = getWeekStartWarsaw(getTodayWarsaw());
  const { data: points = [] } = useKpiHistoryQuery(userId, kpiId, currentWeekStart);
  const incrementMutation = useIncrementKpiMutation(userId, kpiId, currentWeekStart);
  const logging = incrementMutation.isPending;

  const latestFromHistory = points.length > 0 ? points[points.length - 1].value : null;
  const displayValue = latestFromHistory ?? currentValue ?? 0;

  const handleIncrement = async () => {
    if (!onValueChange) return;
    try {
      const next = displayValue + 1;
      await incrementMutation.mutateAsync(next);
      onValueChange(next);
    } catch (e: unknown) {
      notify('Nie udało się zapisać wartości KPI.', 'error');
      console.warn('[KpiTrendSparkline] Failed to log KPI value:', e);
    }
  };

  if (points.length < 2 || compact) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs font-bold text-text-secondary whitespace-nowrap tabular-nums">
          {displayValue}
          {target != null ? `/${target}` : ''}
          {unit ? ` ${unit}` : ''}
        </span>
        {onValueChange && (
          <Button
            variant="tonal"
            size="sm"
            onClick={() => void handleIncrement()}
            disabled={logging}
            icon={<Plus size={10} strokeWidth={3} />}
            className="h-5 w-5 p-0"
            title="+1"
          />
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
      <span className="text-xs font-bold text-text-secondary whitespace-nowrap tabular-nums">
        {latest}
        {unit ? ` ${unit}` : ''}
      </span>
      {onValueChange && (
        <Button
          variant="tonal"
          size="sm"
          onClick={() => void handleIncrement()}
          disabled={logging}
          icon={<Plus size={10} strokeWidth={3} />}
          className="h-5 w-5 p-0"
          title="+1"
        />
      )}
    </div>
  );
}
