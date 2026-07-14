import { Card } from '../../../ui/Card';
import { type FoodAnalysisResult } from '../FoodAnalysisSection';

interface FoodAnalysisSingleProps {
  res: FoodAnalysisResult & { mode: 'single' };
}

export default function FoodAnalysisSingle({ res }: FoodAnalysisSingleProps) {
  return (
    <div className="space-y-3">
      {res.fasting && (
        <Card className="space-y-1.5 border border-info/15" style={{ background: 'rgba(59, 130, 246, 0.03)' }}>
          <div className="flex items-center gap-2">
            <span className="text-base">🔵</span>
            <span className="text-[10px] font-bold uppercase text-info dark:text-info">
              Post — {res.date}
            </span>
          </div>
          {res.day_quality_analysis && (
            <p className="text-[11px] text-text-secondary">{res.day_quality_analysis}</p>
          )}
        </Card>
      )}

      {!res.fasting && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-text-muted">
              Jakość dnia {res.date}
            </span>
            <span
              className={`text-lg font-black ${
                (res.day_quality_score ?? 0) >= 70
                  ? 'text-dayC'
                  : (res.day_quality_score ?? 0) >= 45
                  ? 'text-warning'
                  : 'text-dayB'
              }`}
            >
              {res.day_quality_score ?? 0}/100
            </span>
          </div>
          <p className="text-[11px] text-text-secondary leading-relaxed">
            {res.day_quality_analysis}
          </p>
          <div className="space-y-1.5 pt-1.5 border-t border-border-custom">
            {res.items
              .sort((a, b) => b.food_quality_score - a.food_quality_score)
              .map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span
                    className={`shrink-0 text-[10px] font-bold w-7 text-right ${
                      item.food_quality_score >= 70
                        ? 'text-dayC'
                        : item.food_quality_score >= 45
                        ? 'text-warning'
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
            const protDist = res.protein_distribution;
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
                          backgroundColor: m.mps ? 'var(--color-success)' : m.protein_g >= 15 ? 'var(--color-warning)' : 'var(--color-danger)',
                        }}
                      />
                    </div>
                    <span
                      className={`text-[9px] font-bold w-10 text-right shrink-0 ${
                        m.mps ? 'text-dayC' : m.protein_g >= 15 ? 'text-warning' : 'text-dayB'
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
        </Card>
      )}
    </div>
  );
}
