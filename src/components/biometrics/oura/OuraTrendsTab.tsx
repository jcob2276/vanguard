/**
 * @component OuraTrendsTab
 * @role Zakładka Trendy & Moduły NOOP Power Engine z prawdziwymi korelacjami z silnika statystycznego (0 sztucznych danych).
 */
import { TrendingUp, Activity, Sparkles } from 'lucide-react';
import type { OuraHealthHubData } from './types';
import { OuraCaffeineDecayCard } from './OuraCaffeineDecayCard';
import { OuraCircadianClockCard } from './OuraCircadianClockCard';
import { OuraNightCompareCard } from './OuraNightCompareCard';
import { OuraSmartSleepCyclesCard } from './OuraSmartSleepCyclesCard';
import { OuraBiomarkerExplorerCard } from './OuraBiomarkerExplorerCard';
import { useCorrelationsQuery } from '../../../lib/correlationsApi';
import { useUserId } from '../../../store/useStore';

export function OuraTrendsTab(props: OuraHealthHubData) {
  const userId = useUserId();
  const { data: corrData, isLoading: isCorrLoading } = useCorrelationsQuery(userId, false);

  // Compute 30-day Vitals Averages from real DB history
  const history = props.ouraHistory || [];

  const validHrv = history.map((h) => h.hrv_avg).filter((v): v is number => v != null && v > 0);
  const validRhr = history.map((h) => h.rhr_avg).filter((v): v is number => v != null && v > 0);

  const hrvAvg30 = validHrv.length > 0 ? Math.round(validHrv.reduce((a, b) => a + b, 0) / validHrv.length) : null;
  const rhrAvg30 = validRhr.length > 0 ? Math.round(validRhr.reduce((a, b) => a + b, 0) / validRhr.length) : null;

  const correlations = corrData?.correlations || [];

  return (
    <div className="space-y-4 text-white animate-fadeIn">
      {/* 1. Caffeine Decay Curve Card */}
      <OuraCaffeineDecayCard />

      {/* 2. Circadian Clock Card */}
      <OuraCircadianClockCard />

      {/* 3. Night Comparison Card */}
      <OuraNightCompareCard {...props} />

      {/* 4. Smart Sleep Cycles Card */}
      <OuraSmartSleepCyclesCard />

      {/* 5. Biomarker Explorer Card */}
      <OuraBiomarkerExplorerCard {...props} />

      {/* Trends Overview Card (Dynamically computed from DB history) */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-xl">
        <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <TrendingUp size={12} className="text-teal-400" /> Trendy Vitals (Z bazy Oura)
        </h4>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 space-y-1">
            <p className="text-3xs font-bold uppercase tracking-wider text-slate-400">Średnie HRV ({history.length}d)</p>
            <p className="text-2xl font-black text-emerald-400">{hrvAvg30 !== null ? `${hrvAvg30} ms` : '--'}</p>
            <p className="text-3xs text-slate-400 font-semibold">
              {validHrv.length > 0 ? `Średnia z ${validHrv.length} zalogowanych nocy` : 'Brak danych w bazie'}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 space-y-1">
            <p className="text-3xs font-bold uppercase tracking-wider text-slate-400">Średnie RHR ({history.length}d)</p>
            <p className="text-2xl font-black text-teal-400">{rhrAvg30 !== null ? `${rhrAvg30} bpm` : '--'}</p>
            <p className="text-3xs text-slate-400 font-semibold">
              {validRhr.length > 0 ? `Średnia z ${validRhr.length} zalogowanych nocy` : 'Brak danych w bazie'}
            </p>
          </div>
        </div>
      </div>

      {/* Real Habit Correlations Engine */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-400" /> Silnik Korelacji Nawyków Vanguard
          </h4>
          <span className="text-3xs text-slate-500 font-medium">Analiza statystyczna Nightly</span>
        </div>

        <div className="space-y-2.5 text-xs">
          {isCorrLoading ? (
            <div className="p-4 text-center text-3xs text-slate-400 animate-pulse">
              Liczenie korelacji z bazy danych...
            </div>
          ) : correlations.length > 0 ? (
            correlations.slice(0, 3).map((item, idx) => (
              <div key={idx} className="p-3.5 rounded-2xl border border-white/10 bg-white/5 flex items-start gap-3">
                <Activity size={18} className="text-teal-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-white">{item.label || item.x_label}</p>
                  <p className="text-2xs text-slate-300 leading-relaxed">
                    Współczynnik $r = {item.r != null ? item.r.toFixed(2) : '--'}$, $N = {item.n ?? '--'}$ dni. {item.note || `Wpływ ${item.x_label} na ${item.y_label}.`}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 rounded-2xl border border-white/5 bg-white/5 text-center space-y-1">
              <p className="text-xs font-bold text-slate-300">Wymagana większa próba nocy</p>
              <p className="text-3xs text-slate-400 leading-normal">
                Silnik potrzebuje min. 7 nocy z zalogowanymi posiłkami i treningami, aby wyznaczyć istotną statystycznie korelację.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
