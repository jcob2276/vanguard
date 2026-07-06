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
} from '../../lib/medicalAnalytics';
import { formatOptimalRange, optimalStatus } from '../../lib/getBased/markerBridge';

export function ValueCell({ row }: { row: MedicalLabRow }) {
  const tone =
    row.flag && /high|above/i.test(row.flag)
      ? 'text-amber-600 dark:text-amber-400'
      : row.flag && /low|below/i.test(row.flag)
        ? 'text-sky-600 dark:text-sky-400'
        : 'text-text-primary';

  return (
    <span className={`font-black tabular-nums ${tone}`}>
      {row.value}
      {row.unit ? <span className="text-[10px] font-semibold text-text-muted ml-0.5">{row.unit}</span> : null}
    </span>
  );
}

function TrendBadge({ series }: { series: MarkerSeries }) {
  if (!series.prior) return <span className="text-[9px] text-text-muted">—</span>;
  const delta = computeTrendPct(series.latest.value, series.prior.value);
  if (delta == null) return <span className="text-[9px] text-text-muted">—</span>;
  const rising = delta > 0;
  const stable = Math.abs(delta) < 5;
  if (stable) return <span className="text-[9px] text-text-muted">≈0%</span>;
  const Icon = rising ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[9px] font-bold tabular-nums ${rising ? 'text-amber-600 dark:text-amber-400' : 'text-sky-600 dark:text-sky-400'}`}
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
      <table className="w-full min-w-[520px] text-left border-collapse">
        <thead>
          <tr className="text-[8px] font-black uppercase tracking-wider text-text-muted border-b border-border-custom">
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
                  <p className="text-[11px] font-bold text-text-primary leading-tight">{s.marker_name}</p>
                  {s.latest.flag && <p className="text-[9px] text-text-muted mt-0.5">{s.latest.flag}</p>}
                </td>
                <td className="py-2.5 px-2">
                  <ValueCell row={s.latest} />
                </td>
                <td className="py-2.5 px-2 text-[10px] text-text-muted max-w-[120px]">{formatRef(s.latest)}</td>
                <td className="py-2.5 px-2 text-[10px] max-w-[100px]">
                  {opt ? (
                    <span
                      className={
                        optSt === 'in'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : optSt === 'unknown'
                            ? 'text-text-muted'
                            : 'text-amber-600 dark:text-amber-400'
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
                <td className="py-2.5 pl-2 text-[10px] text-text-muted whitespace-nowrap">
                  {formatMedicalDate(s.latest.result_date)}
                  {age != null && <span className="block text-[9px]">{age} dni temu</span>}
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
    <section className="rounded-2xl border border-border-custom bg-surface/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer hover:bg-surface/50"
      >
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-text-primary">
            {categoryLabel(catKey)}
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">{series.length} markerów</p>
        </div>
        {open ? (
          <ChevronDown size={16} className="text-text-muted shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-text-muted shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-border-custom/60">
          <MarkerTable rows={series} />
        </div>
      )}
    </section>
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
            <button
              type="button"
              onClick={() => setExpandedDate(open ? null : date)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-text-primary">{formatMedicalDate(date)}</p>
                <p className="text-[10px] text-text-muted truncate">
                  {rows.length} markerów · {source}
                  {provider ? ` · ${provider}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-[9px] font-black uppercase text-text-muted">
                {freshnessLabel(fresh)}
              </span>
            </button>
            {open && (
              <div className="border-t border-border-custom/60 px-3 py-2 space-y-1.5 max-h-64 overflow-y-auto">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-[11px]">
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
              <p className="text-[12px] font-bold text-text-primary">{formatMedicalDate(date)}</p>
              <span className="text-[9px] font-black uppercase text-text-muted">
                {freshnessLabel(labFreshness(age))} · {row.reliability}
              </span>
            </div>
            <p className="text-[10px] text-text-muted mt-0.5">
              {row.source} · {row.method}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] tabular-nums">
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
            {row.notes && <p className="text-[10px] text-text-muted mt-2 leading-relaxed">{row.notes}</p>}
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
            <p className="text-[10px] font-bold text-text-secondary line-clamp-2 leading-tight">{s.marker_name}</p>
            <div className="mt-1.5">
              <ValueCell row={s.latest} />
            </div>
            <p className="text-[9px] text-text-muted mt-1">
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
          <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-text-primary">{title}</h2>
          {subtitle && <p className="text-[10px] text-text-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export { Scale };
