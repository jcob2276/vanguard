import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Flame, BatteryCharging, Gauge, RefreshCw, Zap, Activity, Moon, Thermometer, Footprints } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import DataStateNotice from '../core/DataStateNotice';

const LIMITER_PL = {
  sleep: 'sen', calories: 'kalorie', carbs: 'węgle',
  cardio_load: 'koszt cardio', strength_load: 'siłownia',
  mental_load: 'głowa', recovery_ok: 'OK',
};

const STATUS_RING = { 
  green: 'border-emerald-500/20 bg-emerald-500/[0.03] shadow-[0_8px_30px_rgba(16,185,129,0.04)]', 
  yellow: 'border-amber-500/20 bg-amber-500/[0.03] shadow-[0_8px_30px_rgba(245,158,11,0.04)]', 
  red: 'border-rose-500/25 bg-rose-500/[0.03] shadow-[0_8px_30px_rgba(244,63,94,0.04)]' 
};
const STATUS_GLOW = { green: 'bg-emerald-500/5', yellow: 'bg-amber-500/5', red: 'bg-rose-500/5' };

function Metric({ icon: Icon, label, value, max, tone, note = null }: { icon: LucideIcon; label: string; value: number | string | null | undefined; max: number; tone: string; note?: string | null }) {
  const pct = max ? Math.min((Number(value) / max) * 100, 100) : 0;
  return (
    <div className="flex-1 bg-surface-solid border border-border-custom rounded-[16px] p-3 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
      <div className="flex items-center gap-1 mb-1.5">
        <Icon size={11} className="text-text-muted" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</span>
      </div>
      <p className={`text-[19px] font-black italic font-display ${tone}`}>
        {value ?? '--'}<span className="text-[11px] text-text-muted not-italic ml-0.5">/{max}</span>
      </p>
      <div className="h-1 mt-2 bg-border-custom rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: 'currentColor' }} />
      </div>
    </div>
  );
}

export default function DailyStrainCard({ session }: { session: any }) {
  const [row, setRow] = useState<any | null>(null);
  const [oura, setOura] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRow = useCallback(async () => {
    const [{ data, error: queryError }, { data: ouraSummaries }] = await Promise.all([
      supabase.from('daily_strain')
        .select('*').eq('user_id', session.user.id)
        .order('date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('oura_daily_summary')
        .select('date, hrv_avg, rhr_avg, total_sleep_hours, temp_deviation, steps, readiness_score')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false }).limit(2),
    ]);
    if (queryError) {
      console.error('DailyStrainCard:', queryError);
      setError(queryError.message);
      setRow(null);
    } else {
      setRow(data);
    }
    if (ouraSummaries?.length) {
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
      setOura(ouraSummaries.find(s => s.date === todayStr) || ouraSummaries[0]);
    }
  }, [session.user.id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      await fetchRow();
      setLoading(false);
    })();
  }, [fetchRow]);

  // Pełny refresh: sync źródeł → warstwy pochodne Oura → przelicz strain → odśwież
  async function refresh() {
    setRefreshing(true);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const token = s?.access_token;
      const base = import.meta.env.VITE_SUPABASE_URL;
      const call = async (fn: string, body: any) => {
        const response = await fetch(`${base}/functions/v1/${fn}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(`${fn} failed: ${payload.error || response.statusText || response.status}`);
        }
        return response;
      };
      // 1. źródła surowe (równolegle)
      await Promise.all([
        call('sync-yazio', { userId: session.user.id }),
        call('sync-strava', {}),
        call('sync-oura', { userId: session.user.id }),
      ]);
      // 2. warstwy pochodne Oura (strefy HR zasilają cardio load)
      await Promise.all([
        call('sync-oura-enhanced', { userId: session.user.id, days: 2 }),
        call('sync-oura-timeseries', { userId: session.user.id, days: 2 }),
      ]);
      // 3. przelicz Daily Strain
      await call('compute-daily-strain', { userId: session.user.id, days: 2 });
      // 4. odśwież kartę
      await fetchRow();
    } catch (e: any) {
      console.error('DailyStrainCard refresh:', e);
      setError(e.message || 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <section className="card p-5">
        <DataStateNotice
          tone="loading"
          title="Obciążenie dnia się liczy"
          detail="Ładuje ostatni wynik obciążenia i regeneracji."
        />
      </section>
    );
  }

  if (error) {
    return (
      <section className="card border-red-500/20 p-5">
        <DataStateNotice
          tone="warning"
          title="Obciążenie niedostępne"
          detail={`Nie mogę odczytać danych: ${error}`}
        />
      </section>
    );
  }

  if (!row) {
    return (
      <section className="card p-5">
        <DataStateNotice
          title="Brak danych obciążenia"
          detail="Uruchom sync Oura/Strava i przelicz strain."
        />
      </section>
    );
  }

  const strainTone = row.strain_score >= 15 ? 'text-orange-500 dark:text-orange-400' : row.strain_score >= 8 ? 'text-text-primary' : 'text-text-secondary';
  const recovTone = row.recovery_score >= 75 ? 'text-emerald-600 dark:text-emerald-400' : row.recovery_score >= 55 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
  const missingSignals = [
    row.strain_score == null ? 'strain niepoliczony' : null,
    row.recovery_score == null ? 'recovery bez danych Oura' : null,
  ].filter(Boolean);

  const statusKey = (row.daily_status || 'green') as keyof typeof STATUS_RING;
  const limiterKey = (row.main_limiter || '') as keyof typeof LIMITER_PL;

  return (
    <section className={`relative overflow-hidden rounded-[24px] border ${STATUS_RING[statusKey] || STATUS_RING.green} bg-surface backdrop-blur-md p-3.5 shadow-sm`}>
      <div className={`absolute right-0 top-0 h-16 w-16 blur-3xl ${STATUS_GLOW[statusKey] || STATUS_GLOW.green}`} />
      <div className="relative space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted font-display">Trening dziś</p>
          <div className="flex items-center gap-2.5">
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Limiter</p>
              <p className="text-[11px] font-extrabold uppercase text-text-primary font-display mt-0.5">{LIMITER_PL[limiterKey] || row.main_limiter}</p>
            </div>
            <button onClick={refresh} disabled={refreshing}
              title="Sync + przelicz"
              className="rounded-xl border border-border-custom bg-surface-solid/40 p-2.5 text-text-muted transition-all hover:bg-surface-solid hover:text-text-primary active:scale-95 disabled:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <Metric icon={Flame} label="Strain" value={row.strain_score} max={21} tone={strainTone} />
          <Metric icon={BatteryCharging} label="Recovery" value={row.recovery_score} max={100} tone={recovTone} />
        </div>

        {missingSignals.length > 0 && (
          <DataStateNotice
            title="Niepełne dane"
            detail={missingSignals.join(' | ')}
          />
        )}

        {oura && (
          <div className="grid grid-cols-5 gap-1.5 pt-2.5 border-t border-border-custom">
            {[
              { icon: Zap, label: 'HRV', value: oura.hrv_avg ? `${oura.hrv_avg}ms` : '--', color: 'text-dayA' },
              { icon: Activity, label: 'RHR', value: oura.rhr_avg ? `${oura.rhr_avg}bpm` : '--', color: 'text-dayB' },
              { icon: Moon, label: 'Sen', value: oura.total_sleep_hours ? `${Math.floor(oura.total_sleep_hours)}h${Math.round((oura.total_sleep_hours % 1) * 60)}m` : '--', color: 'text-primary' },
              { icon: Thermometer, label: 'Temp', value: oura.temp_deviation != null ? `${oura.temp_deviation > 0 ? '+' : ''}${oura.temp_deviation}°` : '--', color: Math.abs(oura.temp_deviation || 0) > 0.5 ? 'text-rose-500' : 'text-text-secondary' },
              { icon: Footprints, label: 'Kroki', value: oura.steps ? oura.steps.toLocaleString() : '--', color: 'text-dayC' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="flex flex-col items-center gap-1 bg-surface-solid border border-border-custom rounded-xl py-2 px-1 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
                <Icon size={12} className={color} />
                <span className="text-[9px] font-bold tracking-wider text-text-muted uppercase">{label}</span>
                <span className={`text-[11px] font-bold font-display ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
