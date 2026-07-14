import { useEffect, useMemo, useState } from 'react';
import { fetchRecentDoneTasks } from '../../lib/insightsApi';
import { BarChartWidget } from '../widgets/BarChart';
import { CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { formatWarsawDate, getDaysAgoWarsaw, getTodayWarsaw, shiftDateStr } from '../../lib/date';
import { useUserId } from '../../store/useStore';
import { Card } from '../ui/Card';
import Badge from '../ui/Badge';

interface DoneTask {
  completed_at: string | null;
  duration_minutes: number | null;
  priority: string | null;
}

const DAY_LABELS = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

/** Day-of-week (0=Sun) for a Warsaw calendar date, anchored at noon UTC to avoid
 * local-browser-timezone drift and DST-boundary date shifts. */
function warsawDayOfWeek(dateStr: string) {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

export default function TaskAnalyticsCard() {
  const userId = useUserId();
  const [tasks, setTasks] = useState<DoneTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const sinceISO = new Date(shiftDateStr(getTodayWarsaw(), -7) + 'T00:00:00Z').toISOString();

    (async () => {
      try {
        const data = await fetchRecentDoneTasks(userId, sinceISO);
        setTasks(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const { chartData, totalHours, totalCount, streak } = useMemo(() => {
    // Build last 7 days
    const days: Array<{ key: string; label: string; dayOfWeek: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const key = i === 0 ? formatWarsawDate(new Date()) : getDaysAgoWarsaw(i);
      const dow = warsawDayOfWeek(key);
      days.push({
        key,
        label: i === 0 ? 'Dziś' : DAY_LABELS[dow],
        dayOfWeek: dow,
      });
    }

    const minutesByDay: Record<string, number> = {};
    const countByDay: Record<string, number> = {};
    let totalMin = 0;
    let totalDone = 0;

    tasks.forEach((t) => {
      if (!t.completed_at) return;
      const localDate = formatWarsawDate(t.completed_at);
      const min = t.duration_minutes || 0;
      minutesByDay[localDate] = (minutesByDay[localDate] || 0) + min;
      countByDay[localDate] = (countByDay[localDate] || 0) + 1;
      totalMin += min;
      totalDone++;
    });

    const chartPoints = days.map((d) => ({
      label: d.label,
      value: parseFloat(((minutesByDay[d.key] || 0) / 60).toFixed(1)),
    }));

    // Streak: consecutive days with at least 1 completed task
    let s = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (countByDay[days[i].key]) s++;
      else break;
    }

    return {
      chartData: chartPoints,
      totalHours: parseFloat((totalMin / 60).toFixed(1)),
      totalCount: totalDone,
      streak: s,
    };
  }, [tasks]);

  if (loading) {
    return (
      <Card variant="glass" padding="1rem">
        <div className="h-4 w-32 bg-border-custom/40 rounded animate-pulse mb-4" />
        <div className="h-[140px] bg-border-custom/20 rounded-xl animate-pulse" />
      </Card>
    );
  }

  return (
    <Card variant="glass" padding="1rem" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black text-text-muted uppercase tracking-widest">Zadania · ostatnie 7 dni</p>
          <p className="text-lg font-black text-text-primary mt-0.5">Czas pracy</p>
        </div>
        <Badge variant="tag" color={streak > 0 ? '#f97316' : undefined} className="px-3 py-1.5">
          🔥 {streak} dni
        </Badge>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-primary/8 px-3 py-2.5 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-primary shrink-0" />
          <div>
            <p className="text-lg font-black text-text-primary leading-none">{totalCount}</p>
            <p className="text-2xs text-text-muted font-semibold">wykonanych</p>
          </div>
        </div>
        <div className="rounded-xl bg-warning/8 px-3 py-2.5 flex items-center gap-2">
          <Clock size={14} className="text-warning shrink-0" />
          <div>
            <p className="text-lg font-black text-text-primary leading-none">{totalHours}h</p>
            <p className="text-2xs text-text-muted font-semibold">zalogowane</p>
          </div>
        </div>
      </div>

      {/* Bar chart */}
      {totalCount > 0 ? (
        <BarChartWidget data={{ points: chartData, color: 'var(--color-primary)' }} />
      ) : (
        <div className="h-[140px] flex flex-col items-center justify-center gap-2">
          <TrendingUp size={24} className="text-text-muted/30" />
          <p className="text-sm text-text-muted/50 font-semibold text-center">
            Wykonaj pierwsze zadanie<br />żeby zobaczyć wykres
          </p>
        </div>
      )}
    </Card>
  );
}
