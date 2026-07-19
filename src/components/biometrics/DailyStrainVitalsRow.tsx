/**
 * @component DailyStrainVitalsRow
 * @role Wiersz witalności (HRV/RHR/sen/temp/kroki) z kolorowaniem z-score oraz wierszem zaawansowanych parametrów (oddech, SpO2, efektywność, zasypianie) i rekomendacją pór snu.
 * @usedBy DailyStrainCard
 */
import { Zap, Activity, Moon, Thermometer, Footprints, Wind, Droplets, Gauge, Timer } from 'lucide-react';
import type { Tables } from '../../lib/database.types';
import { StatHero } from '../ui/StatHero';
import { zToVitalColor } from './dailyStrainCardStyles';

interface DailyStrainVitalsRowProps {
  oura: Tables<'oura_daily_summary'>;
  enhanced?: Tables<'oura_enhanced'> | null;
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

export default function DailyStrainVitalsRow({ oura, enhanced, hrvZ, rhrZ, sleepZ, sleepScoreToday }: DailyStrainVitalsRowProps) {
  const vitals = [
    { icon: Zap, label: 'HRV', value: oura.hrv_avg ? `${oura.hrv_avg}ms` : '--', color: zToVitalColor(hrvZ, 'text-dayA') },
    { icon: Activity, label: 'RHR', value: oura.rhr_avg ? `${oura.rhr_avg}bpm` : '--', color: zToVitalColor(rhrZ, 'text-dayB') },
    {
      icon: Moon,
      label: 'Sen',
      value: sleepScoreToday != null ? `${sleepScoreToday}pts` : (oura.total_sleep_hours ? `${Math.floor(oura.total_sleep_hours)}h${Math.round((oura.total_sleep_hours % 1) * 60)}m` : '--'),
      color: zToVitalColor(sleepZ, oura.total_sleep_hours == null ? 'text-text-muted' : oura.total_sleep_hours >= 7.5 ? 'text-success dark:text-success' : oura.total_sleep_hours >= 6 ? 'text-warning dark:text-warning' : 'text-danger dark:text-danger'),
    },
    { icon: Thermometer, label: 'Temp', value: oura.temp_deviation != null ? `${oura.temp_deviation > 0 ? '+' : ''}${oura.temp_deviation}°` : '--', color: Math.abs(oura.temp_deviation || 0) > 0.5 ? 'text-danger' : 'text-text-secondary' },
    { icon: Footprints, label: 'Kroki', value: (oura.steps ?? 0) > 0 ? (oura.steps ?? 0).toLocaleString() : '--', color: 'text-dayC' },
  ];

  const secondaryVitals = [
    { icon: Wind, label: 'Oddech', value: enhanced?.sleep_average_breath ? `${enhanced.sleep_average_breath.toFixed(1)}/m` : '--', color: 'text-text-secondary' },
    { icon: Droplets, label: 'SpO2', value: enhanced?.spo2_percentage ? `${enhanced.spo2_percentage}%` : '--', color: enhanced?.spo2_percentage && enhanced.spo2_percentage < 95 ? 'text-danger' : 'text-text-secondary' },
    { icon: Gauge, label: 'Wydajność', value: oura.sleep_efficiency ? `${oura.sleep_efficiency}%` : '--', color: oura.sleep_efficiency && oura.sleep_efficiency < 85 ? 'text-warning' : 'text-text-secondary' },
    { icon: Timer, label: 'Zasypianie', value: oura.latency_minutes != null ? `${oura.latency_minutes}m` : '--', color: 'text-text-secondary' },
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
        {secondaryVitals.map(({ icon: Icon, label, value, color }, idx) => (
          <div key={label} className={`flex-1 flex flex-col items-center text-center ${idx > 0 ? 'border-l border-border-custom/30' : ''}`}>
            <div className="flex items-center gap-1 mb-0.5 animate-fadeIn">
              <Icon size={10} className="text-text-muted" />
              <span className="text-3xs uppercase tracking-wider text-text-muted font-bold">{label}</span>
            </div>
            <span className={`text-xs font-black ${color}`}>{value}</span>
          </div>
        ))}
      </div>

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
