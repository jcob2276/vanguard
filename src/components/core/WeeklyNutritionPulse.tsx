import { AlertCircle, CheckCircle2, Utensils } from 'lucide-react';
import { useMemo } from 'react';
import { useNutritionData } from './useNutritionData';
import { needsNutritionCorrection } from '../../lib/horizonSignals';
import {
  buildWeeklyNutritionPulse,
  formatGrams,
  nutritionPulseHeadline,
} from '../../lib/weeklyNutritionPulse';

export default function WeeklyNutritionPulse({ weeklyCalories, refreshSignal }: { weeklyCalories: number; refreshSignal: number }) {
  const data = useNutritionData({ weeklyCalories, refreshSignal });

  const pulse = useMemo(
    () => buildWeeklyNutritionPulse({
      rows: data.rows,
      proteinGoal: data.proteinGoal,
      kcalTarget: data.kcalTarget,
    }),
    [data.rows, data.proteinGoal, data.kcalTarget],
  );

  const needsAttention = needsNutritionCorrection({
    loggedDays: pulse.loggedDays,
    averageProtein: pulse.avgProtein,
    proteinGoal: pulse.proteinGoal,
    caloriesDeltaPct: pulse.caloriesDeltaPct,
  }) || (pulse.avgQuality != null && pulse.avgQuality < 50);

  return (
    <section className="rounded-3xl border border-border-custom/60 bg-surface/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-2xs font-black uppercase tracking-widest text-text-muted">
            <Utensils size={12} /> Odżywianie · 7 dni
          </p>
          <p className="mt-1 text-base font-bold text-text-primary">
            {data.loading ? 'Ładuję przebieg…' : nutritionPulseHeadline(pulse)}
          </p>
        </div>
        {needsAttention ? <AlertCircle className="text-warning" size={18} /> : <CheckCircle2 className="text-success" size={18} />}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border-custom/40 pt-3">
        <Metric label="Zapisane dni" value={`${pulse.loggedDays}/7`} />
        <Metric
          label="Śr. kcal"
          value={pulse.avgCalories == null ? '—' : `${pulse.avgCalories}`}
        />
        <Metric
          label="vs cel"
          value={`${pulse.caloriesDeltaPct > 0 ? '+' : ''}${pulse.caloriesDeltaPct}%`}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border-custom/40 pt-3">
        <Metric
          label="Białko"
          value={pulse.avgProtein == null ? '—' : `${pulse.avgProtein} / ${pulse.proteinGoal} g`}
        />
        <Metric label="Węgle" value={formatGrams(pulse.avgCarbs)} />
        <Metric label="Tłuszcze" value={formatGrams(pulse.avgFat)} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border-custom/40 pt-3">
        <Metric
          label="Jakość"
          value={pulse.avgQuality == null ? '—' : `${pulse.avgQuality}/100`}
        />
        <Metric label="Błonnik" value={formatGrams(pulse.avgFiber)} />
        <Metric label="Cukier" value={formatGrams(pulse.avgSugar)} />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-text-muted">
        {[
          pulse.loggedDays < 5 ? 'Najpierw uzupełnij brakujące dni.' : null,
          !pulse.proteinOnTrack ? `Śr. białka poniżej celu ${pulse.proteinGoal} g.` : null,
          pulse.caloriesDeltaPct > 8 ? 'Śr. kcal powyżej dziennego celu.' : null,
          pulse.caloriesDeltaPct < -20 ? `Śr. kcal ${pulse.avgCalories} vs cel ${pulse.kcalTarget}.` : null,
          pulse.avgQuality != null && pulse.avgQuality < 50 ? 'Śr. jakość diety poniżej 50.' : null,
          pulse.avgInsulin != null ? `Insulin load śr. ${pulse.avgInsulin}` : null,
        ].filter(Boolean).join(' ') || 'Makra z zapisanych dni · rolling 7 dni.'}
      </p>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xs font-bold uppercase tracking-wider text-text-muted">{label}</p>
      <p className="mt-1 text-sm font-black text-text-primary">{value}</p>
    </div>
  );
}
