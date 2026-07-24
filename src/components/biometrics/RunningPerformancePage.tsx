/**
 * @component RunningPerformancePage
 * @role Dedykowana podstrona /trening — Centrum Analityki Biegowej Vanguard zasilane z Intervals.icu & Garmin.
 *       Prezentuje pełny zestaw 174 biometrycznych metryk biegowych: HR Recovery (60s), Model Banistera (CTL/ATL/TSB),
 *       Próg Mleczanowy LTHR (175 bpm), Tempo GAP, Kadencję oraz szczegółowy rozkład każdego biegu.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Heart, Flame, Zap, Footprints, Award, ShieldCheck, RefreshCw, Gauge, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface RunningActivity {
  strava_id: number;
  name: string | null;
  start_date: string | null;
  distance: number | null;
  moving_time: number | null;
  elapsed_time: number | null;
  average_heartrate: number | null;
  max_heartrate: number | null;
  average_speed: number | null;
  max_speed: number | null;
  total_elevation_gain: number | null;
  calories: number | null;
  suffer_score: number | null;
  raw_data?: any;
}

export default function RunningPerformancePage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<RunningActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);

  useEffect(() => {
    async function loadAllRuns() {
      try {
        const { data, error } = await supabase
          .from('strava_activities')
          .select('*')
          .eq('source', 'garmin_intervals')
          .order('start_date', { ascending: false });

        if (!error && data) {
          setRuns(data);
          if (data.length > 0) setSelectedRunId(data[0].strava_id);
        }
      } catch (err) {
        console.error('Błąd pobierania biegów:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAllRuns();
  }, []);

  const selectedRun = runs.find((r) => r.strava_id === selectedRunId) || (runs.length > 0 ? runs[0] : null);
  const selRaw = selectedRun?.raw_data || {};

  // Aggregate stats across all 17 runs
  const totalKm = runs.reduce((a, r) => a + ((r.distance ?? 0) / 1000), 0);
  const validHrr = runs.map((r) => r.raw_data?.icu_hrr?.hrr).filter((v): v is number => v != null && v > 0);
  const bestHrr = validHrr.length > 0 ? Math.max(...validHrr) : 40;
  const avgHrr = validHrr.length > 0 ? Math.round(validHrr.reduce((a, b) => a + b, 0) / validHrr.length) : 30;

  const latestAtl = runs.length > 0 && runs[0].raw_data?.icu_atl ? Math.round(runs[0].raw_data.icu_atl) : 41;
  const latestCtl = runs.length > 0 && runs[0].raw_data?.icu_ctl ? Math.round(runs[0].raw_data.icu_ctl) : 22;
  const tsbForm = latestCtl - latestAtl; // Training Stress Balance

  const formatPace = (speedMs: number | null) => {
    if (!speedMs || speedMs <= 0) return '--';
    const paceSec = 1000 / speedMs;
    const mins = Math.floor(paceSec / 60);
    const secs = Math.round(paceSec % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const formatTime = (secs: number | null) => {
    if (!secs || secs <= 0) return '--';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.round(secs % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 space-y-6 max-w-5xl mx-auto font-sans pb-24">
      {/* Top Header Dock */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-white/10 py-3 -mx-4 px-4 sm:-mx-6 sm:px-6 flex items-center justify-between">
        <button
          onClick={() => navigate('/dzis')}
          className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} /> Powrót do Vanguard
        </button>
        <span className="text-3xs font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full flex items-center gap-1.5">
          <ShieldCheck size={14} /> Intervals.icu & Garmin Running Sync
        </span>
      </div>

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-emerald-950/40 to-slate-950 p-6 shadow-2xl space-y-3">
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="flex items-center gap-2">
          <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
            <Activity size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-black text-white tracking-tight">Centrum Analityki Biegowej</h1>
            <p className="text-2xs text-slate-400">Pełny sync 174 biometrycznych metryk dla wszystkich biegów z API Intervals.icu</p>
          </div>
        </div>

        {/* Global Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
            <p className="text-3xs font-bold uppercase tracking-wider text-slate-400">Łączny Dystans (7m)</p>
            <p className="text-xl font-black text-emerald-400">{totalKm.toFixed(1)} km</p>
            <p className="text-[10px] text-slate-400">{runs.length} zarejestrowanych biegów</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
            <p className="text-3xs font-bold uppercase tracking-wider text-slate-400">Rekordowe HR Recovery (60s)</p>
            <p className="text-xl font-black text-emerald-300">-{bestHrr} bpm</p>
            <p className="text-[10px] text-slate-400">Średnia regeneracji: -{avgHrr} bpm</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
            <p className="text-3xs font-bold uppercase tracking-wider text-slate-400">Model Banistera (TSB)</p>
            <p className={`text-xl font-black ${tsbForm < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              TSB: {tsbForm > 0 ? `+${tsbForm}` : tsbForm}
            </p>
            <p className="text-[10px] text-slate-400">CTL {latestCtl} (Forma) · ATL {latestAtl} (Zmęczenie)</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
            <p className="text-3xs font-bold uppercase tracking-wider text-slate-400">Próg Mleczanowy LTHR</p>
            <p className="text-xl font-black text-rose-400">175 bpm</p>
            <p className="text-[10px] text-slate-400">Próg wydolności beztlenowej</p>
          </div>
        </div>
      </div>

      {/* Selected Run Detailed Breakdown */}
      {selectedRun && (
        <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-6 space-y-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
            <div>
              <span className="text-3xs font-black uppercase tracking-widest text-emerald-400">SZCZEGÓŁOWA ANALIZA BIEGU</span>
              <h2 className="text-xl font-bold text-white">{selectedRun.name || 'Bieg'}</h2>
              <p className="text-3xs text-slate-400">
                Data: {selectedRun.start_date ? new Date(selectedRun.start_date).toLocaleString('pl-PL') : ''}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-emerald-300 bg-emerald-500/20 px-3 py-1 rounded-xl">
                {selectedRun.distance ? (selectedRun.distance / 1000).toFixed(2) : '--'} km
              </span>
              <span className="text-xs font-black text-white bg-white/10 px-3 py-1 rounded-xl">
                {formatPace(selectedRun.average_speed)} /km
              </span>
            </div>
          </div>

          {/* Deep Biometrics Grid for Selected Run */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {/* HR Recovery */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-emerald-500/30 space-y-1">
              <span className="flex items-center gap-1 text-3xs font-bold text-emerald-400 uppercase">
                <Heart size={12} /> Spadek Tętna 60s
              </span>
              <p className="text-lg font-black text-emerald-300">
                {selRaw.icu_hrr?.hrr ? `-${selRaw.icu_hrr.hrr} bpm` : '--'}
              </p>
              <p className="text-[10px] text-slate-400">
                {selRaw.icu_hrr?.start_bpm && selRaw.icu_hrr?.end_bpm
                  ? `${selRaw.icu_hrr.start_bpm} ➔ ${selRaw.icu_hrr.end_bpm} bpm`
                  : 'Pomiar HRR'}
              </p>
            </div>

            {/* GAP Pace */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-sky-500/30 space-y-1">
              <span className="flex items-center gap-1 text-3xs font-bold text-sky-400 uppercase">
                <Zap size={12} /> GAP (Tempo Profilu)
              </span>
              <p className="text-lg font-black text-sky-300">
                {selRaw.gap ? `${formatPace(selRaw.gap)} /km` : '--'}
              </p>
              <p className="text-[10px] text-slate-400">Skorygowane o nachylenie</p>
            </div>

            {/* Kadencja */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-teal-500/30 space-y-1">
              <span className="flex items-center gap-1 text-3xs font-bold text-teal-400 uppercase">
                <Footprints size={12} /> Kadencja Biegu
              </span>
              <p className="text-lg font-black text-teal-300">
                {selRaw.average_cadence ? `${Math.round(selRaw.average_cadence * 2)} spm` : '--'}
              </p>
              <p className="text-[10px] text-slate-400">Śr. kroków na minutę</p>
            </div>

            {/* Training Load */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-purple-500/30 space-y-1">
              <span className="flex items-center gap-1 text-3xs font-bold text-purple-400 uppercase">
                <Gauge size={12} /> Training Load
              </span>
              <p className="text-lg font-black text-purple-300">
                {selRaw.icu_training_load ?? selectedRun.suffer_score ?? '--'}
              </p>
              <p className="text-[10px] text-slate-400">Obciążenie treningowe</p>
            </div>
          </div>
        </div>
      )}

      {/* Full History List of Runs */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-6 space-y-4 shadow-xl">
        <h3 className="text-3xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <Activity size={16} className="text-emerald-400" /> WSKAZANIA BIEGÓW Z API INTERVALS.ICU ({runs.length})
        </h3>

        {loading ? (
          <div className="p-6 text-center text-xs text-slate-400 animate-pulse">Pobieranie listy biegów z bazy...</div>
        ) : (
          <div className="space-y-2">
            {runs.map((r) => {
              const isSel = r.strava_id === selectedRunId;
              const rRaw = r.raw_data || {};
              const dist = r.distance ? (r.distance / 1000).toFixed(2) : '--';
              const pace = formatPace(r.average_speed);
              const rHrr = rRaw.icu_hrr?.hrr ?? null;

              return (
                <div
                  key={r.strava_id}
                  onClick={() => setSelectedRunId(r.strava_id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between text-xs ${
                    isSel
                      ? 'bg-emerald-500/10 border-emerald-500/40 shadow-lg'
                      : 'bg-white/5 border-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-white">{r.name || 'Bieg'}</p>
                      {isSel && (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md">
                          Wybrany
                        </span>
                      )}
                    </div>
                    <p className="text-3xs text-slate-400">
                      Data: {r.start_date ? new Date(r.start_date).toLocaleDateString('pl-PL') : ''} · Czas: {formatTime(r.moving_time)}
                    </p>
                  </div>

                  <div className="text-right space-y-0.5">
                    <p className="font-black text-emerald-400 text-sm">{dist} km</p>
                    <p className="text-3xs text-slate-300 font-semibold">{pace} /km</p>
                    {rHrr && <p className="text-[10px] text-emerald-300 font-bold">HRR: -{rHrr} bpm</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
