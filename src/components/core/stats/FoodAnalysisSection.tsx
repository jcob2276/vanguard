import { Pressable, ControlInput } from '../../ui/ControlPrimitives';
import FoodAnalysisSingle from './foodAnalysis/FoodAnalysisSingle';
import FoodAnalysisRange from './foodAnalysis/FoodAnalysisRange';

interface FoodQualityItem {
  food_quality_score: number;
  name: string;
  quality_reason: string;
}

interface ProteinDistribution {
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
  return (
    <div className="border-t border-border-custom pt-3 space-y-3">
      <div className="flex gap-1">
        {[1, 7, 14, 30].map((p) => (
          <Pressable
            key={p}
            onClick={() => {
              setAnalyzePeriod(p);
              setAnalyzeResult(null);
            }}
            className={`flex-1 rounded-xl border py-2 text-2xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              analyzePeriod === p
                ? 'border-primary/30 dark:border-primary/40 bg-primary/[0.06] text-primary font-bold shadow-none'
                : 'border-border-custom bg-surface-solid/40 text-text-muted hover:text-text-primary'
            }`}
          >
            {p === 1 ? '1D' : `${p}D`}
          </Pressable>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {analyzePeriod === 1 && (
          <ControlInput
            type="date"
            value={analyzeDate}
            onChange={(e) => {
              setAnalyzeDate(e.target.value);
              setAnalyzeResult(null);
            }}
            className="flex-1 rounded-xl border border-border-custom bg-surface px-3 py-2 text-xs font-bold uppercase text-text-secondary focus:outline-none focus:border-primary/45"
          />
        )}
        {analyzePeriod > 1 && (
          <p className="flex-1 text-xs font-bold uppercase text-text-muted">
            Ostatnie {analyzePeriod} dni
          </p>
        )}
        <Pressable
          variant="outline"
          size="sm"
          onClick={analyzeFood}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? 'Analizuję...' : 'Analizuj'}
        </Pressable>
      </div>

      {analyzeResult && analyzeResult.mode === 'single' && (
        <FoodAnalysisSingle res={analyzeResult} />
      )}

      {analyzeResult && analyzeResult.mode === 'range' && (
        <FoodAnalysisRange res={analyzeResult} />
      )}
    </div>
  );
}
