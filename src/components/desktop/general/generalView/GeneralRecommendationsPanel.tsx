import React from 'react';
import { Panel } from '../../shell/Panel';
import { Card } from '../../../ui/Card';
import type { OracleRecommendation } from '../../../../lib/recommendationsApi';
import { Target, CheckCircle2, XCircle, HelpCircle, Calendar } from 'lucide-react';
import { getTodayWarsaw } from '../../../../lib/date';

interface GeneralRecommendationsPanelProps {
  recommendations: OracleRecommendation[];
}

const METRIC_LABELS: Record<string, string> = {
  sleep_hours: 'Sen (h)',
  readiness_score: 'Gotowość',
  execution_score: 'Zadania (%)',
};

function getDaysRemaining(createdAt: string, windowDays: number, todayStr: string) {
  const createdDate = new Date(createdAt.slice(0, 10) + 'T12:00:00Z');
  const endDate = new Date(createdDate.getTime() + windowDays * 24 * 60 * 60 * 1000);
  const today = new Date(todayStr + 'T12:00:00Z');
  const diffTime = endDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

function getOutcomeBadge(outcome: string | null) {
  switch (outcome) {
    case 'success':
      return (
        <span className="flex items-center gap-1 bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-full text-2xs font-black uppercase tracking-wider">
          <CheckCircle2 size={10} />
          Sukces
        </span>
      );
    case 'fail':
      return (
        <span className="flex items-center gap-1 bg-danger/10 text-danger border border-danger/20 px-2 py-0.5 rounded-full text-2xs font-black uppercase tracking-wider">
          <XCircle size={10} />
          Porażka
        </span>
      );
    case 'no_data':
      return (
        <span className="flex items-center gap-1 bg-slate-500/10 text-text-muted border border-border-custom px-2 py-0.5 rounded-full text-2xs font-black uppercase tracking-wider">
          <HelpCircle size={10} />
          Brak Danych
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 bg-warning/10 text-warning border border-warning/20 px-2 py-0.5 rounded-full text-2xs font-black uppercase tracking-wider">
          Ewaluacja
        </span>
      );
  }
}

function RecommendationPendingCard({ rec, todayStr }: { rec: OracleRecommendation; todayStr: string }) {
  const daysLeft = getDaysRemaining(rec.created_at, rec.evaluation_window_days, todayStr);
  return (
    <Card padding="0.75rem" className="hover:border-primary/20 hover:shadow-sm transition-all duration-150 space-y-2">
      <p className="text-xs font-bold text-text-primary leading-relaxed">
        {rec.recommendation_text}
      </p>
      <div className="flex flex-wrap items-center gap-3 text-2xs text-text-muted pt-1 border-t border-border-custom/30">
        <span className="flex items-center gap-1 bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.5 rounded-md font-bold">
          <Target size={10} />
          {METRIC_LABELS[rec.related_metric] || rec.related_metric}
          {rec.success_threshold !== null && ` ≥ ${rec.success_threshold}`}
        </span>
        <span className="flex items-center gap-1">
          <Calendar size={10} />
          {daysLeft > 0 ? `${daysLeft} dni do końca` : 'Dziś ewaluacja'}
        </span>
        <span className="ml-auto text-2xs font-medium opacity-60">
          Dodano: {rec.created_at.slice(0, 10)}
        </span>
      </div>
    </Card>
  );
}

function RecommendationHistoryCard({ rec }: { rec: OracleRecommendation }) {
  const baselineVal = rec.baseline_value !== null ? rec.baseline_value.toFixed(1) : '—';
  const actualVal = rec.actual_value !== null ? rec.actual_value.toFixed(1) : '—';
  return (
    <Card padding="0.75rem" className="flex flex-col justify-between space-y-2 hover:border-border-custom transition-all duration-150">
      <p className="text-xs text-text-secondary leading-relaxed font-medium">
        {rec.recommendation_text}
      </p>
      <div className="space-y-1.5 pt-1.5 border-t border-border-custom/30 text-2xs text-text-muted">
        <div className="flex justify-between items-center">
          <span>Status:</span>
          {getOutcomeBadge(rec.outcome)}
        </div>
        <div className="flex justify-between items-center">
          <span>Metryka:</span>
          <span className="font-semibold text-text-secondary">
            {METRIC_LABELS[rec.related_metric] || rec.related_metric}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span>Wynik (Bazowy → Rzecz.):</span>
          <span className="font-semibold text-text-secondary">
            {baselineVal} → {actualVal}
          </span>
        </div>
      </div>
    </Card>
  );
}

export default function GeneralRecommendationsPanel({
  recommendations,
}: GeneralRecommendationsPanelProps) {
  const todayStr = React.useMemo(() => getTodayWarsaw(), []);
  const pending = recommendations.filter((r) => r.status === 'pending');
  const evaluated = recommendations.filter((r) => r.status === 'evaluated');

  // Calculate stats
  const successes = evaluated.filter((r) => r.outcome === 'success').length;
  const fails = evaluated.filter((r) => r.outcome === 'fail').length;
  const noData = evaluated.filter((r) => r.outcome === 'no_data').length;
  const totalEvaluated = successes + fails;
  const successRate = totalEvaluated > 0 ? Math.round((successes / totalEvaluated) * 100) : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Active Recommendations */}
        <div className="md:col-span-2">
          <Panel title={`Aktywne Zalecenia Wyroczni (${pending.length})`}>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {pending.map((rec) => (
                <RecommendationPendingCard key={rec.id} rec={rec} todayStr={todayStr} />
              ))}
              {pending.length === 0 && (
                <div className="text-center py-8 text-text-muted text-xs font-semibold border border-dashed border-border-custom/60 rounded-xl bg-surface/20">
                  Brak aktywnych zaleceń. Zapytaj Wyrocznię o radę, aby wyznaczyć nowe zalecenia.
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* Evaluation Stats */}
        <div>
          <Panel title="Skuteczność Wyroczni">
            <div className="space-y-4 py-1">
              <div className="flex items-center justify-between bg-slate-50 dark:bg-white/[0.015] border border-border-custom/50 rounded-2xl p-4">
                <div className="flex flex-col">
                  <span className="text-xs font-black text-text-muted uppercase tracking-wider">
                    Współczynnik Sukcesu
                  </span>
                  <span className="text-2xs text-text-muted mt-0.5">
                    Na podstawie {totalEvaluated} rozstrzygnięć
                  </span>
                </div>
                <span className="text-2xl font-black text-success">
                  {successRate !== null ? `${successRate}%` : '—'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-success/5 border border-success/10 rounded-xl p-2 flex flex-col justify-between">
                  <span className="text-success font-black">{successes}</span>
                  <span className="text-2xs text-text-muted font-bold uppercase tracking-wide mt-0.5">Sukcesy</span>
                </div>
                <div className="bg-danger/5 border border-danger/10 rounded-xl p-2 flex flex-col justify-between">
                  <span className="text-danger font-black">{fails}</span>
                  <span className="text-2xs text-text-muted font-bold uppercase tracking-wide mt-0.5">Błędy</span>
                </div>
                <div className="bg-slate-500/5 border border-border-custom rounded-xl p-2 flex flex-col justify-between">
                  <span className="text-text-muted font-black">{noData}</span>
                  <span className="text-2xs text-text-muted font-bold uppercase tracking-wide mt-0.5">Brak info</span>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {/* Recommendations History */}
      {evaluated.length > 0 && (
        <Panel title={`Historia Zaleceń (${evaluated.length})`}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 max-h-[350px] overflow-y-auto pr-1">
            {evaluated.map((rec) => (
              <RecommendationHistoryCard key={rec.id} rec={rec} />
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
