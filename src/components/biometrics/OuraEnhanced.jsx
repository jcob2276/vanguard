import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts';
import { ChevronDown, ChevronUp, Link2, Flame, Heart } from 'lucide-react';
import DataStateNotice from '../core/DataStateNotice';

// Korelacje cross-system (oura_correlations) — to czego Oura app nie ma
const CORR_LABELS = {
  trening_vs_jutro_hrv: { label: 'Trening → HRV jutro', src: 'Oura+Strava' },
  trening_vs_jutro_readiness: { label: 'Trening → Readiness jutro', src: 'Oura+Strava' },
  bialko_vs_sen: { label: 'Białko → Jakość snu', src: 'YAZIO+Oura' },
  siedzenie_vs_sen: { label: 'Siedzenie → Jakość snu', src: 'Oura' },
  kroki_vs_sen: { label: 'Kroki → Jakość snu', src: 'Oura' },
};

// Korelacje strain (strain_correlations) — composite, najmocniejszy sygnał
const STRAIN_CORR_LABELS = {
  sen_to_readiness: { label: 'Sen → Readiness', src: 'Oura' },
  kcal_to_rpe: { label: 'Kalorie → RPE biegu', src: 'YAZIO+Strava' },
  wegle_to_rpe: { label: 'Węgle → RPE biegu', src: 'YAZIO+Strava' },
  fueling_to_hr_biegu: { label: 'Fueling → HR biegu', src: 'Strain+Strava' },
  strain_to_jutro_hrv: { label: 'Strain → HRV jutro', src: 'Strain+Oura' },
  strain_to_jutro_readiness: { label: 'Strain → Readiness jutro', src: 'Strain+Oura' },
  nogi_to_jutro_hr_biegu: { label: 'Nogi → HR biegu jutro', src: 'Siłownia+Strava' },
};

export default function OuraEnhanced({ session }) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState([]);
  const [corr, setCorr] = useState(null);
  const [strainCorr, setStrainCorr] = useState(null);
  const [vascularTrend, setVascularTrend] = useState([]);
  const [loadVsRecovery, setLoadVsRecovery] = useState([]);
  const [dataIssues, setDataIssues] = useState([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const uid = session.user.id;
      const [z, c, sc, enh] = await Promise.all([
        supabase.from('oura_hr_zones_daily')
          .select('day, z1_regen_min, z2_tlenowa_min, z3_tempo_min, z4_prog_min, z5_max_min, hr_max')
          .eq('user_id', uid).order('day', { ascending: false }).limit(14),
        supabase.from('oura_correlations').select('*').eq('user_id', uid).maybeSingle(),
        supabase.from('strain_correlations').select('*').eq('user_id', uid).maybeSingle(),
        supabase.from('oura_enhanced')
          .select('date, vascular_age, readiness_score')
          .eq('user_id', uid).order('date', { ascending: false }).limit(30),
      ]);

      const issues = [
        z.error ? `oura_hr_zones_daily: ${z.error.message}` : null,
        c.error ? `oura_correlations: ${c.error.message}` : null,
        sc.error ? `strain_correlations: ${sc.error.message}` : null,
        enh.error ? `oura_enhanced: ${enh.error.message}` : null,
      ].filter(Boolean);

      setDataIssues(issues);
      setZones(z.data || []);
      setCorr(c.data || null);
      setStrainCorr(sc.data || null);

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
      setDataIssues([err.message || 'Nieznany blad pobierania danych.']);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    setTimeout(() => {
      fetchAll();
    }, 0);
  }, [fetchAll]);

  if (loading) {
    return (
      <section className="rounded-2xl border border-white/5 bg-neutral-950/40 p-4">
        <DataStateNotice
          tone="loading"
          title="Laduje trening i regeneracje"
          detail="Sprawdzam Oura, strain correlations i strefy HR."
        />
      </section>
    );
  }

  // Strefy HR — ostatnie 14 dni jako wykres słupkowy
  const zonesChart = [...zones].reverse().map(z => ({
    date: z.day.slice(5),
    regen: z.z1_regen_min || 0,
    tlenowa: z.z2_tlenowa_min || 0,
    tempo: z.z3_tempo_min || 0,
    prog: z.z4_prog_min || 0,
    max: z.z5_max_min || 0,
  }));

  // Zależności — łączymy strain_correlations (mocniejsze) + oura_correlations
  const fromStrain = strainCorr
    ? Object.entries(STRAIN_CORR_LABELS).map(([k, m]) => ({ ...m, r: strainCorr[k] != null ? Number(strainCorr[k]) : null }))
    : [];
  const fromOura = corr
    ? Object.entries(CORR_LABELS).map(([k, m]) => ({ ...m, r: corr[k] != null ? Number(corr[k]) : null }))
    : [];
  const corrItems = [...fromStrain, ...fromOura]
    .filter(x => x.r != null && Math.abs(x.r) >= 0.25)
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  const corrN = strainCorr?.n_dni || corr?.n_dni;
  const dataNotices = [
    zones.length === 0 ? 'Brak stref HR z ostatnich 14 dni.' : null,
    vascularTrend.length < 3 ? 'Wiek naczyniowy: za malo punktow na trend.' : null,
    loadVsRecovery.length < 2 ? 'Z4/Z5 vs readiness: za malo dni do wykresu.' : null,
    !corrN ? 'Korelacje: brak widoku albo brak danych.' : null,
    corrN && corrN < 60 ? `Korelacje: n=${corrN}, sensowny prog to 60-90 dni.` : null,
  ].filter(Boolean);

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
          {dataIssues.length > 0 && (
            <DataStateNotice
              tone="warning"
              title="Czesc danych niedostepna"
              detail={dataIssues.join(' | ')}
            />
          )}

          {dataNotices.length > 0 && (
            <DataStateNotice
              title="Status danych"
              detail={dataNotices.join(' | ')}
            />
          )}

          {/* ── Strefy HR — 14 dni ──────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">
              Strefy tętna — 14 dni (min)
            </p>
            {zonesChart.length === 0 && (
              <DataStateNotice
                title="Brak stref HR"
                detail="Uruchom sync-oura-timeseries albo poczekaj na dane z Oura."
              />
            )}
            <div className={`h-40 -ml-2 ${zonesChart.length === 0 ? 'hidden' : ''}`}>
              <ResponsiveContainer width="100%" height={160} minWidth={0}>
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
            <div className={`flex gap-4 flex-wrap ${zonesChart.length === 0 ? 'hidden' : ''}`}>
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
                <ResponsiveContainer width="100%" height={144} minWidth={0}>
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
                <ResponsiveContainer width="100%" height={112} minWidth={0}>
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
                Zależności cross-system {corrN ? `· ${corrN} dni` : ''}
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
                      <p className={`text-sm font-black ${Math.abs(x.r) >= 0.4 ? 'text-primary' : 'text-white/55'}`}>
                        {x.r > 0 ? '+' : ''}{x.r}
                      </p>
                      <p className="text-[7px] uppercase text-white/25">
                        {Math.abs(x.r) >= 0.4 ? 'mocna' : 'umiark.'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-neutral-950/40 border border-white/5 rounded-xl p-4">
                <p className="text-[10px] font-semibold text-white/35 leading-relaxed">
                  Zbiera się automatycznie — potrzeba ~60–90 dni danych.
                  Dziś masz {corrN ?? 0} dni.
                </p>
              </div>
            )}
          </div>

        </div>
      )}
    </section>
  );
}
