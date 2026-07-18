import { AlertCircle, CheckCircle2, Utensils } from 'lucide-react';
import { useNutritionData } from './useNutritionData';
import { needsNutritionCorrection } from '../../lib/horizonSignals';

export default function WeeklyNutritionPulse({ weeklyCalories, refreshSignal }: { weeklyCalories: number; refreshSignal: number }) {
  const data = useNutritionData({ weeklyCalories, refreshSignal });
  const loggedDays = data.chart.filter((day) => day.calories > 0 || day.protein > 0).length;
  const caloriesDelta = data.weeklyBudget > 0 ? Math.round(((weeklyCalories - data.weeklyBudget) / data.weeklyBudget) * 100) : 0;
  const proteinOnTrack = data.avgProtein7d !== null && data.avgProtein7d >= data.proteinGoal * 0.9;
  const needsAttention = needsNutritionCorrection({ loggedDays, averageProtein: data.avgProtein7d, proteinGoal: data.proteinGoal, caloriesDeltaPct: caloriesDelta });

  return (
    <section className="rounded-3xl border border-border-custom/60 bg-surface/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-2xs font-black uppercase tracking-widest text-text-muted"><Utensils size={12} /> Odżywianie · 7 dni</p>
          <p className="mt-1 text-base font-bold text-text-primary">
            {needsAttention ? 'Wymaga małej korekty' : 'Przebieg zgodny z planem'}
          </p>
        </div>
        {needsAttention ? <AlertCircle className="text-warning" size={18} /> : <CheckCircle2 className="text-success" size={18} />}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border-custom/40 pt-3">
        <Metric label="Zapisane dni" value={`${loggedDays}/7`} />
        <Metric label="Śr. białko" value={data.avgProtein7d === null ? '—' : `${data.avgProtein7d} g`} />
        <Metric label="Budżet kcal" value={`${caloriesDelta > 0 ? '+' : ''}${caloriesDelta}%`} />
      </div>
      {needsAttention ? (
        <p className="mt-3 text-xs leading-relaxed text-text-muted">
          {loggedDays < 5 ? 'Najpierw uzupełnij brakujące dni. ' : ''}
          {!proteinOnTrack ? `Średnia białka jest poniżej bezpiecznego zakresu celu ${data.proteinGoal} g. ` : ''}
          {caloriesDelta > 8 ? 'Tygodniowy budżet kalorii został przekroczony.' : ''}
        </p>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-2xs font-bold uppercase tracking-wider text-text-muted">{label}</p><p className="mt-1 text-sm font-black text-text-primary">{value}</p></div>;
}
