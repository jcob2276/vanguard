import { Card } from '../../ui/Card';

interface NutritionTargetsGridProps {
  weeklyCalories: number;
  weeklyBudget: number;
  caloriesProgress: number;
  todayInsulinLoad: number | null;
  todayProtein: number;
  proteinGoal: number;
  proteinPct: number;
  avgProtein7d: number | null;
}

export default function NutritionTargetsGrid({
  weeklyCalories,
  weeklyBudget,
  caloriesProgress,
  todayInsulinLoad,
  todayProtein,
  proteinGoal,
  proteinPct,
  avgProtein7d,
}: NutritionTargetsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
      {/* Weekly calories budget */}
      <Card className="flex flex-col justify-between" padding="0.875rem">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-2xs font-black uppercase tracking-wider text-text-muted">Bilans tygodniowy</span>
            <span className="text-xs font-bold text-text-secondary">{weeklyCalories.toLocaleString('pl-PL')} / {weeklyBudget.toLocaleString('pl-PL')} kcal</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border-custom">
            <div
              className="h-full rounded-full bg-gradient-to-r from-warning to-warning shadow-[var(--ds-shadow-0-2px-8px-rgba-249-115-22-0-15)] transition-all duration-[var(--motion-ambient)]"
              style={{ width: `${caloriesProgress}%` }}
            />
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between text-2xs font-black uppercase tracking-wider text-text-muted">
          <span>Pozostało w budżecie: <strong className="text-text-secondary">{Math.max(weeklyBudget - weeklyCalories, 0).toLocaleString('pl-PL')} kcal</strong></span>
          <span>{Math.round(caloriesProgress)}%</span>
        </div>
      </Card>

      {/* Protein today */}
      <Card className="flex flex-col justify-between" padding="0.875rem">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-2xs font-black uppercase tracking-wider text-text-muted">Białko dzisiaj</span>
              {todayInsulinLoad != null && (
                <span className={`rounded-full border px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider ${
                  todayInsulinLoad > 70 ? 'border-danger/25 bg-danger/10 text-danger'
                  : todayInsulinLoad > 40 ? 'border-warning/25 bg-warning/10 text-warning'
                  : 'border-success/25 bg-success/10 text-success'
                }`}>
                  IL {Math.round(todayInsulinLoad)}
                </span>
              )}
            </div>
            <span className="text-xs font-bold text-text-secondary">{todayProtein}g / {proteinGoal}g</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border-custom">
            <div
              className="h-full rounded-full bg-primary shadow-[0_2px_8px_var(--primary-25)] transition-all duration-[var(--motion-deliberate)]"
              style={{ width: `${proteinPct}%` }}
            />
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between text-2xs font-black uppercase tracking-wider text-text-muted">
          <span>{avgProtein7d != null ? `śr. 7d: ${avgProtein7d}g/d` : 'brak średniej'}</span>
          <span>{Math.round(proteinPct)}%</span>
        </div>
      </Card>
    </div>
  );
}
