import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Moon, RefreshCw } from 'lucide-react';
import DataStateNotice from '../core/DataStateNotice';

const GOAL_MIN = 480;

const STATUS_RING = {
  green:  'border-emerald-500/40',
  yellow: 'border-amber-500/40',
  red:    'border-red-500/50',
};
const STATUS_GLOW = {
  green:  'bg-emerald-500/10',
  yellow: 'bg-amber-500/10',
  red:    'bg-red-500/10',
};
const STATUS_TEXT = {
  green:  'text-emerald-400',
  yellow: 'text-amber-400',
  red:    'text-red-400',
};
const STATUS_BAR = {
  green:  '#10b981',
  yellow: '#f59e0b',
  red:    '#ef4444',
};

function calcDebt(rows) {
  return rows.reduce((sum, r) => {
    const min = Math.round((r.total_sleep_hours || 0) * 60);
    return sum + Math.max(0, GOAL_MIN - min);
  }, 0);
}

function formatDebt(min) {
  if (min <= 0) return '0 min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function debtStatus(min) {
  if (min < 60)  return 'green';
  if (min < 180) return 'yellow';
  return 'red';
}

function Trend({ debtNow, debtPrev }) {
  if (debtPrev === null || debtPrev === undefined) return null;
  const diff = debtNow - debtPrev;
  if (Math.abs(diff) < 30) return <span className="text-[10px] font-black text-white/40">→</span>;
  if (diff < 0) return <span className="text-[10px] font-black text-emerald-400">↑ lepiej</span>;
  return <span className="text-[10px] font-black text-red-400">↓ gorzej</span>;
}

export default function SleepDebtCard({ session }) {
  const [rows, setRows]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    const today  = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    const cutoff = new Date(Date.now() - 14 * 864e5)
      .toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

    const { data, error: qErr } = await supabase
      .from('oura_daily_summary')
      .select('date, total_sleep_hours, readiness_score')
      .eq('user_id', session.user.id)
      .gte('date', cutoff)
      .lte('date', today)
      .order('date', { ascending: false })
      .limit(14);

    if (qErr) { setError(qErr.message); setRows(null); }
    else setRows(data || []);
  }, [session.user.id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      await fetchData();
      setLoading(false);
    })();
  }, [fetchData]);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const token = s?.access_token;
      const base  = import.meta.env.VITE_SUPABASE_URL;
      const call  = async (fn, body) => {
        const res = await fetch(`${base}/functions/v1/${fn}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const p = await res.json().catch(() => ({}));
          throw new Error(`${fn} failed: ${p.error || res.statusText || res.status}`);
        }
        return res;
      };
      await call('sync-oura', { userId: session.user.id });
      await fetchData();
    } catch (e) {
      console.error('SleepDebtCard refresh:', e);
      setError(e.message || 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-white/[0.08] bg-neutral-950/80 p-5">
        <DataStateNotice tone="loading" title="Ładuję dług snu" detail="Pobieram dane Oura z ostatnich 14 dni." />
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-lg border border-red-500/15 bg-neutral-950/80 p-5">
        <DataStateNotice tone="warning" title="Błąd dług snu" detail={error} />
      </section>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <section className="rounded-lg border border-white/[0.08] bg-neutral-950/80 p-5">
        <DataStateNotice
          title="Brak danych Oura"
          detail="Uruchom sync Oura żeby zobaczyć dług snu z ostatnich 7 dni."
        />
      </section>
    );
  }

  const week    = rows.slice(0, 7);
  const prev    = rows.slice(7, 14);
  const debtNow  = calcDebt(week);
  const debtPrev = prev.length >= 5 ? calcDebt(prev) : null;
  const scores   = week.map(r => r.readiness_score).filter(Boolean);
  const avgScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;
  const status = debtStatus(debtNow);
  const barPct = Math.min((debtNow / (8 * 60)) * 100, 100);

  return (
    <section className={`relative overflow-hidden rounded-lg border ${STATUS_RING[status]} bg-[linear-gradient(180deg,rgba(24,24,27,0.9),rgba(10,10,11,0.96))] p-5 shadow-2xl shadow-black/30`}>
      <div className={`absolute right-0 top-0 h-20 w-20 blur-3xl ${STATUS_GLOW[status]}`} />
      <div className="relative space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Moon size={11} className="text-white/30" />
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">Dług snu 7 dni</p>
            </div>
            <div className="flex items-baseline gap-2">
              <h3 className={`text-[19px] font-black uppercase tracking-tight ${STATUS_TEXT[status]}`}>
                {formatDebt(debtNow)}
              </h3>
              <Trend debtNow={debtNow} debtPrev={debtPrev} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {avgScore !== null && (
              <div className="text-right">
                <p className="text-[7px] font-black uppercase tracking-widest text-white/30">Avg score</p>
                <p className="text-[11px] font-black uppercase text-white/70">{avgScore}/100</p>
              </div>
            )}
            <button
              onClick={refresh}
              disabled={refreshing}
              title="Sync Oura"
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 text-white/45 transition-colors hover:text-white disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Debt progress bar */}
        <div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${barPct}%`, backgroundColor: STATUS_BAR[status] }}
            />
          </div>
          <p className="mt-1.5 text-[8px] font-semibold uppercase tracking-widest text-white/25">
            Cel: 8h/dobę · {week.length} {week.length === 1 ? 'dzień' : 'dni'} danych
          </p>
        </div>

        {/* Sparse data notice */}
        {week.length < 5 && (
          <DataStateNotice
            title="Niepełne dane"
            detail={`Tylko ${week.length} z 7 dni — dług orientacyjny.`}
          />
        )}
      </div>
    </section>
  );
}
