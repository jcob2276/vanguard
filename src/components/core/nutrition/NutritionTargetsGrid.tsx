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
      <div className="rounded-2xl border border-border-custom/50 bg-surface-solid/10 p-3.5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-text-muted">Bilans tygodniowy</span>
            <span className="text-[10px] font-bold text-text-secondary">{weeklyCalories.toLocaleString('pl-PL')} / {weeklyBudget.toLocaleString('pl-PL')} kcal</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border-custom">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-400 shadow-[0_2px_8px_rgba(249,115,22,0.15)] transition-all duration-1000"
              style={{ width: `${caloriesProgress}%` }}
            />
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-text-muted">
          <span>Pozostało w budżecie: <strong className="text-text-secondary">{Math.max(weeklyBudget - weeklyCalories, 0).toLocaleString('pl-PL')} kcal</strong></span>
          <span>{Math.round(caloriesProgress)}%</span>
        </div>
      </div>

      {/* Protein today */}
      <div className="rounded-2xl border border-border-custom/50 bg-surface-solid/10 p-3.5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-text-muted">Białko dzisiaj</span>
              {todayInsulinLoad != null && (
                <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                  todayInsulinLoad > 70 ? 'border-rose-500/25 bg-rose-500/10 text-rose-500'
                  : todayInsulinLoad > 40 ? 'border-amber-500/25 bg-amber-500/10 text-amber-500'
                  : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500'
                }`}>
                  IL {Math.round(todayInsulinLoad)}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold text-text-secondary">{todayProtein}g / {proteinGoal}g</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border-custom">
            <div
              className="h-full rounded-full bg-primary shadow-[0_2px_8px_rgba(79,70,229,0.2)] transition-all duration-700"
              style={{ width: `${proteinPct}%` }}
            />
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-text-muted">
          <span>{avgProtein7d != null ? `śr. 7d: ${avgProtein7d}g/d` : 'brak średniej'}</span>
          <span>{Math.round(proteinPct)}%</span>
        </div>
      </div>
    </div>
  );
}
