import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Flame, BatteryCharging, Utensils, Gauge } from 'lucide-react';

const LIMITER_PL = {
  sleep: 'sen', calories: 'kalorie', carbs: 'węgle',
  cardio_load: 'koszt cardio', strength_load: 'siłownia',
  mental_load: 'głowa', recovery_ok: 'OK',
};

// status + limiter → jednozdaniowa decyzja
function decision(status, limiter, strain) {
  if (status === 'green') return { text: 'Możesz cisnąć', tone: 'text-emerald-400' };
  if (status === 'red') {
    if (limiter === 'calories') return { text: 'Odpuść — najpierw dojedz', tone: 'text-red-400' };
    if (limiter === 'sleep') return { text: 'Odpuść — sen za krótki', tone: 'text-red-400' };
    return { text: 'Regeneracja, nie trening', tone: 'text-red-400' };
  }
  // yellow
  if (limiter === 'calories') return { text: 'Tylko easy — dobierz kalorie', tone: 'text-amber-400' };
  if (limiter === 'carbs') return { text: 'Tylko easy — mało węgli', tone: 'text-amber-400' };
  if (limiter === 'sleep') return { text: 'Tylko easy — sen poniżej normy', tone: 'text-amber-400' };
  if (limiter === 'cardio_load' || limiter === 'strength_load')
    return { text: 'Umiarkowanie — wczoraj duży koszt', tone: 'text-amber-400' };
  return { text: strain != null && strain < 8 ? 'Lekki dzień — jest zapas' : 'Umiarkowanie — monitoruj', tone: 'text-amber-400' };
}

const STATUS_RING = { green: 'border-emerald-500/40', yellow: 'border-amber-500/40', red: 'border-red-500/50' };
const STATUS_GLOW = { green: 'bg-emerald-500/10', yellow: 'bg-amber-500/10', red: 'bg-red-500/10' };

function Metric({ icon: Icon, label, value, max, tone }) {
  const pct = max ? Math.min((Number(value) / max) * 100, 100) : 0;
  return (
    <div className="flex-1">
      <div className="flex items-center gap-1 mb-1">
        <Icon size={11} className="text-white/30" />
        <span className="text-[7px] font-black uppercase tracking-widest text-white/35">{label}</span>
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

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('daily_strain')
        .select('*').eq('user_id', session.user.id)
        .order('date', { ascending: false }).limit(1).maybeSingle();
      setRow(data);
      setLoading(false);
    })();
  }, [session.user.id]);

  if (loading || !row) return null;

  const d = decision(row.daily_status, row.main_limiter, Number(row.strain_score));
  const strainTone = row.strain_score >= 15 ? 'text-orange-400' : row.strain_score >= 8 ? 'text-white' : 'text-white/70';
  const recovTone = row.recovery_score >= 75 ? 'text-emerald-400' : row.recovery_score >= 55 ? 'text-amber-400' : 'text-red-400';
  const fuelTone = row.fueling_score >= 70 ? 'text-emerald-400' : row.fueling_score >= 45 ? 'text-amber-400' : 'text-red-400';

  return (
    <section className={`relative overflow-hidden rounded-2xl border ${STATUS_RING[row.daily_status]} bg-neutral-950 p-5`}>
      <div className={`absolute right-0 top-0 h-28 w-28 rounded-full blur-3xl ${STATUS_GLOW[row.daily_status]}`} />
      <div className="relative space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">Trening dziś</p>
            <h3 className={`text-xl font-black uppercase italic tracking-tight ${d.tone}`}>{d.text}</h3>
          </div>
          <div className="text-right">
            <p className="text-[7px] font-black uppercase tracking-widest text-white/30">Limiter</p>
            <p className="text-[11px] font-black uppercase text-white/70">{LIMITER_PL[row.main_limiter] || row.main_limiter}</p>
          </div>
        </div>

        <div className="flex gap-4">
          <Metric icon={Flame} label="Strain" value={row.strain_score} max={21} tone={strainTone} />
          <Metric icon={BatteryCharging} label="Recovery" value={row.recovery_score} max={100} tone={recovTone} />
          <Metric icon={Utensils} label="Fueling" value={row.fueling_score} max={100} tone={fuelTone} />
        </div>

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
