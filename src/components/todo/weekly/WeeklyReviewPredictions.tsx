import React from 'react';
import { useWeeklyReview } from './context/WeeklyReviewContext';
import { Target, TrendingUp, Check, X } from 'lucide-react';
import type { Prediction } from '../../../lib/predictionsApi';
import { calculateMae, calculateBrier } from './weeklyHelpers';

export default function WeeklyReviewPredictions() {
  const {
    predictions,
    handleResolveCustom,
  } = useWeeklyReview();

  const resolvedMetrics = predictions.filter(
    (p) => p.prediction_type === 'metric' && p.status === 'resolved'
  );
  const sleepPreds = resolvedMetrics.filter((p) => p.metric === 'sleep_hours');
  const executionPreds = resolvedMetrics.filter((p) => p.metric === 'execution_score');

  const sleepMae = calculateMae(sleepPreds);
  const executionMae = calculateMae(executionPreds, 100);

  const resolvedPatterns = predictions.filter(
    (p) => p.prediction_type === 'pattern' && p.status === 'resolved'
  );
  const patternBrier = calculateBrier(resolvedPatterns);

  const pendingCustom = predictions.filter(
    (p) => p.prediction_type === 'custom' && p.status === 'pending'
  );
  const resolvedCustom = predictions.filter(
    (p) => p.prediction_type === 'custom' && p.status === 'resolved'
  );

  const customBrier = calculateBrier(resolvedCustom);

  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <h3 className="text-sm font-black text-text-primary flex items-center gap-1.5 uppercase tracking-wider">
          <Target size={15} className="text-primary" />
          Krok 4: Prognozy i Kalibracja
        </h3>
        <p className="text-xs text-text-muted mt-0.5">
          Zweryfikuj swoje prognozy z ubiegłego tygodnia i zobacz wyniki kalibracji.
        </p>
      </div>

      {/* Calibration Rollup Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 dark:bg-white/[0.02] border border-border-custom/50 rounded-xl p-3 flex flex-col justify-between space-y-1">
          <span className="text-2xs font-bold text-text-muted uppercase tracking-wider">
            Prognoza Snu
          </span>
          <span className="text-base font-black text-primary">
            {sleepMae ? `±${sleepMae}h` : 'brak'}
          </span>
          <span className="text-2xs font-medium text-text-muted">Średni błąd (MAE)</span>
        </div>
        <div className="bg-slate-50 dark:bg-white/[0.02] border border-border-custom/50 rounded-xl p-3 flex flex-col justify-between space-y-1">
          <span className="text-2xs font-bold text-text-muted uppercase tracking-wider">
            Wykonanie
          </span>
          <span className="text-base font-black text-primary">
            {executionMae ? `±${executionMae}%` : 'brak'}
          </span>
          <span className="text-2xs font-medium text-text-muted">Średni błąd (MAE)</span>
        </div>
        <div className="bg-slate-50 dark:bg-white/[0.02] border border-border-custom/50 rounded-xl p-3 flex flex-col justify-between space-y-1">
          <span className="text-2xs font-bold text-text-muted uppercase tracking-wider">
            Brier Wzorców
          </span>
          <span className="text-base font-black text-primary">
            {patternBrier ? patternBrier : 'brak'}
          </span>
          <span className="text-2xs font-medium text-text-muted">Brier (0 = idealny)</span>
        </div>
      </div>

      {/* Custom predictions calibration */}
      {resolvedCustom.length > 0 && (
        <div className="bg-success/5 border border-success/10 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-success" />
            <div className="flex flex-col">
              <span className="text-xs font-black text-text-primary">
                Brier Score Twoich Prognoz
              </span>
              <span className="text-2xs text-text-muted">
                Na podstawie {resolvedCustom.length} rozstrzygniętych prognoz
              </span>
            </div>
          </div>
          <span className="text-lg font-black text-success">{customBrier}</span>
        </div>
      )}

      {/* Pending resolutions */}
      <div className="space-y-2.5">
        <span className="text-xs font-bold text-text-primary block uppercase tracking-wider">
          Rozstrzygnij prognozy własne ({pendingCustom.length})
        </span>
        {pendingCustom.length === 0 ? (
          <div className="text-center py-4 bg-slate-50 dark:bg-white/[0.01] border border-dashed border-border-custom/60 rounded-xl text-text-muted text-xs font-semibold">
            Brak prognoz własnych do rozstrzygnięcia w tym tygodniu.
          </div>
        ) : (
          <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
            {pendingCustom.map((pred: Prediction) => (
              <div
                key={pred.id}
                className="bg-slate-50 dark:bg-white/[0.01] border border-border-custom/50 rounded-xl p-3 flex items-center justify-between"
              >
                <div className="space-y-0.5 border-none">
                  <p className="text-xs font-black text-text-primary">{pred.metric}</p>
                  <div className="flex items-center gap-2 text-2xs text-text-muted">
                    <span>Data: {pred.prediction_date}</span>
                    <span>•</span>
                    <span>Pewność: {(pred.predicted_value * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleResolveCustom(pred.id, 1.0)}
                    className="w-8 h-8 rounded-lg bg-success/10 text-success hover:bg-success/20 flex items-center justify-center transition-colors"
                    title="Spełniło się"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => handleResolveCustom(pred.id, 0.0)}
                    className="w-8 h-8 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 flex items-center justify-center transition-colors"
                    title="Nie spełniło się"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
