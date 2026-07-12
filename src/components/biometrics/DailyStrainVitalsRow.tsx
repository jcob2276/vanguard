import { Zap, Activity, Moon, Thermometer, Footprints } from 'lucide-react';
import type { Tables } from '../../lib/database.types';
import { zToVitalColor } from './dailyStrainCardStyles';

interface DailyStrainVitalsRowProps {
  oura: Tables<'oura_daily_summary'>;
  hrvZ?: number | null;
  rhrZ?: number | null;
  sleepZ?: number | null;
  sleepScoreToday?: number | null;
}

export default function DailyStrainVitalsRow({ oura, hrvZ, rhrZ, sleepZ, sleepScoreToday }: DailyStrainVitalsRowProps) {
  const vitals = [
    { icon: Zap, label: 'HRV', value: oura.hrv_avg ? `${oura.hrv_avg}ms` : '--', color: zToVitalColor(hrvZ, 'text-dayA') },
    { icon: Activity, label: 'RHR', value: oura.rhr_avg ? `${oura.rhr_avg}bpm` : '--', color: zToVitalColor(rhrZ, 'text-dayB') },
    {
      icon: Moon,
      label: 'Sen',
      value: sleepScoreToday != null ? `${sleepScoreToday}pts` : (oura.total_sleep_hours ? `${Math.floor(oura.total_sleep_hours)}h${Math.round((oura.total_sleep_hours % 1) * 60)}m` : '--'),
      color: zToVitalColor(sleepZ, oura.total_sleep_hours == null ? 'text-text-muted' : oura.total_sleep_hours >= 7.5 ? 'text-emerald-500 dark:text-emerald-400' : oura.total_sleep_hours >= 6 ? 'text-amber-500 dark:text-amber-400' : 'text-rose-500 dark:text-rose-400'),
    },
    { icon: Thermometer, label: 'Temp', value: oura.temp_deviation != null ? `${oura.temp_deviation > 0 ? '+' : ''}${oura.temp_deviation}°` : '--', color: Math.abs(oura.temp_deviation || 0) > 0.5 ? 'text-rose-500' : 'text-text-secondary' },
    { icon: Footprints, label: 'Kroki', value: (oura.steps ?? 0) > 0 ? (oura.steps ?? 0).toLocaleString() : '--', color: 'text-dayC' },
  ];

  return (
    <>
      <div className="h-px bg-border-custom/30 relative z-10" />
      <div className="flex items-center justify-between relative z-10">
        {vitals.map(({ icon: Icon, label, value, color }, idx) => (
          <div key={label} className={`flex-1 flex flex-col items-center text-center ${idx > 0 ? 'border-l border-border-custom/30' : ''}`}>
            <div className="flex items-center gap-0.5">
              <Icon size={9} className={color} />
              <span className="text-[8px] font-bold tracking-wider text-text-muted uppercase">{label}</span>
            </div>
            <span className={`text-[10px] font-black font-mono mt-0.5 ${color}`}>{value}</span>
          </div>
        ))}
      </div>
    </>
  );
}
