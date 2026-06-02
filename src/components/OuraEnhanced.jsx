import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { Moon, Activity, Shield, Wind, HeartPulse, Flame, ChevronDown, ChevronUp, Link2 } from 'lucide-react';

const PHASE_COLOR = { deep: '#4f46e5', rem: '#a855f7', light: '#38bdf8', awake: '#f97316' };
const PHASE_LABEL = { deep: 'Głęboki', rem: 'REM', light: 'Lekki', awake: 'Czuwanie' };

const RESILIENCE_PL = {
  limited: 'Ograniczona', adequate: 'Wystarczająca', solid: 'Solidna',
  strong: 'Silna', exceptional: 'Wyjątkowa'
};
const STRESS_PL = { restored: 'Zregenerowany', normal: 'Normalny', stressful: 'Stresujący' };

// Czytelne nazwy + kierunek dla korelacji
const CORR_LABELS = {
  trening_vs_jutro_hrv: 'Trening → HRV nazajutrz',
  trening_vs_jutro_min_tetno: 'Trening → min. tętno nazajutrz',
  trening_vs_jutro_readiness: 'Trening → readiness nazajutrz',
  trening_vs_jutro_stres: 'Trening → stres nazajutrz',
  sen_vs_jutro_stres: 'Sen → stres nazajutrz',
  sen_vs_jutro_readiness: 'Sen → readiness nazajutrz',
  stres_vs_hrv_tej_nocy: 'Stres → HRV tej nocy',
  kroki_vs_sen: 'Kroki → jakość snu',
  siedzenie_vs_sen: 'Siedzenie → jakość snu',
  wybudzenia_vs_readiness: 'Wybudzenia → readiness',
  bialko_vs_sen: 'Białko → jakość snu',
  kalorie_vs_jutro_hrv: 'Kalorie → HRV nazajutrz',
  temp_vs_hrv: 'Temperatura → HRV',
};

function Tile({ icon: Icon, label, value, sub, tone = 'text-white' }) {
  return (
    <div className="bg-neutral-950/60 border border-white/5 rounded-2xl p-4 flex flex-col justify-between min-h-[88px]">
      <div className="flex items-center gap-1.5">
        <Icon size={12} className="text-white/30" />
        <span className="text-[8px] font-black uppercase tracking-[0.15em] text-white/35">{label}</span>
      </div>
      <div>
        <p className={`text-xl font-black italic tracking-tight ${tone}`}>{value}</p>
        {sub && <p className="text-[8px] font-bold uppercase tracking-wider text-white/30 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function OuraEnhanced({ session }) {
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [enh, setEnh] = useState([]);
  const [derived, setDerived] = useState([]);
  const [zones, setZones] = useState([]);
  const [phases, setPhases] = useState([]);
  const [corr, setCorr] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const uid = session.user.id;
      const [e, d, z, c] = await Promise.all([
        supabase.from('oura_enhanced')
          .select('date, sleep_score, readiness_score, stress_high_minutes, stress_day_summary, resilience_level, spo2_percentage, vascular_age')
          .eq('user_id', uid).order('date', { ascending: false }).limit(14),
        supabase.from('oura_derived_daily')
          .select('day, vigorous_min, moderate_min, awakenings, deep_blocks, sleep_hr_min, sleep_hrv_avg')
          .eq('user_id', uid).order('day', { ascending: false }).limit(14),
        supabase.from('oura_hr_zones_daily')
          .select('day, z1_regen_min, z2_tlenowa_min, z3_tempo_min, z4_prog_min, z5_max_min, hr_max')
          .eq('user_id', uid).order('day', { ascending: false }).limit(14),
        supabase.from('oura_correlations').select('*').eq('user_id', uid).maybeSingle(),
      ]);
      setEnh(e.data || []);
      setDerived(d.data || []);
      setZones(z.data || []);
      setCorr(c.data || null);

      // hipnogram ostatniej nocy
      const lastDay = (e.data || []).find(r => r.sleep_score != null)?.date || (e.data || [])[0]?.date;
      if (lastDay) {
        const { data: ph } = await supabase.from('oura_sleep_phase_timeline')
          .select('phase, ts').eq('user_id', uid).eq('day', lastDay)
          .order('ts', { ascending: true });
        setPhases(ph || []);
      }
    } catch (err) {
      console.error('OuraEnhanced fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading || enh.length === 0) return null;

  const today = enh[0] || {};
  const prev = enh[1] || {};
  const dToday = derived[0] || {};
  const zToday = zones[0] || {};

  // trendy (chronologicznie)
  const trend = [...enh].reverse().map(r => ({
    date: r.date?.slice(5),
    sleep: r.sleep_score,
    stres: r.stress_high_minutes != null ? Math.round(r.stress_high_minutes) : null,
  }));
  const zoneTrend = [...zones].reverse().map(z => ({
    date: z.day?.slice(5),
    intensywne: (z.z4_prog_min || 0) + (z.z5_max_min || 0),
  }));

  // hipnogram — proporcje faz
  const phaseCounts = phases.reduce((acc, p) => { acc[p.phase] = (acc[p.phase] || 0) + 1; return acc; }, {});
  const phaseTotal = phases.length || 1;

  // strefy HR ostatni dzień
  const zoneRows = [
    { k: 'z1_regen_min', label: 'Z1 Regen', color: '#22c55e' },
    { k: 'z2_tlenowa_min', label: 'Z2 Tlenowa', color: '#84cc16' },
    { k: 'z3_tempo_min', label: 'Z3 Tempo', color: '#eab308' },
    { k: 'z4_prog_min', label: 'Z4 Próg', color: '#f97316' },
    { k: 'z5_max_min', label: 'Z5 Max', color: '#ef4444' },
  ];
  const zoneMax = Math.max(1, ...zoneRows.map(r => zToday[r.k] || 0));

  // zależności — posortowane wg |r|
  const corrItems = corr ? Object.entries(CORR_LABELS)
    .map(([k, label]) => ({ label, r: corr[k] != null ? Number(corr[k]) : null }))
    .filter(x => x.r != null)
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r)) : [];
  const strongCorr = corrItems.filter(x => Math.abs(x.r) >= 0.25);

  const stressTone = today.stress_day_summary === 'stressful' ? 'text-orange-400'
    : today.stress_day_summary === 'restored' ? 'text-primary' : 'text-white';
  const resTone = ['strong', 'exceptional'].includes(today.resilience_level) ? 'text-primary'
    : today.resilience_level === 'limited' ? 'text-orange-400' : 'text-white';

  return (
    <section className="rounded-2xl border border-white/5 bg-neutral-950/40 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Moon size={14} className="text-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Oura rozszerzone</span>
        </div>
        {open ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
      </button>

      {open && (
        <div className="p-4 pt-0 space-y-6">
          {/* ── Kafelki ─────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2.5">
            <Tile icon={Moon} label="Sleep score" value={today.sleep_score ?? '--'}
              sub={prev.sleep_score != null ? `wczoraj ${prev.sleep_score}` : null}
              tone={today.sleep_score >= 75 ? 'text-primary' : today.sleep_score >= 60 ? 'text-white' : 'text-orange-400'} />
            <Tile icon={Activity} label="Stres" tone={stressTone}
              value={today.stress_high_minutes != null ? `${Math.round(today.stress_high_minutes)}m` : '--'}
              sub={STRESS_PL[today.stress_day_summary] || null} />
            <Tile icon={Shield} label="Resilience" tone={resTone}
              value={RESILIENCE_PL[today.resilience_level] || '--'} />
            <Tile icon={Wind} label="SpO2"
              value={today.spo2_percentage != null ? `${Number(today.spo2_percentage).toFixed(1)}%` : '--'} />
            <Tile icon={HeartPulse} label="Wiek naczyń" value={today.vascular_age ?? '--'}
              sub={today.vascular_age != null ? 'lat' : null} />
            <Tile icon={Flame} label="Intensywne min" tone={dToday.vigorous_min > 0 ? 'text-orange-400' : 'text-white'}
              value={dToday.vigorous_min ?? '--'} sub={dToday.moderate_min != null ? `umiark. ${dToday.moderate_min}m` : null} />
          </div>

          {/* ── Hipnogram ───────────────────────────────────────── */}
          {phases.length > 0 && (
            <div className="space-y-2">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">Hipnogram ostatniej nocy</span>
              <div className="flex h-8 rounded-lg overflow-hidden border border-white/5">
                {phases.map((p, i) => (
                  <div key={i} className="flex-1" style={{ backgroundColor: PHASE_COLOR[p.phase] || '#262626' }} title={PHASE_LABEL[p.phase]} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {Object.keys(PHASE_LABEL).map(ph => (
                  <div key={ph} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: PHASE_COLOR[ph] }} />
                    <span className="text-[8px] font-bold uppercase text-white/40">
                      {PHASE_LABEL[ph]} {Math.round((phaseCounts[ph] || 0) * 5 / 60 * 10) / 10}h
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Strefy tętna ────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">Strefy tętna — ostatni dzień</span>
              {zToday.hr_max && <span className="text-[8px] font-bold uppercase text-white/30">max {zToday.hr_max} bpm</span>}
            </div>
            <div className="space-y-1.5">
              {zoneRows.map(z => {
                const min = zToday[z.k] || 0;
                return (
                  <div key={z.k} className="flex items-center gap-2">
                    <span className="text-[8px] font-bold uppercase text-white/40 w-16">{z.label}</span>
                    <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(min / zoneMax) * 100}%`, backgroundColor: z.color }} />
                    </div>
                    <span className="text-[9px] font-black text-white/70 w-10 text-right">{min}m</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Trendy ──────────────────────────────────────────── */}
          <div className="space-y-2">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">Sleep score & stres — 14 dni</span>
            <div className="h-36 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                  <XAxis dataKey="date" stroke="#525252" fontSize={7} />
                  <YAxis yAxisId="l" domain={[0, 100]} stroke="#3b82f6" fontSize={7} width={24} />
                  <YAxis yAxisId="r" orientation="right" stroke="#f97316" fontSize={7} width={24} />
                  <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: 10, fontSize: 10 }} />
                  <Line yAxisId="l" type="monotone" dataKey="sleep" name="Sleep score" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
                  <Line yAxisId="r" type="monotone" dataKey="stres" name="Stres (min)" stroke="#f97316" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Zależności ──────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Link2 size={11} className="text-white/30" />
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">
                Zależności {corr?.n_dni ? `(${corr.n_dni} dni)` : ''}
              </span>
            </div>
            {strongCorr.length > 0 ? (
              <div className="space-y-1.5">
                {strongCorr.map((x, i) => (
                  <div key={i} className="flex items-center justify-between bg-neutral-950/50 rounded-lg px-3 py-2 border border-white/5">
                    <span className="text-[10px] font-bold text-white/70">{x.label}</span>
                    <span className={`text-[10px] font-black ${x.r > 0 ? 'text-primary' : 'text-orange-400'}`}>
                      {x.r > 0 ? '+' : ''}{x.r}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] font-semibold text-white/30 leading-relaxed">
                Za mało danych na pewne zależności (potrzeba ~60–90 dni). Zbiera się automatycznie — wróć za jakiś czas.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
