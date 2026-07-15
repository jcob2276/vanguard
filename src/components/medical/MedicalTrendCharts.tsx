import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  buildTrendChartPoints,
  formatRef,
  pickChartSeries,
  type MarkerSeries,
} from '../../lib/health/medicalAnalytics';
import { GETBASED_OPTIMAL, bridgeForMarkerKey } from '../../lib/getBased/markerBridge';
import { ValueCell } from './MedicalLabSections';
import { Card } from '../ui/Card';

function ChartTip({ active, payload }: { active?: boolean; payload?: { payload: { label: string; value: number } }[] }) {
  if (!active || !payload?.[0]) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border-custom bg-background px-2 py-1.5 text-xs shadow-lg">
      <p className="text-text-muted">{p.label}</p>
      <p className="font-black text-text-primary tabular-nums">{p.value}</p>
    </div>
  );
}

function MarkerTrendCard({ series }: { series: MarkerSeries }) {
  const bridge = bridgeForMarkerKey(series.marker_key);
  const data = buildTrendChartPoints(series).map((p) => {
    const row = series.history.find((h) => h.result_date === p.date);
    if (!row || !bridge) return p;
    return { ...p, value: bridge.toCanonical(row.value, row.unit) };
  });
  const refLow = bridge ? null : series.ref_low;
  const refHigh = bridge ? null : series.ref_high;
  const hasRefBand = refLow != null && refHigh != null && refLow < refHigh;
  const opt = bridge ? GETBASED_OPTIMAL[bridge.path] : null;
  const hasOptBand =
    opt?.optimalMin != null && opt?.optimalMax != null && opt.optimalMin < opt.optimalMax;

  return (
    <Card variant="surface" className="bg-surface/30 border-border-custom" padding="1rem">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-text-primary">{series.marker_name}</p>
          <p className="text-xs text-text-muted mt-0.5">Norma lab: {formatRef(series.latest)}</p>
          {bridge && opt && (
            <p className="text-xs text-success/80 dark:text-success/80 mt-0.5">
              Optymalne (getbased): {opt.optimalMin}–{opt.optimalMax} {bridge.canonicalUnit}
            </p>
          )}
        </div>
        <ValueCell row={series.latest} />
      </div>
      <ResponsiveContainer width="100%" height={160} minWidth={0} minHeight={0}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--legacy-color-069)" />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--color-text-muted, var(--legacy-color-030))' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9, fill: 'var(--color-text-muted, var(--legacy-color-030))' }} domain={['auto', 'auto']} width={36} />
          <Tooltip content={<ChartTip />} />
          {hasOptBand && (
            <ReferenceArea
              y1={opt!.optimalMin!}
              y2={opt!.optimalMax!}
              fill="var(--legacy-color-144)"
              strokeOpacity={0}
            />
          )}
          {hasRefBand && (
            <ReferenceArea y1={refLow!} y2={refHigh!} fill="var(--legacy-color-073)" strokeOpacity={0} />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-primary, var(--legacy-color-024))"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--color-primary, var(--legacy-color-024))' }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-2xs text-text-muted mt-2">{data.length} pomiarów w historii</p>
    </Card>
  );
}

export default function MedicalTrendCharts({ series }: { series: MarkerSeries[] }) {
  const charts = pickChartSeries(series, 8);

  if (charts.length === 0) {
    return (
      <p className="text-sm text-text-muted leading-relaxed">
        Trendy pojawią się po drugim wyniku tego samego markera (np. kolejny panel krwi).
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {charts.map((s) => (
        <MarkerTrendCard key={s.marker_key} series={s} />
      ))}
    </div>
  );
}
