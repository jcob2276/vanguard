export interface FoodQualityItem {
  food_quality_score: number;
  name: string;
  quality_reason: string;
}

export interface ProteinDistribution {
  meal: string;
  protein_g: number;
  mps?: boolean;
  note?: string;
}

export interface FoodAnalysisDay {
  date?: string;
  incomplete?: boolean;
  fasting?: boolean;
  score?: number;
}

export type FoodAnalysisResult =
  | {
      success?: boolean;
      mode: 'single';
      fasting?: boolean;
      date?: string;
      day_quality_analysis?: string;
      day_quality_score?: number;
      items: FoodQualityItem[];
      protein_distribution?: ProteinDistribution[];
    }
  | {
      success?: boolean;
      mode: 'range';
      dateFrom?: string;
      dateTo?: string;
      avg_score?: number;
      days: FoodAnalysisDay[];
      pattern_analysis?: string;
      top_issues?: string[];
      strengths?: string[];
      action_steps?: string[];
      nutrition_profile?: string;
      trend?: string;
      trend_note?: string;
      best_day?: string;
      worst_day?: string;
      chronic_gaps?: string[];
      training_nutrition_note?: string;
    };

interface FoodAnalysisSectionProps {
  analyzePeriod: number;
  setAnalyzePeriod: (period: number) => void;
  analyzeResult: FoodAnalysisResult | null;
  setAnalyzeResult: (res: FoodAnalysisResult | null) => void;
  analyzeDate: string;
  setAnalyzeDate: (date: string) => void;
  analyzeFood: () => void;
  isAnalyzing: boolean;
}

export function FoodAnalysisSection({
  analyzePeriod,
  setAnalyzePeriod,
  analyzeResult,
  setAnalyzeResult,
  analyzeDate,
  setAnalyzeDate,
  analyzeFood,
  isAnalyzing,
}: FoodAnalysisSectionProps) {
  const kcalBarColor = (score: number) => {
    if (score >= 70) return '#10b981'; // text-dayC equivalent (emerald)
    if (score >= 45) return '#f59e0b'; // amber
    return '#f43f5e'; // text-dayB equivalent (rose)
  };

  return (
    <div className="border-t border-border-custom pt-3 space-y-3">
      <div className="flex gap-1">
        {[1, 7, 14, 30].map((p) => (
          <button
            key={p}
            onClick={() => {
              setAnalyzePeriod(p);
              setAnalyzeResult(null);
            }}
            className={`flex-1 rounded-xl border py-2 text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              analyzePeriod === p
                ? 'border-primary/30 dark:border-primary/40 bg-primary/[0.06] text-primary font-bold shadow-none'
                : 'border-border-custom bg-surface-solid/40 text-text-muted hover:text-text-primary'
            }`}
          >
            {p === 1 ? '1D' : `${p}D`}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {analyzePeriod === 1 && (
          <input
            type="date"
            value={analyzeDate}
            onChange={(e) => {
              setAnalyzeDate(e.target.value);
              setAnalyzeResult(null);
            }}
            className="flex-1 rounded-xl border border-border-custom bg-surface px-3 py-2 text-[10px] font-bold uppercase text-text-secondary focus:outline-none focus:border-primary/45"
          />
        )}
        {analyzePeriod > 1 && (
          <p className="flex-1 text-[10px] font-bold uppercase text-text-muted">
            Ostatnie {analyzePeriod} dni
          </p>
        )}
        <button
          onClick={analyzeFood}
          disabled={isAnalyzing}
          className="rounded-xl border border-border-custom bg-surface px-4 py-2 text-[10px] font-bold uppercase text-text-secondary transition-all hover:bg-surface-solid hover:text-primary disabled:opacity-40 cursor-pointer"
        >
          {isAnalyzing ? 'Analizuję...' : 'Analizuj'}
        </button>
      </div>

      {analyzeResult && analyzeResult.mode === 'single' && analyzeResult.fasting && (
        <div className="rounded-xl border border-blue-500/15 bg-blue-500/[0.03] p-4 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-base">🔵</span>
            <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">
              Post — {analyzeResult.date}
            </span>
          </div>
          {analyzeResult.day_quality_analysis && (
            <p className="text-[11px] text-text-secondary">{analyzeResult.day_quality_analysis}</p>
          )}
        </div>
      )}

      {analyzeResult && analyzeResult.mode === 'single' && !analyzeResult.fasting && (
        <div className="rounded-xl border border-border-custom bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-text-muted">
              Jakość dnia {analyzeResult.date}
            </span>
            <span
              className={`text-lg font-black ${
                (analyzeResult.day_quality_score ?? 0) >= 70
                  ? 'text-dayC'
                  : (analyzeResult.day_quality_score ?? 0) >= 45
                  ? 'text-amber-500'
                  : 'text-dayB'
              }`}
            >
              {analyzeResult.day_quality_score ?? 0}/100
            </span>
          </div>
          <p className="text-[11px] text-text-secondary leading-relaxed">
            {analyzeResult.day_quality_analysis}
          </p>
          <div className="space-y-1.5 pt-1.5 border-t border-border-custom">
            {analyzeResult.items
              .sort((a, b) => b.food_quality_score - a.food_quality_score)
              .map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span
                    className={`shrink-0 text-[10px] font-bold w-7 text-right ${
                      item.food_quality_score >= 70
                        ? 'text-dayC'
                        : item.food_quality_score >= 45
                        ? 'text-amber-500'
                        : 'text-dayB'
                    }`}
                  >
                    {item.food_quality_score}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-text-primary truncate">{item.name}</p>
                    <p className="text-[9px] text-text-muted">{item.quality_reason}</p>
                  </div>
                </div>
              ))}
          </div>

          {/* Protein distribution by meal */}
          {(() => {
            const protDist = analyzeResult.protein_distribution;
            if (!protDist || protDist.length === 0) return null;
            return (
              <div className="border-t border-border-custom pt-3 space-y-2">
                <p className="text-[8px] font-bold uppercase tracking-widest text-text-muted">
                  Białko / posiłek
                </p>
                {protDist.map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[9px] font-bold w-20 shrink-0 text-text-muted capitalize truncate">
                      {m.meal}
                    </span>
                    <div className="flex-1 h-1.5 bg-border-custom rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (m.protein_g / 40) * 100)}%`,
                          backgroundColor: m.mps ? '#10b981' : m.protein_g >= 15 ? '#f59e0b' : '#f43f5e',
                        }}
                      />
                    </div>
                    <span
                      className={`text-[9px] font-bold w-10 text-right shrink-0 ${
                        m.mps ? 'text-dayC' : m.protein_g >= 15 ? 'text-amber-500' : 'text-dayB'
                      }`}
                    >
                      {m.protein_g}g
                    </span>
                  </div>
                ))}
                {protDist.some((m) => m.note) && (
                  <p className="text-[9px] text-text-muted leading-relaxed">
                    {protDist.find((m) => m.note)?.note}
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {analyzeResult && analyzeResult.mode === 'range' && (
        <div className="rounded-xl border border-border-custom bg-surface p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-text-muted">
              Średnia {analyzeResult.dateFrom} → {analyzeResult.dateTo}
            </span>
            <span
              className={`text-lg font-black ${
                (analyzeResult.avg_score ?? 0) >= 70
                  ? 'text-dayC'
                  : (analyzeResult.avg_score ?? 0) >= 45
                  ? 'text-amber-500'
                  : 'text-dayB'
              }`}
            >
              {analyzeResult.avg_score ?? 0}/100
            </span>
          </div>

          <div className="space-y-1.5">
            {analyzeResult.days.map((d) => (
              <div
                key={d.date}
                className={`flex items-center gap-2 ${d.incomplete || d.fasting ? 'opacity-50' : ''}`}
              >
                <span className="w-[52px] shrink-0 text-[8px] font-bold text-text-muted">
                  {d.date?.slice(5) ?? d.date ?? ''}
                </span>
                <div className="flex-1 h-1.5 bg-border-custom rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: d.fasting ? '100%' : `${d.score ?? 0}%`,
                      backgroundColor: d.fasting
                        ? '#4f46e5'
                        : d.incomplete
                        ? '#94a3b8'
                        : kcalBarColor(d.score ?? 0),
                    }}
                  />
                </div>
                <span
                  className={`w-8 shrink-0 text-[9px] font-bold text-right ${
                    d.fasting
                      ? 'text-indigo-600'
                      : d.incomplete
                      ? 'text-text-muted'
                      : (d.score ?? 0) >= 70
                      ? 'text-dayC'
                      : (d.score ?? 0) >= 45
                      ? 'text-amber-500'
                      : 'text-dayB'
                  }`}
                >
                  {d.fasting ? '🔵' : d.incomplete ? '⚠️' : d.score ?? 0}
                </span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-text-secondary leading-relaxed border-t border-border-custom pt-3">
            {analyzeResult.pattern_analysis}
          </p>

          <div className="grid grid-cols-2 gap-3">
            {(analyzeResult.top_issues?.length ?? 0) > 0 && (
              <div>
                <p className="text-[8px] font-bold uppercase tracking-widest text-dayB mb-1.5">
                  Do poprawy
                </p>
                <ul className="space-y-1">
                  {analyzeResult.top_issues?.map((t, i) => (
                    <li key={i} className="text-[9px] text-text-muted">
                      · {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(analyzeResult.strengths?.length ?? 0) > 0 && (
              <div>
                <p className="text-[8px] font-bold uppercase tracking-widest text-dayC mb-1.5">
                  Mocne strony
                </p>
                <ul className="space-y-1">
                  {analyzeResult.strengths?.map((s, i) => (
                    <li key={i} className="text-[9px] text-text-muted">
                      · {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {(analyzeResult.action_steps?.length ?? 0) > 0 && (
            <div className="border-t border-border-custom pt-3">
              <p className="text-[8px] font-bold uppercase tracking-widest text-primary mb-2">
                Co zrobić jutro
              </p>
              <ol className="space-y-1.5">
                {analyzeResult.action_steps?.map((s, i) => (
                  <li key={i} className="flex gap-2 text-[10px] text-text-secondary">
                    <span className="font-bold text-primary shrink-0">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Nutrition profile + trend */}
          {(analyzeResult.nutrition_profile || analyzeResult.trend) && (
            <div className="border-t border-border-custom pt-3 space-y-2">
              {analyzeResult.nutrition_profile && (
                <p className="text-[10px] text-text-secondary leading-relaxed italic">
                  {analyzeResult.nutrition_profile}
                </p>
              )}
              {analyzeResult.trend && (
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[8px] font-bold uppercase px-2 py-1 rounded ${
                      analyzeResult.trend === 'improving'
                        ? 'bg-dayC/10 text-dayC'
                        : analyzeResult.trend === 'degrading'
                        ? 'bg-dayB/10 text-dayB'
                        : 'bg-surface-solid/40 border border-border-custom text-text-muted'
                    }`}
                  >
                    {analyzeResult.trend === 'improving'
                      ? '↑ Poprawa'
                      : analyzeResult.trend === 'degrading'
                      ? '↓ Regres'
                      : '→ Stabilnie'}
                  </span>
                  {analyzeResult.trend_note && (
                    <p className="text-[9px] text-text-muted flex-1">{analyzeResult.trend_note}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Best / worst day */}
          {(analyzeResult.best_day || analyzeResult.worst_day) && (
            <div className="flex gap-2">
              {analyzeResult.best_day && (
                <div className="flex-1 rounded-xl border border-dayC/15 bg-dayC/5 px-3 py-2">
                  <p className="text-[7px] font-bold uppercase tracking-widest text-dayC/60 mb-0.5">
                    Najlepszy dzień
                  </p>
                  <p className="text-[13px] font-bold text-dayC/80">
                    {analyzeResult.best_day?.slice(5)}
                  </p>
                </div>
              )}
              {analyzeResult.worst_day && (
                <div className="flex-1 rounded-xl border border-dayB/15 bg-dayB/5 px-3 py-2">
                  <p className="text-[7px] font-bold uppercase tracking-widest text-dayB/60 mb-0.5">
                    Najgorszy dzień
                  </p>
                  <p className="text-[13px] font-bold text-dayB/80">
                    {analyzeResult.worst_day?.slice(5)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Chronic gaps */}
          {(analyzeResult.chronic_gaps?.length ?? 0) > 0 && (
            <div>
              <p className="text-[8px] font-bold uppercase tracking-widest text-orange-500 mb-1.5">
                Chroniczne braki
              </p>
              <div className="flex flex-wrap gap-1.5">
                {analyzeResult.chronic_gaps?.map((g, i) => (
                  <span
                    key={i}
                    className="rounded border border-orange-500/20 bg-orange-500/5 px-2 py-0.5 text-[9px] text-orange-600 dark:text-orange-400"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Training nutrition note */}
          {analyzeResult.training_nutrition_note && (
            <div className="rounded-xl border border-primary/10 bg-primary/5 px-3 py-2.5">
              <p className="text-[8px] font-bold uppercase tracking-widest text-primary/50 mb-1">
                Żywienie vs trening
              </p>
              <p className="text-[10px] text-text-secondary leading-relaxed">
                {analyzeResult.training_nutrition_note}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
