import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { BarChartWidget } from '../widgets/BarChart';
import { CheckCircle2, Clock, TrendingUp } from 'lucide-react';

interface Props {
  session: Session;
}

interface DoneTask {
  completed_at: string | null;
  duration_minutes: number | null;
  priority: string;
}

const DAY_LABELS = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

function warsawDate(isoStr: string) {
  // Parse ISO, shift to Warsaw (+02:00 CEST simplified)
  const d = new Date(isoStr);
  return new Date(d.getTime() + 2 * 3600 * 1000);
}

function dateKey(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export default function TaskAnalyticsCard({ session }: Props) {
  const userId = session.user.id;
  const [tasks, setTasks] = useState<DoneTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceISO = since.toISOString();

    (async () => {
      try {
        const { data } = await supabase
          .from('todo_items')
          .select('completed_at, duration_minutes, priority')
          .eq('user_id', userId)
          .eq('status', 'done')
          .gte('completed_at', sinceISO);
        setTasks((data as DoneTask[]) || []);
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
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        key: dateKey(d),
        label: i === 0 ? 'Dziś' : DAY_LABELS[d.getDay()],
        dayOfWeek: d.getDay(),
      });
    }

    const minutesByDay: Record<string, number> = {};
    const countByDay: Record<string, number> = {};
    let totalMin = 0;
    let totalDone = 0;

    tasks.forEach((t) => {
      if (!t.completed_at) return;
      const localDate = dateKey(warsawDate(t.completed_at));
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
      <div className="rounded-2xl border border-border-custom bg-surface-solid/30 p-4">
        <div className="h-4 w-32 bg-border-custom/40 rounded animate-pulse mb-4" />
        <div className="h-[140px] bg-border-custom/20 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border-custom bg-surface-solid/30 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-black text-text-muted uppercase tracking-widest">Zadania · ostatnie 7 dni</p>
          <p className="text-[16px] font-black text-text-primary mt-0.5">Czas pracy</p>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black ${streak > 0 ? 'bg-orange-500/10 text-orange-500' : 'bg-surface-solid text-text-muted'}`}>
          🔥 {streak} dni
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-primary/8 px-3 py-2.5 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-primary shrink-0" />
          <div>
            <p className="text-[18px] font-black text-text-primary leading-none">{totalCount}</p>
            <p className="text-[9px] text-text-muted font-semibold">wykonanych</p>
          </div>
        </div>
        <div className="rounded-xl bg-amber-500/8 px-3 py-2.5 flex items-center gap-2">
          <Clock size={14} className="text-amber-500 shrink-0" />
          <div>
            <p className="text-[18px] font-black text-text-primary leading-none">{totalHours}h</p>
            <p className="text-[9px] text-text-muted font-semibold">zalogowane</p>
          </div>
        </div>
      </div>

      {/* Bar chart */}
      {totalCount > 0 ? (
        <BarChartWidget data={{ points: chartData, color: '#5B6CFF' }} />
      ) : (
        <div className="h-[140px] flex flex-col items-center justify-center gap-2">
          <TrendingUp size={24} className="text-text-muted/30" />
          <p className="text-[12px] text-text-muted/50 font-semibold text-center">
            Wykonaj pierwsze zadanie<br />żeby zobaczyć wykres
          </p>
        </div>
      )}
    </div>
  );
}
