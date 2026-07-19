/**
 * @component DailyStrainVitalsRow
 * @role Wiersz witalności (HRV/RHR/sen/temp/kroki) z kolorowaniem z-score oraz wierszem zaawansowanych parametrów (oddech, SpO2, efektywność, zasypianie) i rekomendacją pór snu.
 * @usedBy DailyStrainCard
 */
import React from 'react';
import { Zap, Activity, Moon, Thermometer, Footprints, Wind, Droplets, Gauge, Timer } from 'lucide-react';
import type { Tables } from '../../lib/database.types';
import { StatHero } from '../ui/StatHero';
import { zToVitalColor } from './dailyStrainCardStyles';

interface DailyStrainVitalsRowProps {
  oura: Tables<'oura_daily_summary'>;
  ouraYesterday?: Tables<'oura_daily_summary'> | null;
  enhanced?: Tables<'oura_enhanced'> | null;
  enhancedYesterday?: Tables<'oura_enhanced'> | null;
  hrvZ?: number | null;
  rhrZ?: number | null;
  sleepZ?: number | null;
  sleepScoreToday?: number | null;
}

function getBedtimeRecommendationLabel(rec: string | null): string | null {
  if (!rec) return null;
  switch (rec) {
    case 'earlier_bedtime': return 'Oura: Sugerowane wcześniejsze pójście spać';
    case 'later_bedtime': return 'Oura: Sugerowane późniejsze pójście spać';
    case 'optimal': return 'Oura: Pora snu jest optymalna';
    case 'improve_consistency': return 'Oura: Zadbaj o regularność pór snu';
    default: return null;
  }
}

function formatHours(h: number | null): string {
  if (h == null || h <= 0) return '--';
  const hrs = Math.floor(h);
  const mins = Math.round((h % 1) * 60);
  return `${hrs}h ${mins}m`;
}

function renderTrendArrow(
  today: number | null | undefined,
  yesterday: number | null | undefined,
  better: 'higher' | 'lower' | 'neutral' = 'higher'
) {
  if (today == null || yesterday == null) return null;
  const t = Number(today);
  const y = Number(yesterday);
  if (t === y) return null;
  const isUp = t > y;

  let color = 'text-text-muted';
  if (better === 'higher') {
    color = isUp ? 'text-success dark:text-success' : 'text-danger dark:text-danger';
  } else if (better === 'lower') {
    color = isUp ? 'text-danger dark:text-danger' : 'text-success dark:text-success';
  }

  return (
    <span className={`text-3xs font-black ml-0.5 select-none ${color}`}>
      {isUp ? '↑' : '↓'}
    </span>
  );
}

function formatVitalValue(
  today: number | null | undefined,
  yesterday: number | null | undefined,
  unit: string,
  better: 'higher' | 'lower' | 'neutral'
) {
  if (today == null) return '--';
  return (
    <span className="flex items-center justify-center">
      {today.toLocaleString()}{unit}
      {renderTrendArrow(today, yesterday, better)}
    </span>
  );
}

export default function DailyStrainVitalsRow({
  oura,
  ouraYesterday,
  enhanced,
  enhancedYesterday,
  hrvZ,
  rhrZ,
  sleepZ,
  sleepScoreToday
}: DailyStrainVitalsRowProps) {

  const sleepRawVal = sleepScoreToday != null
    ? `${sleepScoreToday}pts`
    : (oura.total_sleep_hours ? `${Math.floor(oura.total_sleep_hours)}h${Math.round((oura.total_sleep_hours % 1) * 60)}m` : null);

  const sleepVal = sleepRawVal ? (
    <span className="flex items-center justify-center">
      {sleepRawVal}
      {renderTrendArrow(oura.total_sleep_hours, ouraYesterday?.total_sleep_hours, 'higher')}
    </span>
  ) : '--';

  const tempVal = oura.temp_deviation != null ? `${oura.temp_deviation > 0 ? '+' : ''}${oura.temp_deviation}°` : '--';

  const vitals = [
    { icon: Zap, label: 'HRV', value: formatVitalValue(oura.hrv_avg, ouraYesterday?.hrv_avg, 'ms', 'higher'), color: zToVitalColor(hrvZ, 'text-dayA') },
    { icon: Activity, label: 'RHR', value: formatVitalValue(oura.rhr_avg, ouraYesterday?.rhr_avg, 'bpm', 'lower'), color: zToVitalColor(rhrZ, 'text-dayB') },
    {
      icon: Moon,
      label: 'Sen',
      value: sleepVal,
      color: zToVitalColor(sleepZ, oura.total_sleep_hours == null ? 'text-text-muted' : oura.total_sleep_hours >= 7.5 ? 'text-success dark:text-success' : oura.total_sleep_hours >= 6 ? 'text-warning dark:text-warning' : 'text-danger dark:text-danger'),
    },
    { icon: Thermometer, label: 'Temp', value: tempVal, color: Math.abs(oura.temp_deviation || 0) > 0.5 ? 'text-danger' : 'text-text-secondary' },
    { icon: Footprints, label: 'Kroki', value: formatVitalValue(oura.steps, ouraYesterday?.steps, '', 'higher'), color: 'text-dayC' },
  ];

  const bedtimeAdvice = getBedtimeRecommendationLabel(oura.sleep_time_recommendation);

  return (
    <div className="space-y-3 relative z-[var(--z-raised)]">
      {/* Primary Vitals Row */}
      <div className="h-px bg-border-custom/30" />
      <div className="flex items-center justify-between">
        {vitals.map(({ icon: Icon, label, value, color }, idx) => (
          <div key={label} className={`flex-1 flex flex-col items-center text-center ${idx > 0 ? 'border-l border-border-custom/30' : ''}`}>
            <StatHero value={value} label={label} icon={Icon} color={color} size="sm" />
          </div>
        ))}
      </div>

      {/* Secondary Vitals Row */}
      <div className="h-px bg-border-custom/30" />
      <div className="flex items-center justify-between">
        {[
          {
            icon: Wind,
            label: 'Oddech',
            value: enhanced?.sleep_average_breath ? `${enhanced.sleep_average_breath.toFixed(1)}/m` : '--',
            arrow: renderTrendArrow(enhanced?.sleep_average_breath, enhancedYesterday?.sleep_average_breath, 'lower'),
            color: 'text-text-secondary'
          },
          {
            icon: Droplets,
            label: 'SpO2',
            value: enhanced?.spo2_percentage ? `${Math.round(enhanced.spo2_percentage)}%` : '--',
            arrow: renderTrendArrow(enhanced?.spo2_percentage, enhancedYesterday?.spo2_percentage, 'higher'),
            color: enhanced?.spo2_percentage && enhanced.spo2_percentage < 95 ? 'text-danger' : 'text-text-secondary'
          },
          {
            icon: Gauge,
            label: 'Wydajność',
            value: oura.sleep_efficiency ? `${oura.sleep_efficiency}%` : '--',
            arrow: renderTrendArrow(oura.sleep_efficiency, ouraYesterday?.sleep_efficiency, 'higher'),
            color: oura.sleep_efficiency && oura.sleep_efficiency < 85 ? 'text-warning' : 'text-text-secondary'
          },
          {
            icon: Timer,
            label: 'Zasypianie',
            value: oura.latency_minutes != null ? `${oura.latency_minutes}m` : '--',
            arrow: renderTrendArrow(oura.latency_minutes, ouraYesterday?.latency_minutes, 'lower'),
            color: 'text-text-secondary'
          },
        ].map(({ icon: Icon, label, value, arrow, color }, idx) => (
          <div key={label} className={`flex-1 flex flex-col items-center text-center ${idx > 0 ? 'border-l border-border-custom/30' : ''}`}>
            <div className="flex items-center gap-1 mb-0.5 animate-fadeIn">
              <Icon size={10} className="text-text-muted" />
              <span className="text-3xs uppercase tracking-wider text-text-muted font-bold">{label}</span>
            </div>
            <span className={`text-xs font-black flex items-center justify-center ${color}`}>
              {value}
              {arrow}
            </span>
          </div>
        ))}
      </div>

      {/* Sleep Stages Row */}
      {(oura.deep_sleep_hours != null || oura.rem_sleep_hours != null) && (
        <>
          <div className="h-px bg-border-custom/30" />
          <div className="flex items-center justify-between text-2xs px-1">
            <div className="flex-1 text-center">
              <span className="text-3xs text-text-muted uppercase tracking-wider block mb-0.5 font-bold">Sen Głęboki</span>
              <span className="text-xs font-black text-dayB flex items-center justify-center">
                {formatHours(oura.deep_sleep_hours)}
                {renderTrendArrow(oura.deep_sleep_hours, ouraYesterday?.deep_sleep_hours, 'higher')}
              </span>
            </div>
            <div className="w-px h-6 bg-border-custom/30" />
            <div className="flex-1 text-center">
              <span className="text-3xs text-text-muted uppercase tracking-wider block mb-0.5 font-bold">Faza REM</span>
              <span className="text-xs font-black text-dayA flex items-center justify-center">
                {formatHours(oura.rem_sleep_hours)}
                {renderTrendArrow(oura.rem_sleep_hours, ouraYesterday?.rem_sleep_hours, 'higher')}
              </span>
            </div>
            {enhanced?.light_sleep_hours != null && (
              <>
                <div className="w-px h-6 bg-border-custom/30" />
                <div className="flex-1 text-center">
                  <span className="text-3xs text-text-muted uppercase tracking-wider block mb-0.5 font-bold">Sen Lekki</span>
                  <span className="text-xs font-black text-text-secondary flex items-center justify-center">
                    {formatHours(enhanced.light_sleep_hours)}
                    {renderTrendArrow(enhanced.light_sleep_hours, enhancedYesterday?.light_sleep_hours, 'neutral')}
                  </span>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Bedtime Advice Banner */}
      {bedtimeAdvice && (
        <div className="px-3 py-2 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center gap-2 animate-fadeIn">
          <Moon size={11} className="text-primary animate-pulse" />
          <span className="text-2xs font-bold text-text-primary">{bedtimeAdvice}</span>
        </div>
      )}
    </div>
  );
}
