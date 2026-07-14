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
      <table className="w-full min-w-[var(--legacy-w-090)] text-left border-collapse">
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
                <td className="py-2.5 px-2 text-xs text-text-muted max-w-[var(--legacy-maxw-050)]">{formatRef(s.latest)}</td>
                <td className="py-2.5 px-2 text-xs max-w-[var(--legacy-maxw-049)]">
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

export function CategorySection({ catKey, series }: { catKey: string; series: MarkerSeries[] }) {
  const [open, setOpen] = useState(true);
  return (
    <Card variant="glass" className="bg-surface/30 border-border-custom overflow-hidden" padding="0">
      <Pressable
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer hover:bg-surface/50"
      >
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-text-primary">
            {categoryLabel(catKey)}
          </p>
          <p className="text-xs text-text-muted mt-0.5">{series.length} markerów</p>
        </div>
        {open ? (
          <ChevronDown size={16} className="text-text-muted shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-text-muted shrink-0" />
        )}
      </Pressable>
      {open && (
        <div className="px-4 pb-4 border-t border-border-custom/60">
          <MarkerTable rows={series} />
        </div>
      )}
    </Card>
  );
}

export function PanelTimeline({ byDate }: { byDate: Map<string, MedicalLabRow[]> }) {
  const [expandedDate, setExpandedDate] = useState<string | null>(() => byDate.keys().next().value ?? null);

  return (
    <ul className="space-y-2">
      {[...byDate.entries()].map(([date, rows]) => {
        const open = expandedDate === date;
        const source = rows[0]?.source_name;
        const provider = rows[0]?.provider;
        const age = diffDaysFromToday(date);
        const fresh = labFreshness(age);
        return (
          <li key={date} className="rounded-xl border border-border-custom bg-background/40 overflow-hidden">
            <Pressable
              type="button"
              onClick={() => setExpandedDate(open ? null : date)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-text-primary">{formatMedicalDate(date)}</p>
                <p className="text-xs text-text-muted truncate">
                  {rows.length} markerów · {source}
                  {provider ? ` · ${provider}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-2xs font-black uppercase text-text-muted">
                {freshnessLabel(fresh)}
              </span>
            </Pressable>
            {open && (
              <div className="border-t border-border-custom/60 px-3 py-2 space-y-1.5 max-h-64 overflow-y-auto">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-text-secondary truncate flex-1">{r.marker_name}</span>
                    <ValueCell row={r} />
                  </div>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function BodyCompositionSection({ rows }: { rows: BodyCompositionRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const date = row.measured_at.slice(0, 10);
        const age = diffDaysFromToday(date);
        return (
          <li key={row.id} className="rounded-xl border border-border-custom bg-background/40 px-3 py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-bold text-text-primary">{formatMedicalDate(date)}</p>
              <span className="text-2xs font-black uppercase text-text-muted">
                {freshnessLabel(labFreshness(age))} · {row.reliability}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {row.source} · {row.method}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs tabular-nums">
              {row.weight_kg != null && (
                <span>
                  Masa <strong>{row.weight_kg}</strong> kg
                </span>
              )}
              {row.body_fat_pct != null && (
                <span>
                  BF <strong>{row.body_fat_pct}</strong>%
                </span>
              )}
              {row.muscle_mass_kg != null && (
                <span>
                  Mięśnie <strong>{row.muscle_mass_kg}</strong> kg
                </span>
              )}
              {row.visceral_fat_rating != null && (
                <span>
                  Tłuszcz trzewny <strong>{row.visceral_fat_rating}</strong>
                </span>
              )}
              {row.bmi != null && (
                <span>
                  BMI <strong>{row.bmi}</strong>
                </span>
              )}
            </div>
            {row.notes && <p className="text-xs text-text-muted mt-2 leading-relaxed">{row.notes}</p>}
          </li>
        );
      })}
    </ul>
  );
}

export function KeyMarkerCards({ series, limit = 6 }: { series: MarkerSeries[]; limit?: number }) {
  const cards = series.slice(0, limit);
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
      {cards.map((s) => {
        const age = diffDaysFromToday(s.latest.result_date);
        return (
          <div key={s.marker_key} className="rounded-xl border border-border-custom bg-surface/40 px-3 py-2.5">
            <p className="text-xs font-bold text-text-secondary line-clamp-2 leading-tight">{s.marker_name}</p>
            <div className="mt-1.5">
              <ValueCell row={s.latest} />
            </div>
            <p className="text-2xs text-text-muted mt-1">
              {formatMedicalDate(s.latest.result_date)}
              {age != null ? ` · ${age}d` : ''}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function SectionShell({
  id,
  title,
  subtitle,
  icon,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-36 space-y-3">
      <div className="flex items-start gap-2">
        {icon}
        <div>
          <h2 className="text-xs font-black uppercase tracking-[var(--legacy-arbitrary-004)] text-text-primary">{title}</h2>
          {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export { Scale };
