import { Pressable } from '../ui/ControlPrimitives';
import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import {
  categoryLabel,
  computeTrendPct,
  diffDaysFromToday,
  formatMedicalDate,
  formatRef,
  freshnessLabel,
  labFreshness,
  type BodyCompositionRow,
  type MarkerSeries,
  type MedicalLabRow,
} from '../../lib/health/medicalAnalytics';
import { formatOptimalRange, optimalStatus } from '../../lib/getBased/markerBridge';
import { Card } from '../ui/Card';

export function ValueCell({ row }: { row: MedicalLabRow }) {
  const tone =
    row.flag && /high|above/i.test(row.flag)
      ? 'text-warning dark:text-warning'
      : row.flag && /low|below/i.test(row.flag)
        ? 'text-info dark:text-info'
        : 'text-text-primary';

  return (
    <span className={`font-black tabular-nums ${tone}`}>
      {row.value}
      {row.unit ? <span className="text-xs font-semibold text-text-muted ml-0.5">{row.unit}</span> : null}
    </span>
  );
}

function TrendBadge({ series }: { series: MarkerSeries }) {
  if (!series.prior) return <span className="text-2xs text-text-muted">—</span>;
  const delta = computeTrendPct(series.latest.value, series.prior.value);
  if (delta == null) return <span className="text-2xs text-text-muted">—</span>;
  const rising = delta > 0;
  const stable = Math.abs(delta) < 5;
  if (stable) return <span className="text-2xs text-text-muted">≈0%</span>;
  const Icon = rising ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-2xs font-bold tabular-nums ${rising ? 'text-warning dark:text-warning' : 'text-info dark:text-info'}`}
    >
      <Icon size={10} />
      {rising ? '+' : ''}
      {delta}%
    </span>
  );
}

function MarkerTable({ rows }: { rows: MarkerSeries[] }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full min-w-[var(--ds-w-520px)] text-left border-collapse">
        <thead>
          <tr className="text-2xs font-black uppercase tracking-wider text-text-muted border-b border-border-custom">
            <th className="py-2 pr-2 font-black">Marker</th>
            <th className="py-2 px-2 font-black">Wynik</th>
            <th className="py-2 px-2 font-black">Norma lab</th>
            <th className="py-2 px-2 font-black">Optymalne</th>
            <th className="py-2 px-2 font-black">Trend</th>
            <th className="py-2 pl-2 font-black">Data</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const age = diffDaysFromToday(s.latest.result_date);
            const opt = formatOptimalRange(s.marker_key);
            const optSt = optimalStatus(s.marker_key, s.latest.value, s.latest.unit);
            return (
              <tr key={s.marker_key} className="border-b border-border-custom/50 last:border-0">
                <td className="py-2.5 pr-2">
                  <p className="text-xs font-bold text-text-primary leading-tight">{s.marker_name}</p>
                  {s.latest.flag && <p className="text-2xs text-text-muted mt-0.5">{s.latest.flag}</p>}
                </td>
                <td className="py-2.5 px-2">
                  <ValueCell row={s.latest} />
                </td>
                <td className="py-2.5 px-2 text-xs text-text-muted max-w-[var(--ds-maxw-120px)]">{formatRef(s.latest)}</td>
                <td className="py-2.5 px-2 text-xs max-w-[var(--ds-maxw-100px)]">
                  {opt ? (
                    <span
                      className={
                        optSt === 'in'
                          ? 'text-success dark:text-success'
                          : optSt === 'unknown'
                            ? 'text-text-muted'
                            : 'text-warning dark:text-warning'
                      }
                    >
                      {opt}
                    </span>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className="py-2.5 px-2">
                  <TrendBadge series={s} />
                </td>
                <td className="py-2.5 pl-2 text-xs text-text-muted whitespace-nowrap">
                  {formatMedicalDate(s.latest.result_date)}
                  {age != null && <span className="block text-2xs">{age} dni temu</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

