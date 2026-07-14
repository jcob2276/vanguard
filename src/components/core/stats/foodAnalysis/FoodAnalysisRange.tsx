import { Card } from '../../../ui/Card';
import { type FoodAnalysisResult, type FoodAnalysisDay } from '../FoodAnalysisSection';

interface FoodAnalysisRangeProps {
  res: FoodAnalysisResult & { mode: 'range' };
}

const kcalBarColor = (score: number) => {
  if (score >= 70) return 'var(--color-success)'; // text-dayC equivalent (emerald)
  if (score >= 45) return 'var(--color-warning)'; // amber
  return 'var(--color-danger)'; // text-dayB equivalent (rose)
};

interface DaysListProps {
  days: FoodAnalysisDay[];
}

function DaysList({ days }: DaysListProps) {
  return (
    <div className="space-y-1.5">
      {days.map((d) => (
        <div
          key={d.date}
          className={`flex items-center gap-2 ${d.incomplete || d.fasting ? 'opacity-[var(--opacity-50)]' : ''}`}
        >
          <span className="w-[var(--legacy-w-091)] shrink-0 text-2xs font-bold text-text-muted">
            {d.date?.slice(5) ?? d.date ?? ''}
          </span>
          <div className="flex-1 h-1.5 bg-border-custom rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: d.fasting ? '100%' : `${d.score ?? 0}%`,
                backgroundColor: d.fasting
                  ? 'var(--legacy-color-022)'
                  : d.incomplete
                  ? 'var(--legacy-color-031)'
                  : kcalBarColor(d.score ?? 0),
              }}
            />
          </div>
          <span
            className={`w-8 shrink-0 text-2xs font-bold text-right ${
              d.fasting
                ? 'text-primary'
                : d.incomplete
                ? 'text-text-muted'
                : (d.score ?? 0) >= 70
                ? 'text-dayC'
                : (d.score ?? 0) >= 45
                ? 'text-warning'
                : 'text-dayB'
            }`}
          >
            {d.fasting ? '🔵' : d.incomplete ? '⚠️' : d.score ?? 0}
          </span>
        </div>
      ))}
    </div>
  );
}

interface BestWorstDaysProps {
  bestDay?: string;
  worstDay?: string;
}

function BestWorstDays({ bestDay, worstDay }: BestWorstDaysProps) {
  return (
    <div className="flex gap-2">
      {bestDay && (
        <div className="flex-1 rounded-xl border border-dayC/15 bg-dayC/5 px-3 py-2">
          <p className="text-3xs font-bold uppercase tracking-widest text-dayC/60 mb-0.5">
            Najlepszy dzień
          </p>
          <p className="text-sm font-bold text-dayC/80">
            {bestDay.slice(5)}
          </p>
        </div>
      )}
      {worstDay && (
        <div className="flex-1 rounded-xl border border-dayB/15 bg-dayB/5 px-3 py-2">
          <p className="text-3xs font-bold uppercase tracking-widest text-dayB/60 mb-0.5">
            Najgorszy dzień
          </p>
          <p className="text-sm font-bold text-dayB/80">
            {worstDay.slice(5)}
          </p>
        </div>
      )}
    </div>
  );
}

export default function FoodAnalysisRange({ res }: FoodAnalysisRangeProps) {
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase text-text-muted">
          Średnia {res.dateFrom} → {res.dateTo}
        </span>
        <span
          className={`text-lg font-black ${
            (res.avg_score ?? 0) >= 70
              ? 'text-dayC'
              : (res.avg_score ?? 0) >= 45
              ? 'text-warning'
              : 'text-dayB'
          }`}
        >
          {res.avg_score ?? 0}/100
        </span>
      </div>

      <DaysList days={res.days} />

      <p className="text-xs text-text-secondary leading-relaxed border-t border-border-custom pt-3">
        {res.pattern_analysis}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {(res.top_issues?.length ?? 0) > 0 && (
          <div>
            <p className="text-2xs font-bold uppercase tracking-widest text-dayB mb-1.5">
              Do poprawy
            </p>
            <ul className="space-y-1">
              {res.top_issues?.map((t, i) => (
                <li key={i} className="text-2xs text-text-muted">
                  · {t}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(res.strengths?.length ?? 0) > 0 && (
          <div>
            <p className="text-2xs font-bold uppercase tracking-widest text-dayC mb-1.5">
              Mocne strony
            </p>
            <ul className="space-y-1">
              {res.strengths?.map((s, i) => (
                <li key={i} className="text-2xs text-text-muted">
                  · {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {(res.action_steps?.length ?? 0) > 0 && (
        <div className="border-t border-border-custom pt-3">
          <p className="text-2xs font-bold uppercase tracking-widest text-primary mb-2">
            Co zrobić jutro
          </p>
          <ol className="space-y-1.5">
            {res.action_steps?.map((s, i) => (
              <li key={i} className="flex gap-2 text-xs text-text-secondary">
                <span className="font-bold text-primary shrink-0">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Nutrition profile + trend */}
      {(res.nutrition_profile || res.trend) && (
        <div className="border-t border-border-custom pt-3 space-y-2">
          {res.nutrition_profile && (
            <p className="text-xs text-text-secondary leading-relaxed italic">
              {res.nutrition_profile}
            </p>
          )}
          {res.trend && (
            <div className="flex items-center gap-2">
              <span
                className={`text-2xs font-bold uppercase px-2 py-1 rounded ${
                  res.trend === 'improving'
                    ? 'bg-dayC/10 text-dayC'
                    : res.trend === 'degrading'
                    ? 'bg-dayB/10 text-dayB'
                    : 'bg-surface-solid/40 border border-border-custom text-text-muted'
                }`}
              >
                {res.trend === 'improving'
                  ? '↑ Poprawa'
                  : res.trend === 'degrading'
                  ? '↓ Regres'
                  : '→ Stabilnie'}
              </span>
              {res.trend_note && (
                <p className="text-2xs text-text-muted flex-1">{res.trend_note}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Best / worst day */}
      {(res.best_day || res.worst_day) && (
        <BestWorstDays bestDay={res.best_day} worstDay={res.worst_day} />
      )}

      {/* Chronic gaps */}
      {(res.chronic_gaps?.length ?? 0) > 0 && (
        <div>
          <p className="text-2xs font-bold uppercase tracking-widest text-warning mb-1.5">
            Chroniczne braki
          </p>
          <div className="flex flex-wrap gap-1.5">
            {res.chronic_gaps?.map((g, i) => (
              <span
                key={i}
                className="rounded border border-warning/20 bg-warning/5 px-2 py-0.5 text-2xs text-warning dark:text-warning"
              >
                {g}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Training nutrition note */}
      {res.training_nutrition_note && (
        <div className="rounded-xl border border-primary/10 bg-primary/5 px-3 py-2.5">
          <p className="text-2xs font-bold uppercase tracking-widest text-primary/50 mb-1">
            Żywienie vs trening
          </p>
          <p className="text-xs text-text-secondary leading-relaxed">
            {res.training_nutrition_note}
          </p>
        </div>
      )}
    </Card>
  );
}
