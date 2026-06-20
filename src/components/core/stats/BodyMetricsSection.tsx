import { Activity } from 'lucide-react';
import { TrendArrow } from './TrendArrow';

interface TrendPoint {
  cur: number | null;
  prev: number | null;
}

interface BodyMetricsSectionProps {
  trends: {
    weight?: TrendPoint;
    waist?: TrendPoint;
  };
  newMetric: { weight: string; waist: string };
  setNewMetric: (metric: { weight: string; waist: string }) => void;
  latestBody: { weight: number | null; waist: number | null } | null;
  saveMetrics: (e: React.FormEvent) => void;
}

export function BodyMetricsSection({
  trends,
  newMetric,
  setNewMetric,
  latestBody,
  saveMetrics,
}: BodyMetricsSectionProps) {
  return (
    <section className="rounded-[24px] border border-border-custom bg-surface backdrop-blur-md shadow-sm">
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted font-display">
            Pomiary ciała
          </p>
          <h2 className="mt-1 font-display text-[18px] font-black tracking-tight text-text-primary">
            Waga i talia
          </h2>
        </div>
        <Activity className="text-primary/30 dark:text-primary/45" size={18} />
      </div>
      <div className="space-y-4 px-5 pb-5">
        <div className="grid grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-text-muted font-display">
              Waga (kg){' '}
              <TrendArrow
                current={trends.weight?.cur}
                previous={trends.weight?.prev}
                better="down"
              />
            </label>
            <input
              type="number"
              step="0.1"
              value={newMetric.weight}
              onChange={(e) => setNewMetric({ ...newMetric, weight: e.target.value })}
              className="w-full rounded-xl border border-border-custom bg-surface p-3.5 text-lg font-black text-text-primary outline-none transition-all placeholder:text-text-muted focus:border-primary/50 focus:bg-surface-solid focus:shadow-[0_0_0_3px_rgba(79,70,229,0.08)]"
              placeholder={latestBody?.weight ? String(latestBody.weight) : '--'}
            />
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-text-muted font-display">
              Talia (cm){' '}
              <TrendArrow
                current={trends.waist?.cur}
                previous={trends.waist?.prev}
                better="down"
              />
            </label>
            <input
              type="number"
              step="0.1"
              value={newMetric.waist}
              onChange={(e) => setNewMetric({ ...newMetric, waist: e.target.value })}
              className="w-full rounded-xl border border-border-custom bg-surface p-3.5 text-lg font-black text-text-primary outline-none transition-all placeholder:text-text-muted focus:border-primary/50 focus:bg-surface-solid focus:shadow-[0_0_0_3px_rgba(79,70,229,0.08)]"
              placeholder={latestBody?.waist ? String(latestBody.waist) : '--'}
            />
          </div>
        </div>
        <button
          onClick={saveMetrics}
          className="w-full rounded-xl bg-primary hover:bg-primary-hover py-3.5 text-[12px] font-bold text-white shadow-lg shadow-primary/20 transition-all active:scale-[0.98] font-display cursor-pointer"
        >
          Zapisz pomiary
        </button>
      </div>
    </section>
  );
}
