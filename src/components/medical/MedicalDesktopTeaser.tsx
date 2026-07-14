import { FlaskConical } from 'lucide-react';import { useMedicalData } from './hooks/useMedicalData';
import {
  buildMarkerSeries,
  diffDaysFromToday,
  formatMedicalDate,
  freshnessLabel,
  labFreshness,
  PRIORITY_CHART_MARKERS,
} from '../../lib/health/medicalAnalytics';
import { ValueCell } from './MedicalLabSections';
import { Card } from '../ui/Card';

export default function MedicalDesktopTeaser({ userId }: { userId: string }) {
  const { labs, loading } = useMedicalData(userId);
  const series = buildMarkerSeries(labs);
  const latestDate = labs[0]?.result_date ?? null;
  const preview = PRIORITY_CHART_MARKERS.map((k) => series.find((s) => s.marker_key === k))
    .filter(Boolean)
    .slice(0, 4);

  return (
    <Card variant="glass" className="bg-surface/30 border-border-custom space-y-4" padding="1.25rem">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-text-muted">
            <FlaskConical size={12} /> Badania laboratoryjne
          </p>
          {latestDate && !loading && (
            <p className="text-[11px] text-text-secondary mt-1">
              Ostatni panel: {formatMedicalDate(latestDate)} ·{' '}
              {freshnessLabel(labFreshness(diffDaysFromToday(latestDate)))}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="h-20 animate-pulse rounded-xl bg-border-custom/30" />
      ) : preview.length === 0 ? (
        <p className="text-[11px] text-text-muted">Brak wyników w bazie.</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {preview.map((s) => (
            <div key={s!.marker_key} className="rounded-xl border border-border-custom bg-background/40 px-3 py-2">
              <p className="text-[10px] font-semibold text-text-secondary line-clamp-2">{s!.marker_name}</p>
              <div className="mt-1">
                <ValueCell row={s!.latest} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
