import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { CorrelationResult } from '../../lib/correlations';
import { CATEGORY_LABELS, CONFIDENCE_LABELS, formatLag, METHOD_LABELS, rColor } from '../../lib/correlations';

interface Props {
  item: CorrelationResult;
  expanded?: boolean;
}

function MiniTip({ active, payload }: { active?: boolean; payload?: { payload: { day: string; x: number; y: number } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border-custom bg-surface px-2 py-1 text-[10px] shadow-md">
      <p className="text-text-muted">{p.day}</p>
      <p className="font-semibold text-text-primary">{p.x.toFixed(1)} → {p.y.toFixed(1)}</p>
    </div>
  );
}

export default function CorrelationCard({ item, expanded = false }: Props) {
  const color = rColor(item.r);
  const showChart = item.scatter.length >= 3;
  const method = item.method ?? 'pearson';

  return (
    <article
      className={`rounded-[20px] border bg-surface p-4 shadow-sm transition-colors ${
        item.significant ? 'border-primary/25' : 'border-border-custom'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="text-[8px] font-black uppercase tracking-widest text-text-muted px-1.5 py-0.5 rounded bg-surface-solid">
              {CATEGORY_LABELS[item.category] ?? item.category}
            </span>
            {item.cross_domain && (
              <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 px-1.5 py-0.5 rounded bg-emerald-500/10">
                Cross
              </span>
            )}
            {item.discovered && !item.cross_domain && (
              <span className="text-[8px] font-black uppercase tracking-widest text-indigo-500 px-1.5 py-0.5 rounded bg-indigo-500/10">
                Odkryte
              </span>
            )}
            <span className="text-[8px] font-black uppercase tracking-widest text-text-muted px-1.5 py-0.5 rounded bg-surface-solid" title={METHOD_LABELS[method]}>
              {method === 'spearman' ? 'ρ' : 'r'}
            </span>
            <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
              item.confidence === 'solid' ? 'bg-emerald-500/10 text-emerald-600' :
              item.confidence === 'building' ? 'bg-amber-500/10 text-amber-600' :
              'bg-slate-500/10 text-text-muted'
            }`}>
              {CONFIDENCE_LABELS[item.confidence]} · N={item.n}
            </span>
          </div>
          <h3 className="text-[13px] font-bold text-text-primary leading-snug">{item.label}</h3>
          <p className="text-[10px] text-text-muted mt-0.5">Lag: {formatLag(item.lag_days)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[22px] font-black tabular-nums leading-none" style={{ color }}>
            {item.r > 0 ? '+' : ''}{item.r.toFixed(2)}
          </p>
          <p className="text-[9px] font-semibold text-text-muted mt-0.5">{item.interpretation}</p>
        </div>
      </div>

      <p className="text-[11px] text-text-secondary leading-relaxed mb-3">{item.note}</p>

      {!item.has_enough_data && (
        <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 mb-2">
          Za mało par danych — loguj regularnie, sygnał pojawi się po kilku dniach.
        </p>
      )}

      {showChart && (
        <div className={expanded ? 'h-[180px]' : 'h-[120px]'}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <ScatterChart margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-custom)" />
              <XAxis
                dataKey="x"
                type="number"
                name={item.x_label}
                tick={{ fontSize: 8, fill: 'var(--color-text-muted)' }}
                label={expanded ? { value: item.x_label, position: 'insideBottom', offset: -2, fontSize: 9, fill: 'var(--color-text-muted)' } : undefined}
              />
              <YAxis
                dataKey="y"
                type="number"
                name={item.y_label}
                tick={{ fontSize: 8, fill: 'var(--color-text-muted)' }}
                width={32}
              />
              <Tooltip content={<MiniTip />} />
              <Scatter data={item.scatter} fill={color} fillOpacity={0.65} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-border-custom/60 text-[9px] text-text-muted">
        <span>{item.x_label} ↔ {item.y_label}</span>
        {item.r_pearson != null && item.r_spearman != null && method === 'spearman' && (
          <span title="Pearson r">r={item.r_pearson.toFixed(2)}</span>
        )}
        {item.significant ? (
          <span className="text-emerald-600 font-bold">p={item.p.toFixed(3)}</span>
        ) : (
          <span>p={item.p.toFixed(3)}</span>
        )}
      </div>
    </article>
  );
}
