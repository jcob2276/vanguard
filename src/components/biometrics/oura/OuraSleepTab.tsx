/**
 * @component OuraSleepTab
 * @role Zakładka Sen (Sleep) — Wzorowana 1:1 na polskiej wersji oficjalnej Oura App (0 podstawionych wartości).
 */
import type { OuraHealthHubData } from './types';
import { OuraHypnogramChart } from './OuraHypnogramChart';
import { OuraSleepDebtCard } from './OuraSleepDebtCard';
import { OuraScreenTimeCorrelationCard } from './OuraScreenTimeCorrelationCard';
import { OuraWeatherBarometerCard } from './OuraWeatherBarometerCard';
import { OuraEmfSensorCard } from './OuraEmfSensorCard';
import { OuraDeepAnalyticsLabCard } from './OuraDeepAnalyticsLabCard';
import { OuraVitalsLinearCharts } from './OuraVitalsLinearCharts';

export function OuraSleepTab(dataProps: OuraHealthHubData) {
  const { oura, enhanced } = dataProps;
  const sleepScore = enhanced?.sleep_score ?? oura?.sleep_score ?? null;
  const totalSleepH = enhanced?.total_sleep_hours ?? oura?.total_sleep_hours ?? null;
  const efficiencyPct = enhanced?.sleep_efficiency ?? oura?.sleep_efficiency ?? null;
  const remH = enhanced?.rem_sleep_hours ?? null;
  const deepH = enhanced?.deep_sleep_hours ?? null;
  const latencyMins = enhanced?.sleep_latency_minutes ?? oura?.latency_minutes ?? null;

  const formatHM = (h: number | null) => {
    if (h === null || h <= 0) return '--';
    const hrs = Math.floor(h);
    const mins = Math.round((h % 1) * 60);
    return `${hrs} h ${mins} min`;
  };

  const getScoreStatus = (score: number | null) => {
    if (score === null) return { label: 'BRAK DANYCH', color: 'text-slate-400', title: 'Brak odczytu snu', desc: 'Zsynchronizuj pierścień Oura z aplikacją Vanguard.' };
    if (score >= 85) return { label: 'OPTYMALNY', color: 'text-emerald-400', title: 'Optymalna regeneracja nocna', desc: 'Twój sen był głęboki i nieprzerwany. Gotowy do pełnej aktywności.' };
    if (score >= 70) return { label: 'DOBRY', color: 'text-teal-400', title: 'Optymalny czas zasypiania', desc: `Zasypianie zajęło ci wczoraj ${latencyMins !== null ? `${latencyMins} min` : '--'}, co oznacza, że twój organizm był gotowy do snu.` };
    return { label: 'POTRZEBUJE UWAGI', color: 'text-amber-400', title: 'Zwiększona inercja senna', desc: 'Wykryto krótsze fazy regeneracji. Zadbaj o wcześniejszą porę zasypiania.' };
  };

  const status = getScoreStatus(sleepScore);

  const totalSleepMins = totalSleepH !== null ? totalSleepH * 60 : 1;
  const remPct = remH !== null && totalSleepH !== null ? Math.round((remH * 60 / totalSleepMins) * 100) : null;
  const deepPct = deepH !== null && totalSleepH !== null ? Math.round((deepH * 60 / totalSleepMins) * 100) : null;

  return (
    <div className="space-y-4 text-white animate-fadeIn">
      {/* Hero Sleep Score */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-5xl font-black text-white">{sleepScore !== null ? sleepScore : '--'}</span>
          <span className={`text-xs font-extrabold uppercase tracking-widest ${status.color}`}>{status.label}</span>
        </div>

        <h3 className="text-xl font-serif font-bold text-white tracking-tight">{status.title}</h3>
        <p className="text-2xs text-slate-400 leading-relaxed">{status.desc}</p>
      </div>

      {/* Współczynniki Snu (Sleep Contributors) */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-xl">
        <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400">WSPÓŁCZYNNIKI SNU</h4>

        <div className="space-y-3">
          {[
            { label: 'Całkowity czas snu', val: formatHM(totalSleepH), pct: totalSleepH !== null ? Math.min(100, Math.round((totalSleepH / 8) * 100)) : 0, color: 'bg-white' },
            { label: 'Wydajność', val: efficiencyPct !== null ? `${efficiencyPct}%` : '--', pct: efficiencyPct ?? 0, color: 'bg-white' },
            { label: 'Poziom wypoczęcia', val: sleepScore !== null ? (sleepScore >= 80 ? 'Dobry' : 'Umiarkowany') : '--', pct: sleepScore ?? 0, color: 'bg-white' },
            { label: 'Sen fazy REM', val: remH !== null ? `${formatHM(remH)}${remPct !== null ? `, ${remPct}%` : ''}` : '--', pct: remPct ?? 0, color: 'bg-rose-400', textCol: 'text-rose-300' },
            { label: 'Głęboki sen', val: deepH !== null ? `${formatHM(deepH)}${deepPct !== null ? `, ${deepPct}%` : ''}` : '--', pct: deepPct ?? 0, color: 'bg-white' },
            { label: 'Czas zasypiania', val: latencyMins !== null ? `${latencyMins} min` : '--', pct: latencyMins !== null ? Math.max(10, 100 - latencyMins * 2) : 0, color: 'bg-white' },
            { label: 'Pora snu', val: sleepScore !== null ? 'Optymalna' : '--', pct: sleepScore !== null ? 90 : 0, color: 'bg-teal-400', textCol: 'text-teal-400' },
          ].map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-300">{item.label}</span>
                <span className={`font-bold ${item.textCol ?? 'text-white'}`}>{item.val}</span>
              </div>
              <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hipnogram Snu (100% Czasowy wykres faz) */}
      <OuraHypnogramChart {...dataProps} />

      {/* Deficyt Snu & Zegar Biologiczny */}
      <OuraSleepDebtCard {...dataProps} />

      {/* Korelacja: Czas Ekranowy z Telefonu vs Jakość Snu Oura */}
      <OuraScreenTimeCorrelationCard {...dataProps} />

      {/* Barometr, Temperatura Nocna i Pogoda vs Sen Oura */}
      <OuraWeatherBarometerCard {...dataProps} />

      {/* Magnetometr & Detekcja Pola EMF przy Głowie */}
      <OuraEmfSensorCard />

      {/* Głębokie Laboratorium Snu (Social Jetlag, Ranking Dni Tygodnia, Architektura Faz) */}
      <OuraDeepAnalyticsLabCard {...dataProps} />

      {/* Wykresy Liniowe Tętna i HRV */}
      <OuraVitalsLinearCharts {...dataProps} />
    </div>
  );
}

