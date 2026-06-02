import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts';
import { ChevronDown, ChevronUp, Link2, Flame, Heart } from 'lucide-react';

// Korelacje które łączą dane z RÓŻNYCH źródeł — to czego Oura app nie ma
const CORR_LABELS = {
  trening_vs_jutro_hrv: { label: 'Trening → HRV jutro', src: 'Oura+Strava' },
  trening_vs_jutro_readiness: { label: 'Trening → Readiness jutro', src: 'Oura+Strava' },
  trening_vs_jutro_stres: { label: 'Trening → Stres jutro', src: 'Oura+Strava' },
  bialko_vs_sen: { label: 'Białko → Jakość snu', src: 'YAZIO+Oura' },
  kalorie_vs_jutro_hrv: { label: 'Kalorie → HRV jutro', src: 'YAZIO+Oura' },
  siedzenie_vs_sen: { label: 'Siedzenie → Jakość snu', src: 'Oura' },
  kroki_vs_sen: { label: 'Kroki → Jakość snu', src: 'Oura' },
};

export default function OuraEnhanced({ session }) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState([]);
  const [corr, setCorr] = useState(null);
  const [vascularTrend, setVascularTrend] = useState([]);
  const [loadVsRecovery, setLoadVsRecovery] = useState([]);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const uid = session.user.id;
      const [z, c, enh] = await Promise.all([
        supabase.from('oura_hr_zones_daily')
          .select('day, z1_regen_min, z2_tlenowa_min, z3_tempo_min, z4_prog_min, z5_max_min, hr_max')
          .eq('user_id', uid).order('day', { ascending: false }).limit(14),
        supabase.from('oura_correlations').select('*').eq('user_id', uid).maybeSingle(),
        supabase.from('oura_enhanced')
          .select('date, vascular_age, readiness_score')
          .eq('user_id', uid).order('date', { ascending: false }).limit(30),
      ]);

      setZones(z.data || []);
      setCorr(c.data);

      // Wiek naczyniowy — trend w czasie (tylko dni gdzie mamy wartość)
      const vt = (enh.data || [])
        .filter(r => r.vascular_age != null)
        .reverse()
        .map(r => ({ date: r.date.slice(5), age: r.vascular_age }));
      setVascularTrend(vt);

      // Obciążenie treningowe vs Readiness nazajutrz
      const enhData = (enh.data || []).reverse();
      const lvr = enhData.map((r, i) => {
        const nextDay = enhData[i + 1];
        const zDay = (z.data || []).find(zd => zd.day === r.date);
        const intensiveMin = zDay ? ((zDay.z4_prog_min || 0) + (zDay.z5_max_min || 0)) : 0;
        return {
          date: r.date.slice(5),
          load: intensiveMin,
          jutro_readiness: nextDay?.readiness_score ?? null,
        };
      }).filter(r => r.load > 0 || r.jutro_readiness != null);
      setLoadVsRecovery(lvr.slice(-14));

    } catch (err) {
      console.error('OuraEnhanced:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return null;

  // Strefy HR — ostatnie 14 dni jako wykres słupkowy
  const zonesChart = [...zones].reverse().map(z => ({
    date: z.day.slice(5),
    regen: z.z1_regen_min || 0,
    tlenowa: z.z2_tlenowa_min || 0,
    tempo: z.z3_tempo_min || 0,
    prog: z.z4_prog_min || 0,
    max: z.z5_max_min || 0,
  }));

  // Zależności — tylko cross-system + |r| >= 0.2
  const corrItems = corr
    ? Object.entries(CORR_LABELS)
        .map(([k, meta]) => ({ ...meta, r: corr[k] != null ? Number(corr[k]) : null }))
        .filter(x => x.r != null && Math.abs(x.r) >= 0.2)
        .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    : [];

  const tooltipStyle = {
    backgroundColor: '#0a0a0a',
    border: '1px solid #262626',
    borderRadius: 10,
    fontSize: 10,
  };

  return (
    <section className="rounded-2xl border border-white/5 bg-neutral-950/40 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Flame size={14} className="text-orange-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Trening & Regeneracja</span>
        </div>
        {open
          ? <ChevronUp size={16} className="text-white/40" />
          : <ChevronDown size={16} className="text-white/40" />}
      </button>

      {open && (
        <div className="px-4 pb-5 space-y-7">

          {/* ── Strefy HR — 14 dni ──────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">
              Strefy tętna — 14 dni (min)
            </p>
            <div className="h-40 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={zonesChart} barSize={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                  <XAxis dataKey="date" stroke="#525252" fontSize={7} />
                  <YAxis stroke="#525252" fontSize={7} width={22} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="tlenowa" name="Z2 Tlenowa" stackId="a" fill="#84cc16" radius={[0,0,0,0]} />
                  <Bar dataKey="tempo"   name="Z3 Tempo"   stackId="a" fill="#eab308" />
                  <Bar dataKey="prog"    name="Z4 Próg"    stackId="a" fill="#f97316" />
                  <Bar dataKey="max"     name="Z5 Max"     stackId="a" fill="#ef4444" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 flex-wrap">
              {[['Z2', '#84cc16'], ['Z3', '#eab308'], ['Z4', '#f97316'], ['Z5', '#ef4444']].map(([z, c]) => (
                <div key={z} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: c }} />
                  <span className="text-[8px] font-bold text-white/40">{z}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Obciążenie vs Readiness nazajutrz ───────────────── */}
          {loadVsRecovery.length > 1 && (
            <div className="space-y-2">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">
                Min. intensywnych (Z4+Z5) → Readiness następnego dnia
              </p>
              <div className="h-36 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={loadVsRecovery}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis dataKey="date" stroke="#525252" fontSize={7} />
                    <YAxis yAxisId="l" stroke="#f97316" fontSize={7} width={22} />
                    <YAxis yAxisId="r" orientation="right" domain={[50, 100]} stroke="#3b82f6" fontSize={7} width={22} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar yAxisId="l" dataKey="load" name="Min. intensywne" fill="#f97316" opacity={0.7} barSize={10} />
                    <Line yAxisId="r" type="monotone" dataKey="jutro_readiness" name="Readiness jutro"
                      stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Wiek naczyniowy — trend ──────────────────────────── */}
          {vascularTrend.length >= 3 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Heart size={11} className="text-white/30" />
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">Wiek naczyniowy — trend</p>
              </div>
              <div className="h-28 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={vascularTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis dataKey="date" stroke="#525252" fontSize={7} />
                    <YAxis domain={['dataMin - 2', 'dataMax + 2']} stroke="#525252" fontSize={7} width={22} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <ReferenceLine y={23} stroke="#3b82f6" strokeDasharray="4 4"
                      label={{ value: 'wiek', position: 'right', fill: '#3b82f6', fontSize: 8 }} />
                    <Line type="monotone" dataKey="age" name="Wiek naczyń" stroke="#a855f7"
                      strokeWidth={2} dot={{ r: 2, fill: '#a855f7' }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Zależności cross-system ───────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Link2 size={11} className="text-white/30" />
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">
                Zależności cross-system {corr?.n_dni ? `· ${corr.n_dni} dni` : ''}
              </p>
            </div>
            {corrItems.length > 0 ? (
              <div className="space-y-1.5">
                {corrItems.map((x, i) => (
                  <div key={i} className="flex items-center gap-2 bg-neutral-950/60 border border-white/5 rounded-xl px-3 py-2.5">
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-white/80">{x.label}</p>
                      <p className="text-[8px] font-bold text-white/25 uppercase tracking-wider">{x.src}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black ${Math.abs(x.r) >= 0.4 ? (x.r > 0 ? 'text-primary' : 'text-orange-400') : 'text-white/60'}`}>
                        {x.r > 0 ? '+' : ''}{x.r}
                      </p>
                      <p className="text-[7px] uppercase text-white/25">
                        {Math.abs(x.r) >= 0.4 ? 'mocna' : 'słaba'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-neutral-950/40 border border-white/5 rounded-xl p-4">
                <p className="text-[10px] font-semibold text-white/35 leading-relaxed">
                  Zbiera się automatycznie — potrzeba ~60–90 dni danych.
                  Dziś masz {corr?.n_dni ?? 0} dni.
                </p>
              </div>
            )}
          </div>

        </div>
      )}
    </section>
  );
}
