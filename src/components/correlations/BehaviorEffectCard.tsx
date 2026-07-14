import type { BehaviorEffectResult } from '@vanguard/domain';
import { behaviorLabel, CONFIDENCE_LABELS } from '@vanguard/domain';
import { Card } from '../ui/Card';

export default function BehaviorEffectCard({ item }: { item: BehaviorEffectResult }) {
  const label = behaviorLabel(item.behavior_key);
  const delta = item.delta;
  const deltaStr = delta != null ? (delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)) : '—';

  return (
    <Card variant="glass" padding="1rem">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <span className="text-2xs font-black uppercase tracking-widest text-text-muted">
            Zachowanie · recovery jutro
          </span>
          <h3 className="text-sm font-bold text-text-primary capitalize mt-0.5">{label}</h3>
        </div>
        <span className={`text-2xs font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 ${
          item.confidence === 'solid' ? 'bg-success/10 text-success' :
          item.confidence === 'building' ? 'bg-warning/10 text-warning' :
          'bg-slate-500/10 text-text-muted'
        }`}>
          {CONFIDENCE_LABELS[item.confidence]}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-xl bg-surface-solid/60 p-2 text-center">
          <p className="text-2xs font-black uppercase text-text-muted">Z</p>
          <p className="text-base font-black text-text-primary">{item.mean_with ?? '—'}</p>
          <p className="text-2xs text-text-muted">n={item.n_with}</p>
        </div>
        <div className="rounded-xl bg-surface-solid/60 p-2 text-center">
          <p className="text-2xs font-black uppercase text-text-muted">Bez</p>
          <p className="text-base font-black text-text-primary">{item.mean_without ?? '—'}</p>
          <p className="text-2xs text-text-muted">n={item.n_without}</p>
        </div>
        <div className="rounded-xl bg-primary/5 p-2 text-center">
          <p className="text-2xs font-black uppercase text-text-muted">Δ recovery</p>
          <p className={`text-base font-black ${delta != null && delta > 0 ? 'text-success' : delta != null && delta < 0 ? 'text-danger' : 'text-text-primary'}`}>
            {deltaStr}
          </p>
          {item.pct_change != null && (
            <p className="text-2xs text-text-muted">{item.pct_change > 0 ? '+' : ''}{item.pct_change.toFixed(0)}%</p>
          )}
        </div>
      </div>

      {item.dose_response && (
        <p className="text-xs text-text-secondary mb-2">
          Dose-response: {item.dose_response.beta_final.toFixed(2)} pkt/jednostkę
          {item.dose_response.prior_used ? ' (z shrinkage populacyjnym)' : ''}
          · N={item.dose_response.n}
        </p>
      )}

      <p className="text-2xs text-text-muted">
        {item.significant
          ? `Istotne statystycznie (p=${item.p_value?.toFixed(3)}, d=${item.cohens_d?.toFixed(2) ?? '—'})`
          : `Obserwacja robocza — za mało dni lub brak istotności (p=${item.p_value?.toFixed(3) ?? '—'})`}
      </p>
    </Card>
  );
}
