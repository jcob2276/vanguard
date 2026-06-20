import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatWarsawDate } from '../../lib/date';

const FRICTION_PL: Record<string, string> = {
  procrastination: 'Prokrastynacja',
  avoidance: 'Unikanie',
  social_hesitation: 'Zahamowanie społeczne',
  sleep_disruption: 'Zaburzenie snu',
  distraction: 'Rozproszenie',
  impulsive_decision: 'Impulsywna decyzja',
  overcommitment: 'Przepełnienie zobowiązaniami',
  self_sabotage: 'Sabotaż własny',
  emotional_eating: 'Jedzenie emocjonalne',
  isolation: 'Izolacja',
  positive_micro_action: 'Pozytywne działanie',
};

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatWarsawDate(d);
}

function formatWeekShort(ws: string): string {
  const d = new Date(ws + 'T12:00:00');
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }).replace(' ', '\n');
}

export default function FrictionPatterns({ session }: { session: any }) {
  const userId = session?.user?.id;
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const from = new Date();
    from.setDate(from.getDate() - 56); // 8 tygodni
    supabase
      .from('confirmed_friction_events')
      .select('occurred_at, friction_type, deviation')
      .eq('user_id', userId)
      .gte('occurred_at', from.toISOString())
      .order('occurred_at', { ascending: true })
      .then(({ data }) => {
        setEvents(data ?? []);
        setLoading(false);
      });
  }, [userId]);

  const { weeklyData, topTypes, positives, negatives } = useMemo(() => {
    const weeks: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};

    events.forEach(e => {
      const ws = getWeekStart(new Date(e.occurred_at));
      weeks[ws] = (weeks[ws] ?? 0) + (e.friction_type !== 'positive_micro_action' ? 1 : 0);
      typeCounts[e.friction_type] = (typeCounts[e.friction_type] ?? 0) + 1;
    });

    // Build last 8 weeks grid
    const today = new Date();
    const weekStarts: string[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i * 7);
      weekStarts.push(getWeekStart(d));
    }

    const weeklyData = weekStarts.map(ws => ({
      ws,
      label: formatWeekShort(ws),
      count: weeks[ws] ?? 0,
    }));

    const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    const pos = sorted.filter(([t]) => t === 'positive_micro_action');
    const neg = sorted.filter(([t]) => t !== 'positive_micro_action');
    return {
      weeklyData,
      topTypes: neg.slice(0, 4),
      positives: pos.reduce((a, [, v]) => a + v, 0),
      negatives: neg.reduce((a, [, v]) => a + v, 0),
    };
  }, [events]);

  if (loading) return null;
  if (events.length === 0) return null;

  const maxCount = Math.max(1, ...weeklyData.map(w => w.count));

  return (
    <section className="rounded-[24px] border border-border-custom bg-surface backdrop-blur-md p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingDown size={13} className="text-rose-400" />
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted">Wzorce tarcia — 8 tygodni</p>
        </div>
        <div className="flex items-center gap-3">
          {positives > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-black text-emerald-500">
              <CheckCircle size={10} /> {positives}
            </span>
          )}
          {negatives > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-black text-rose-400">
              <AlertTriangle size={10} /> {negatives}
            </span>
          )}
        </div>
      </div>

      {/* Weekly bar chart */}
      <div className="grid grid-cols-8 gap-1.5">
        {weeklyData.map((w) => {
          const pct = maxCount > 0 ? (w.count / maxCount) * 100 : 0;
          const isCurrent = w.ws === getWeekStart(new Date());
          return (
            <div key={w.ws} className="flex flex-col items-center gap-1">
              <div className="flex h-14 w-full flex-col justify-end">
                <div
                  className={`w-full rounded-sm transition-all duration-700 ${
                    w.count === 0
                      ? 'bg-border-custom/30'
                      : w.count >= 4 ? 'bg-rose-500' : w.count >= 2 ? 'bg-amber-400' : 'bg-rose-300'
                  } ${isCurrent ? 'opacity-100' : 'opacity-70'}`}
                  style={{ height: `${Math.max(w.count > 0 ? pct : 8, w.count > 0 ? 8 : 4)}%` }}
                />
              </div>
              <span className={`text-center text-[7px] font-bold leading-tight whitespace-pre-line ${isCurrent ? 'text-primary' : 'text-text-muted'}`}>
                {w.label}
              </span>
              {w.count > 0 && (
                <span className={`text-[8px] font-black ${w.count >= 4 ? 'text-rose-500' : 'text-text-muted'}`}>
                  {w.count}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Top friction types */}
      {topTypes.length > 0 && (
        <>
          <div className="border-t border-border-custom" />
          <div className="space-y-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Najczęstsze wzorce</p>
            {topTypes.map(([type, count]) => {
              const pct = negatives > 0 ? Math.round((count / negatives) * 100) : 0;
              return (
                <div key={type} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-text-primary">
                      {FRICTION_PL[type] ?? type}
                    </span>
                    <span className="text-[10px] font-black text-rose-400">{count}×</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-border-custom overflow-hidden">
                    <div
                      className="h-full rounded-full bg-rose-400/70 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
