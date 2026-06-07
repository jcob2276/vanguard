import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Flame, BatteryCharging, Utensils, Gauge, RefreshCw } from 'lucide-react';
import DataStateNotice from './DataStateNotice';

const LIMITER_PL = {
  sleep: 'sen', calories: 'kalorie', carbs: 'węgle',
  cardio_load: 'koszt cardio', strength_load: 'siłownia',
  mental_load: 'głowa', recovery_ok: 'OK',
};

// status + limiter → jednozdaniowa decyzja
// provisional=true (dzień bieżący, Yazio niedomknięte) → fueling NIE jest finalnym limiterem
function decision(status, limiter, strain, provisional) {
  const fuelingLimiter = limiter === 'calories' || limiter === 'carbs';
  if (status === 'green') return { text: 'Możesz cisnąć', tone: 'text-emerald-400' };
  if (status === 'red') {
    if (limiter === 'calories' && !provisional) return { text: 'Odpuść — najpierw dojedz', tone: 'text-red-400' };
    if (limiter === 'sleep') return { text: 'Odpuść — sen za krótki', tone: 'text-red-400' };
    return { text: 'Regeneracja, nie trening', tone: 'text-red-400' };
  }
  // yellow
  if (fuelingLimiter && !provisional) {
    if (limiter === 'calories') return { text: 'Tylko easy — dobierz kalorie', tone: 'text-amber-400' };
    return { text: 'Tylko easy — mało węgli', tone: 'text-amber-400' };
  }
  if (limiter === 'sleep') return { text: 'Tylko easy — sen poniżej normy', tone: 'text-amber-400' };
  if (limiter === 'cardio_load' || limiter === 'strength_load')
    return { text: 'Umiarkowanie — wczoraj duży koszt', tone: 'text-amber-400' };
  return { text: strain != null && strain < 8 ? 'Lekki dzień — jest zapas' : 'Umiarkowanie — monitoruj', tone: 'text-amber-400' };
}

const STATUS_RING = { green: 'border-emerald-500/40', yellow: 'border-amber-500/40', red: 'border-red-500/50' };
const STATUS_GLOW = { green: 'bg-emerald-500/10', yellow: 'bg-amber-500/10', red: 'bg-red-500/10' };

function Metric({ icon: Icon, label, value, max, tone, note }) {
  const pct = max ? Math.min((Number(value) / max) * 100, 100) : 0;
  return (
    <div className="flex-1">
      <div className="flex items-center gap-1 mb-1">
        <Icon size={11} className="text-white/30" />
        <span className="text-[7px] font-black uppercase tracking-widest text-white/35">{label}</span>
        {note && <span className="text-[7px] font-black uppercase tracking-widest text-amber-400/70">· {note}</span>}
      </div>
      <p className={`text-lg font-black italic ${tone}`}>
        {value ?? '--'}<span className="text-[9px] text-white/25 not-italic ml-0.5">/{max}</span>
      </p>
      <div className="h-1 mt-1 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: 'currentColor' }} />
      </div>
    </div>
  );
}

export default function DailyStrainCard({ session }) {
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRow = useCallback(async () => {
    const { data, error: queryError } = await supabase.from('daily_strain')
      .select('*').eq('user_id', session.user.id)
      .order('date', { ascending: false }).limit(1).maybeSingle();
    if (queryError) {
      console.error('DailyStrainCard:', queryError);
      setError(queryError.message);
      setRow(null);
    } else {
      setRow(data);
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
      const call = async (fn, body) => {
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
    } catch (e) {
      console.error('DailyStrainCard refresh:', e);
      setError(e.message || 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-white/[0.08] bg-neutral-950/80 p-5">
        <DataStateNotice
          tone="loading"
          title="Daily strain sie liczy"
          detail="Laduje ostatni wynik obciazenia, regeneracji i fuelingu."
        />
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-lg border border-red-500/15 bg-neutral-950/80 p-5">
        <DataStateNotice
          tone="warning"
          title="Daily strain niedostepny"
          detail={`Nie moge odczytac daily_strain: ${error}`}
        />
      </section>
    );
  }

  if (!row) {
    return (
      <section className="rounded-lg border border-white/[0.08] bg-neutral-950/80 p-5">
        <DataStateNotice
          title="Daily strain niepoliczony"
          detail="Brak wiersza daily_strain. Uruchom sync Oura/Yazio/Strava i compute-daily-strain."
        />
      </section>
    );
  }

  const d = decision(row.daily_status, row.main_limiter, Number(row.strain_score), row.fueling_provisional);
  const strainTone = row.strain_score >= 15 ? 'text-orange-400' : row.strain_score >= 8 ? 'text-white' : 'text-white/70';
  const recovTone = row.recovery_score >= 75 ? 'text-emerald-400' : row.recovery_score >= 55 ? 'text-amber-400' : 'text-red-400';
  const fuelTone = row.fueling_score >= 70 ? 'text-emerald-400' : row.fueling_score >= 45 ? 'text-amber-400' : 'text-red-400';
  const missingSignals = [
    row.strain_score == null ? 'strain niepoliczony' : null,
    row.recovery_score == null ? 'recovery bez danych Oura' : null,
    row.fueling_score == null ? 'fueling bez Yazio' : null,
  ].filter(Boolean);

  return (
    <section className={`relative overflow-hidden rounded-lg border ${STATUS_RING[row.daily_status]} bg-[linear-gradient(180deg,rgba(24,24,27,0.9),rgba(10,10,11,0.96))] p-5 shadow-2xl shadow-black/30`}>
      <div className={`absolute right-0 top-0 h-20 w-20 blur-3xl ${STATUS_GLOW[row.daily_status]}`} />
      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">Trening dziś</p>
            <h3 className={`text-[19px] font-black uppercase tracking-tight ${d.tone}`}>{d.text}</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[7px] font-black uppercase tracking-widest text-white/30">Limiter</p>
              <p className="text-[11px] font-black uppercase text-white/70">{LIMITER_PL[row.main_limiter] || row.main_limiter}</p>
            </div>
            <button onClick={refresh} disabled={refreshing}
              title="Sync + przelicz"
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 text-white/45 transition-colors hover:text-white disabled:opacity-50">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="flex gap-4">
          <Metric icon={Flame} label="Strain" value={row.strain_score} max={21} tone={strainTone} />
          <Metric icon={BatteryCharging} label="Recovery" value={row.recovery_score} max={100} tone={recovTone} />
          <Metric icon={Utensils} label="Fueling" value={row.fueling_score} max={100} tone={fuelTone}
            note={row.fueling_provisional ? 'niepełny' : undefined} />
        </div>

        {row.fueling_provisional && (
          <p className="text-[9px] font-semibold uppercase tracking-wider text-amber-400/60">
            Fueling tymczasowy — jeśli dzień niezamknięty, finalny po domknięciu Yazio.
          </p>
        )}

        {missingSignals.length > 0 && (
          <DataStateNotice
            title="Niepelne dane"
            detail={missingSignals.join(' | ')}
          />
        )}

        {row.explanation && (
          <div className="flex items-start gap-2 pt-1">
            <Gauge size={11} className="text-white/25 mt-0.5 shrink-0" />
            <p className="text-[10px] font-semibold text-white/45 leading-relaxed">{row.explanation}</p>
          </div>
        )}
      </div>
    </section>
  );
}
