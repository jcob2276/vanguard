import type { CorrelationStats } from '@vanguard/domain';
import { Card } from '../ui/Card';

interface SparseMetric {
  key: string;
  n: number;
  hint: string;
}

interface CorrelationsSummaryProps {
  loading: boolean;
  stats: CorrelationStats | null;
  includeWeak: boolean;
  error: string | null;
  correlationsCount: number;
  sparseMetrics: SparseMetric[];
}

export default function CorrelationsSummary({ loading, stats, includeWeak, error, correlationsCount, sparseMetrics }: CorrelationsSummaryProps) {
  return (
    <>
      {!loading && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Pary', value: stats.total_pairs },
            { label: 'Istotne', value: stats.significant },
            { label: 'Cross-domain', value: stats.cross_domain ?? 0 },
            { label: 'Metryki', value: stats.metrics_tracked },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border-custom bg-surface px-3 py-2.5 text-center">
              <p className="text-[18px] font-black tabular-nums text-text-primary">{s.value}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {!loading && stats && stats.hidden_weak != null && stats.hidden_weak > 0 && !includeWeak && (
        <p className="text-[10px] text-text-muted -mt-3">
          Ukryto {stats.hidden_weak} słabszych par (|r|&lt;0.28 lub za małe N). Włącz poniżej, żeby zobaczyć resztę.
        </p>
      )}

      {!loading && stats && stats.spearman_primary > 0 && (
        <p className="text-[10px] text-text-muted -mt-3">
          {stats.spearman_primary} par używa Spearmana (ρ) — lepszy przy nieliniowych zależnościach (np. godzina kawy, dawki).
        </p>
      )}

      {error && (
        <Card variant="danger" padding="0.75rem 1rem">
          <p className="text-[12px] text-danger">{error}</p>
        </Card>
      )}

      {loading && correlationsCount === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-36 rounded-[20px] bg-surface animate-pulse border border-border-custom" />
          ))}
        </div>
      )}

      {!loading && sparseMetrics.length > 0 && (
        <Card variant="notice" as="section" padding="1rem" className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-warning dark:text-warning">
            Zbieranie danych
          </p>
          <ul className="space-y-1">
            {sparseMetrics.map(m => (
              <li key={m.key} className="text-[11px] text-text-secondary">
                <span className="font-semibold text-text-primary">{m.key}</span> — {m.n} dni · {m.hint}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
