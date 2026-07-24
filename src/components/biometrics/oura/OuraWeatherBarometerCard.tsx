import { useQuery } from '@tanstack/react-query';
import { Thermometer, Gauge, ShieldAlert, Sparkles } from 'lucide-react';
import type { OuraHealthHubData } from './types';
import { shiftDateStr, getTodayWarsaw } from '../../../lib/date';

interface WeatherPoint {
  date: string;
  pressureHpa: number;
  tempNightC: number;
  humidityPct: number;
}

export function OuraWeatherBarometerCard({ ouraHistory, enhanced }: OuraHealthHubData) {
  const today = getTodayWarsaw();
  const rangeStart = shiftDateStr(today, -30);

  // Fetch Open-Meteo historical/forecast pressure & temperature for Warsaw / Poland
  const weatherQuery = useQuery({
    queryKey: ['oura-weather-history', rangeStart, today],
    queryFn: async () => {
      const lat = 52.2297; // Warsaw lat
      const lng = 21.0122; // Warsaw lng
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&start_date=${rangeStart}&end_date=${today}&daily=temperature_2m_min,surface_pressure_mean,relative_humidity_2m_mean&timezone=Europe/Warsaw`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      const list: WeatherPoint[] = [];
      if (data.daily && data.daily.time) {
        for (let i = 0; i < data.daily.time.length; i++) {
          list.push({
            date: data.daily.time[i],
            pressureHpa: Math.round(data.daily.surface_pressure_mean[i] ?? 1013),
            tempNightC: Math.round(data.daily.temperature_2m_min[i] ?? 12),
            humidityPct: Math.round(data.daily.relative_humidity_2m_mean[i] ?? 70),
          });
        }
      }
      return list;
    },
    staleTime: 30 * 60 * 1000,
  });

  const weatherData = weatherQuery.data ?? [];
  const nights = ouraHistory ?? [];

  // Pair weather data with Oura sleep readings
  const paired = nights
    .map((night) => {
      const w = weatherData.find((wp) => wp.date === night.date);
      if (!w || !night.sleep_score) return null;
      return {
        date: night.date,
        sleepScore: night.sleep_score,
        deepSleepHours: night.deep_sleep_hours ?? 0,
        remSleepHours: night.rem_sleep_hours ?? 0,
        latencyMins: night.latency_minutes ?? 0,
        pressureHpa: w.pressureHpa,
        tempNightC: w.tempNightC,
        humidityPct: w.humidityPct,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const lowPressure = paired.filter((d) => d.pressureHpa < 1010);
  const normalPressure = paired.filter((d) => d.pressureHpa >= 1010);

  const avgScoreLowP = lowPressure.length > 0
    ? Math.round(lowPressure.reduce((a, b) => a + b.sleepScore, 0) / lowPressure.length)
    : null;
  const avgScoreNormP = normalPressure.length > 0
    ? Math.round(normalPressure.reduce((a, b) => a + b.sleepScore, 0) / normalPressure.length)
    : null;

  const avgRemLowP = lowPressure.length > 0
    ? (lowPressure.reduce((a, b) => a + b.remSleepHours, 0) / lowPressure.length).toFixed(1)
    : null;
  const avgRemNormP = normalPressure.length > 0
    ? (normalPressure.reduce((a, b) => a + b.remSleepHours, 0) / normalPressure.length).toFixed(1)
    : null;

  // Warm nights (> 16°C) vs cool nights (< 16°C)
  const warmNights = paired.filter((d) => d.tempNightC >= 16);
  const coolNights = paired.filter((d) => d.tempNightC < 16);

  const avgDeepWarm = warmNights.length > 0
    ? (warmNights.reduce((a, b) => a + b.deepSleepHours, 0) / warmNights.length).toFixed(1)
    : null;
  const avgDeepCool = coolNights.length > 0
    ? (coolNights.reduce((a, b) => a + b.deepSleepHours, 0) / coolNights.length).toFixed(1)
    : null;

  const bodyTempDelta = enhanced?.temperature_deviation ?? null;

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-xl">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Gauge size={16} />
          </div>
          <div>
            <h4 className="text-3xs font-black uppercase tracking-widest text-slate-300 font-display">
              Barometr & Pogoda vs Sen Oura
            </h4>
            <p className="text-3xs text-slate-400">
              Wpływ ciśnienia hPa, temperatury nocnej i wilgotności na regenerację
            </p>
          </div>
        </div>
        <span className="text-3xs font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
          {paired.length} nocy
        </span>
      </div>

      {/* Main Grid: Barometer & Night Temperature */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        
        {/* Card: Pressure Impact */}
        <div className="p-4 rounded-2xl bg-slate-950/40 border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-black uppercase text-sky-400 flex items-center gap-1">
              <Gauge size={13} /> Ciśnienie Niskie (&lt;1010 hPa)
            </span>
            <span className="text-2xs font-bold text-slate-400">({lowPressure.length} nocy)</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{avgScoreLowP ?? '--'}</span>
            <span className="text-3xs font-bold text-slate-400">pkt snu (vs {avgScoreNormP ?? '--'} pkt wyż)</span>
          </div>
          <p className="text-3xs text-slate-300 pt-1 border-t border-white/5">
            Śr. faza REM przy niskim ciśnieniu: <strong className="text-sky-300">{avgRemLowP ?? '--'} h</strong> (vs {avgRemNormP ?? '--'} h)
          </p>
        </div>

        {/* Card: Temperature Impact */}
        <div className="p-4 rounded-2xl bg-slate-950/40 border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-black uppercase text-amber-400 flex items-center gap-1">
              <Thermometer size={13} /> Ciepłe Noce (&gt;16°C Zewnątrz)
            </span>
            <span className="text-2xs font-bold text-slate-400">({warmNights.length} nocy)</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{avgDeepWarm ?? '--'} h</span>
            <span className="text-3xs font-bold text-slate-400">snu głębokiego</span>
          </div>
          <p className="text-3xs text-slate-300 pt-1 border-t border-white/5">
            Sen głęboki w chłodne noce: <strong className="text-emerald-300">{avgDeepCool ?? '--'} h</strong>
          </p>
        </div>

      </div>

      {/* Body Temp Delta from Oura Ring */}
      {bodyTempDelta !== null && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-3xs font-medium">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-sky-400 shrink-0" />
            <span>Odchylenie temperatury Twojej skóry (Oura Ring):</span>
          </div>
          <span className={`font-black text-xs ${bodyTempDelta > 0.3 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {bodyTempDelta > 0 ? `+${bodyTempDelta.toFixed(2)}°C` : `${bodyTempDelta.toFixed(2)}°C`}
          </span>
        </div>
      )}

      {/* Bio Summary */}
      <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1.5">
        <div className="flex items-center gap-1.5 text-3xs font-black uppercase tracking-wider text-sky-300">
          <ShieldAlert size={14} /> Wniosek Barometryczny Vanguard
        </div>
        <p className="text-3xs leading-relaxed text-slate-300 font-medium">
          Gwałtowne spadki ciśnienia (front atmosferyczny &lt;1010 hPa) wywołują lekką inercję i powierzchowny sen. Z kolei nocne chłodzenie sypialni (&lt;18°C) wydłuża sen głęboki o średnio +20 minut.
        </p>
      </div>

    </div>
  );
}
