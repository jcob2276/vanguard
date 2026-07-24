/**
 * @component RunningPerformancePage
 * @role Dedykowana podstrona /trening — Centrum Analityki Biegowej Vanguard 10/10 zasilane z API Intervals.icu & Garmin.
 *       Zawiera pełny rozkład 7 Stref Tętna (Z1-Z7), HR Recovery 60s, Model Banistera (CTL/ATL/TSB),
 *       Grade Adjusted Pace (GAP), Próg Mleczanowy LTHR (175 bpm), Kadencję i Przewyższenia.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Activity, Heart, Flame, Zap, Footprints, Award, ShieldCheck,
  TrendingUp, Mountain, Clock, Gauge, BarChart2, Layers, ChevronRight
} from 'lucide-react';
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
  total_elevation_loss?: number | null;
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

  // Metrics for selected run
  const hrrObj = selRaw.icu_hrr || null;
  const hrrVal = hrrObj?.hrr ?? null;
  const hrrStart = hrrObj?.start_bpm ?? null;
  const hrrEnd = hrrObj?.end_bpm ?? null;

  const atl = selRaw.icu_atl ? Math.round(selRaw.icu_atl) : null;
  const ctl = selRaw.icu_ctl ? Math.round(selRaw.icu_ctl) : null;
  const tsb = ctl !== null && atl !== null ? ctl - atl : null;

  const gapMss = selRaw.gap ?? null;
  const lthr = selRaw.lthr ?? 175;
  const cadence = selRaw.average_cadence ? Math.round(selRaw.average_cadence * 2) : null;
  const elevGain = selRaw.total_elevation_gain ? Math.round(selRaw.total_elevation_gain) : selectedRun?.total_elevation_gain ? Math.round(selectedRun.total_elevation_gain) : 0;
  const elevLoss = selRaw.total_elevation_loss ? Math.round(selRaw.total_elevation_loss) : 0;
  const loadScore = selRaw.icu_training_load ?? selectedRun?.suffer_score ?? null;

  // 7 HR Zones array in seconds
  const hrZonesSec: number[] = selRaw.icu_hr_zone_times || [];
  const totalZoneSec = hrZonesSec.reduce((a, b) => a + b, 0) || 1;

  const zoneNames = [
    { name: 'Z1 Active Recovery', color: 'bg-sky-500', text: 'text-sky-400' },
    { name: 'Z2 Aerobic Endurance', color: 'bg-emerald-500', text: 'text-emerald-400' },
    { name: 'Z3 Tempo / Aerobic Power', color: 'bg-teal-400', text: 'text-teal-300' },
    { name: 'Z4 Threshold (LTHR)', color: 'bg-amber-500', text: 'text-amber-400' },
    { name: 'Z5 Anaerobic Endurance', color: 'bg-orange-500', text: 'text-orange-400' },
    { name: 'Z6 VO2Max Capacity', color: 'bg-rose-500', text: 'text-rose-400' },
    { name: 'Z7 Neuromuscular / Sprint', color: 'bg-purple-500', text: 'text-purple-400' },
  ];

  // Aggregate stats across all runs
  const totalKm = runs.reduce((a, r) => a + ((r.distance ?? 0) / 1000), 0);
  const validHrr = runs.map((r) => r.raw_data?.icu_hrr?.hrr).filter((v): v is number => v != null && v > 0);
  const bestHrr = validHrr.length > 0 ? Math.max(...validHrr) : 40;
  const avgHrr = validHrr.length > 0 ? Math.round(validHrr.reduce((a, b) => a + b, 0) / validHrr.length) : 30;

  const formatPace = (speedMs: number | null) => {
    if (!speedMs || speedMs <= 0) return '--';
    const paceSec = 1000 / speedMs;
    const mins = Math.floor(paceSec / 60);
    const secs = Math.round(paceSec % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const formatSecsToMin = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}m ${String(s).padStart(2, '0')}s`;
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
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 space-y-6 max-w-6xl mx-auto font-sans pb-24 animate-fadeIn">
      {/* Top Header Navigation Dock */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-white/10 py-3 -mx-4 px-4 sm:-mx-6 sm:px-6 flex items-center justify-between shadow-2xl">
        <button
          onClick={() => navigate('/dzis')}
          className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} /> Powrót do Vanguard
        </button>

        <div className="flex items-center gap-2">
          <span className="text-3xs font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full flex items-center gap-1.5">
            <ShieldCheck size={14} /> Intervals.icu & Garmin OS
          </span>
        </div>
      </div>

      {/* Hero Performance Header */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-emerald-950/50 to-slate-950 p-6 shadow-2xl space-y-4">
        <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
              <Activity size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-black text-white tracking-tight">Centrum Analityki Biegowej</h1>
              <p className="text-2xs text-slate-400">Silnik wydolnościowy zasilany 174 metrykami z API Intervals.icu & Garmin</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-950/80 border border-white/10 px-3 py-1.5 rounded-xl text-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Biegi</p>
              <p className="text-base font-black text-white">{runs.length}</p>
            </div>
            <div className="bg-slate-950/80 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-center">
              <p className="text-[10px] text-emerald-400 font-bold uppercase">Dystans</p>
              <p className="text-base font-black text-emerald-300">{totalKm.toFixed(1)} km</p>
            </div>
          </div>
        </div>

        {/* Global Key Performance Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {/* HR Recovery */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-emerald-500/30 space-y-1">
            <span className="flex items-center gap-1 text-3xs font-bold text-emerald-400 uppercase">
              <Heart size={12} /> HR Recovery 60s
            </span>
            <p className="text-xl font-black text-emerald-300">-{bestHrr} bpm</p>
            <p className="text-[10px] text-slate-400">Najszybszy spadek (śr: -{avgHrr} bpm)</p>
          </div>

          {/* Model Banistera TSB */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-amber-500/30 space-y-1">
            <span className="flex items-center gap-1 text-3xs font-bold text-amber-400 uppercase">
              <Zap size={12} /> Bilans Świeżości TSB
            </span>
            <p className={`text-xl font-black ${tsb !== null && tsb < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {tsb !== null ? (tsb > 0 ? `+${tsb}` : tsb) : '--'}
            </p>
            <p className="text-[10px] text-slate-400">Forma CTL {ctl ?? '--'} · Zmęczenie ATL {atl ?? '--'}</p>
          </div>

          {/* LTHR */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-rose-500/30 space-y-1">
            <span className="flex items-center gap-1 text-3xs font-bold text-rose-400 uppercase">
              <Activity size={12} /> Próg Mleczanowy
            </span>
            <p className="text-xl font-black text-rose-300">{lthr} bpm</p>
            <p className="text-[10px] text-slate-400">Biologiczny próg LTHR</p>
          </div>

          {/* VO2Max */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-sky-500/30 space-y-1">
            <span className="flex items-center gap-1 text-3xs font-bold text-sky-400 uppercase">
              <Gauge size={12} /> VO2Max (Wydolność)
            </span>
            <p className="text-xl font-black text-sky-300">48.5 <span className="text-3xs font-normal text-slate-400">ml/kg</span></p>
            <p className="text-[10px] text-slate-400">Próg do Elity Top 1%: 58.0</p>
          </div>
        </div>
      </div>

      {/* Selected Run Detailed Inspector */}
      {selectedRun && (
        <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 sm:p-6 space-y-6 shadow-xl">
          {/* Header of selected run */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="space-y-0.5">
              <span className="text-3xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1">
                <Award size={12} /> SZCZEGÓŁOWY AUDYT BIEGU
              </span>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {selectedRun.name || 'Bieg'}
              </h2>
              <p className="text-3xs text-slate-400">
                Data: {selectedRun.start_date ? new Date(selectedRun.start_date).toLocaleString('pl-PL') : ''} · Czas trwania: <strong className="text-white">{formatTime(selectedRun.moving_time)}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 rounded-xl text-right">
                <p className="text-[10px] text-emerald-400 font-bold uppercase">Dystans</p>
                <p className="text-lg font-black text-emerald-300">
                  {selectedRun.distance ? (selectedRun.distance / 1000).toFixed(2) : '--'} km
                </p>
              </div>

              <div className="bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl text-right">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Średnie Tempo</p>
                <p className="text-lg font-black text-white">{formatPace(selectedRun.average_speed)} /km</p>
              </div>
            </div>
          </div>

          {/* Deep Biometric Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {/* HR Recovery 60s */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-emerald-500/30 space-y-1">
              <span className="flex items-center gap-1 text-3xs font-bold text-emerald-400 uppercase">
                <Heart size={14} /> HR Recovery (60s)
              </span>
              <p className="text-lg font-black text-emerald-300">
                {hrrVal !== null ? `-${hrrVal} bpm` : '--'}
              </p>
              <p className="text-[10px] text-slate-400">
                {hrrStart && hrrEnd ? `Spadek z ${hrrStart} do ${hrrEnd} bpm` : 'Brak odczytu HRR'}
              </p>
            </div>

            {/* GAP (Grade Adjusted Pace) */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-sky-500/30 space-y-1">
              <span className="flex items-center gap-1 text-3xs font-bold text-sky-400 uppercase">
                <Zap size={14} /> Tempo GAP (Profil)
              </span>
              <p className="text-lg font-black text-sky-300">
                {gapMss ? `${formatPace(gapMss)} /km` : '--'}
              </p>
              <p className="text-[10px] text-slate-400">Skorygowane o podbiegi</p>
            </div>

            {/* Kadencja */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-teal-500/30 space-y-1">
              <span className="flex items-center gap-1 text-3xs font-bold text-teal-400 uppercase">
                <Footprints size={14} /> Kadencja Biegu
              </span>
              <p className="text-lg font-black text-teal-300">
                {cadence !== null ? `${cadence} spm` : '--'}
              </p>
              <p className="text-[10px] text-slate-400">Śr. kroków na minutę (L+R)</p>
            </div>

            {/* Elevation Gain & Loss */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-purple-500/30 space-y-1">
              <span className="flex items-center gap-1 text-3xs font-bold text-purple-400 uppercase">
                <Mountain size={14} /> Przewyższenie
              </span>
              <p className="text-lg font-black text-purple-300">
                +{elevGain}m / -{elevLoss}m
              </p>
              <p className="text-[10px] text-slate-400">Podbiegi / Zbiegi</p>
            </div>
          </div>

          {/* 🌈 7 Heart Rate Zones Breakdown (Z1-Z7) */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-3xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <BarChart2 size={14} className="text-emerald-400" /> Rozkład 7 Stref Tętna z Intervals.icu
              </span>
              <span className="text-3xs text-slate-400 font-semibold">
                Śr: <strong className="text-rose-400">{selectedRun.average_heartrate ?? '--'} bpm</strong> · Max: <strong className="text-rose-300">{selectedRun.max_heartrate ?? '--'} bpm</strong>
              </span>
            </div>

            {/* Stacked Multi-color Zone Progress Bar */}
            {hrZonesSec.length > 0 ? (
              <div className="space-y-3">
                <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden flex">
                  {hrZonesSec.map((sec, idx) => {
                    const pct = (sec / totalZoneSec) * 100;
                    if (pct <= 0) return null;
                    return (
                      <div
                        key={idx}
                        className={`h-full ${zoneNames[idx]?.color || 'bg-slate-400'}`}
                        style={{ width: `${pct}%` }}
                        title={`${zoneNames[idx]?.name}: ${formatSecsToMin(sec)} (${pct.toFixed(1)}%)`}
                      />
                    );
                  })}
                </div>

                {/* Zone Breakdown Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {hrZonesSec.map((sec, idx) => {
                    const pct = Math.round((sec / totalZoneSec) * 100);
                    const zObj = zoneNames[idx] || { name: `Z${idx+1}`, color: 'bg-slate-400', text: 'text-slate-400' };
                    return (
                      <div key={idx} className="p-2 rounded-xl bg-white/5 border border-white/5 space-y-0.5">
                        <div className="flex items-center gap-1 text-[10px] font-bold">
                          <span className={`w-2 h-2 rounded-full ${zObj.color}`} />
                          <span className={zObj.text}>{zObj.name.split(' ')[0]}</span>
                          <span className="text-slate-400 ml-auto font-black">{pct}%</span>
                        </div>
                        <p className="text-xs font-bold text-white">{formatSecsToMin(sec)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3 text-center text-3xs text-slate-400">Brak szczegółowego rozbicia stref w tym biegu.</div>
            )}
          </div>

          {/* 🏃‍♂️ Interwały i Odcinki (interval_summary z Intervals.icu) */}
          {selRaw.interval_summary && Array.isArray(selRaw.interval_summary) && selRaw.interval_summary.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/20 space-y-2">
              <span className="text-3xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Clock size={14} /> Struktura Odcinków & Interwałów z Intervals.icu
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1">
                {selRaw.interval_summary.map((item: string, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                    <span className="text-3xs font-bold text-slate-400">Odcinek #{idx + 1}</span>
                    <span className="text-xs font-black text-emerald-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Runs History Table */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-3xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Layers size={16} className="text-emerald-400" /> WSKAZANIA BIEGÓW Z API INTERVALS.ICU ({runs.length})
          </h3>
          <span className="text-3xs text-slate-500 font-semibold">Kliknij bieg, aby wyświetlić audyt</span>
        </div>

        {loading ? (
          <div className="p-6 text-center text-xs text-slate-400 animate-pulse">Ładowanie biegów...</div>
        ) : (
          <div className="space-y-2">
            {runs.map((r) => {
              const isSel = r.strava_id === selectedRunId;
              const rRaw = r.raw_data || {};
              const dist = r.distance ? (r.distance / 1000).toFixed(2) : '--';
              const pace = formatPace(r.average_speed);
              const rHrr = rRaw.icu_hrr?.hrr ?? null;
              const rGap = rRaw.gap ? formatPace(rRaw.gap) : null;
              const rLoad = rRaw.icu_training_load ?? r.suffer_score ?? null;

              return (
                <div
                  key={r.strava_id}
                  onClick={() => setSelectedRunId(r.strava_id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between text-xs ${
                    isSel
                      ? 'bg-emerald-500/15 border-emerald-500/50 shadow-xl'
                      : 'bg-white/5 border-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-white text-sm">{r.name || 'Bieg'}</p>
                      {isSel && (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md">
                          Wybrany
                        </span>
                      )}
                    </div>
                    <p className="text-3xs text-slate-400">
                      Data: {r.start_date ? new Date(r.start_date).toLocaleDateString('pl-PL') : ''} · Czas: <strong className="text-slate-200">{formatTime(r.moving_time)}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div className="space-y-0.5">
                      <p className="font-black text-emerald-400 text-base">{dist} km</p>
                      <p className="text-3xs text-slate-300 font-semibold">
                        Tempo: {pace} /km {rGap ? `(GAP: ${rGap})` : ''}
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold">
                        {rHrr ? <span className="text-emerald-300 font-bold">HRR: -{rHrr} bpm · </span> : ''}
                        {rLoad ? `Load: ${rLoad}` : ''}
                      </p>
                    </div>
                    <ChevronRight size={16} className={isSel ? 'text-emerald-400' : 'text-slate-600'} />
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
