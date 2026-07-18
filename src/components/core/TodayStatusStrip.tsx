import { Activity, Beef, Dumbbell } from 'lucide-react';
import { useDashboardContext } from './context/DashboardContext';
import { getTodayStateCopy } from '../../lib/horizonSignals';

export default function TodayStatusStrip() {
  const { readiness, proteinToday, hasWorkoutToday } = useDashboardContext();
  const metrics = [
    { icon: Activity, label: 'Gotowość', value: readiness > 0 ? `${Math.round(readiness)}` : '—' },
    { icon: Beef, label: 'Białko', value: `${Math.round(proteinToday)} g` },
    { icon: Dumbbell, label: 'Trening', value: hasWorkoutToday ? 'Zrobiony' : 'Przed Tobą' },
  ];

  return (
    <section className="rounded-3xl border border-border-custom/60 bg-surface/70 p-4">
      <p className="text-sm font-semibold leading-relaxed text-text-primary">{getTodayStateCopy(readiness)}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border-custom/40 pt-3">
        {metrics.map(({ icon: Icon, label, value }) => (
          <div key={label} className="min-w-0">
            <p className="flex items-center gap-1 text-2xs font-bold uppercase tracking-wider text-text-muted"><Icon size={10} /> {label}</p>
            <p className="mt-1 truncate text-sm font-black text-text-primary">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
