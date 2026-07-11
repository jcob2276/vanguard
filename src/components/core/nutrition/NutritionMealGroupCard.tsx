import { Plus, Loader2, X } from 'lucide-react';
import type { useNutritionData, TodayEntry } from '../useNutritionData';

type NutritionData = ReturnType<typeof useNutritionData>;
type MealGroup = NutritionData['mealGroups'][number];

const MEAL_ICON: Record<string, string> = {
  breakfast: '🍳',
  lunch: '🍲',
  dinner: '🥗',
  snack: '🍎',
};

interface NutritionMealGroupCardProps {
  mealKey: string;
  group: MealGroup;
  deletingId: string | null;
  deleteEntry: NutritionData['deleteEntry'];
  onAddToMeal: () => void;
  onEditEntry: (entry: TodayEntry) => void;
}

export default function NutritionMealGroupCard({
  mealKey,
  group,
  deletingId,
  deleteEntry,
  onAddToMeal,
  onEditEntry,
}: NutritionMealGroupCardProps) {
  const hasEntries = group.entries.length > 0;

  return (
    <div className="rounded-2xl border border-border-custom/70 bg-surface-solid/5 p-4 space-y-3">
      {/* Meal group header with subtotals and quick add button */}
      <div className="flex items-center justify-between border-b border-border-custom/40 pb-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-text-secondary font-display flex items-center gap-1.5">
          <span className="text-[14px]">{MEAL_ICON[mealKey] || '🍽️'}</span>
          {group.label}
        </span>
        <div className="flex items-center gap-2">
          {hasEntries && (
            <div className="flex items-center gap-1.5 text-[9px] font-black text-text-muted">
              <span className="rounded bg-surface-solid border border-border-custom/40 px-1.5 py-0.5 text-text-primary">{group.totalKcal} kcal</span>
              <span>·</span>
              <span className="text-primary">{group.totalProtein}B</span>
              <span>·</span>
              <span className="text-amber-500">{group.totalCarbs}W</span>
              <span>·</span>
              <span className="text-rose-400">{group.totalFat}T</span>
            </div>
          )}
          <button
            onClick={onAddToMeal}
            className="rounded-full border border-primary/20 bg-primary/[0.04] p-1 text-primary hover:bg-primary/10 active:scale-90 transition-all cursor-pointer flex items-center justify-center"
            title={`Dodaj do posiłku: ${group.label}`}
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Entries in this meal */}
      {hasEntries ? (
        <div className="space-y-2">
          {group.entries.map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-xl border border-border-custom/40 bg-surface px-3 py-2.5 transition-all hover:bg-surface-solid/30">
              <button
                onClick={() => onEditEntry(e)}
                className="flex-1 min-w-0 text-left cursor-pointer"
              >
                <div className="flex items-baseline gap-1.5">
                  <p className="text-[12px] font-black text-text-primary truncate">{e.name}</p>
                  {e.amount && <span className="text-[9px] text-text-muted shrink-0">{e.amount}</span>}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {e.protein != null && e.protein > 0.05 && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[8px] font-black text-primary">
                      {Math.round(e.protein * 10) / 10}B
                    </span>
                  )}
                  {e.carbs != null && e.carbs > 0.05 && (
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-black text-amber-500">
                      {Math.round(e.carbs * 10) / 10}W
                    </span>
                  )}
                  {e.fat != null && e.fat > 0.05 && (
                    <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[8px] font-black text-rose-500">
                      {Math.round(e.fat * 10) / 10}T
                    </span>
                  )}
                </div>
              </button>
              <span className="shrink-0 text-[11px] font-black text-text-secondary bg-surface-solid/60 px-2 py-0.5 rounded-lg border border-border-custom/30">
                {e.calories ?? '?'} kcal
              </span>
              <button
                onClick={() => deleteEntry(e.id)}
                disabled={!!deletingId}
                className="shrink-0 rounded-full p-1 text-text-muted/50 hover:text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer disabled:opacity-40"
              >
                {deletingId === e.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div
          onClick={onAddToMeal}
          className="border border-dashed border-border-custom/70 hover:border-primary/40 rounded-xl p-3 flex items-center justify-center gap-2 cursor-pointer transition-all hover:bg-primary/[0.02] group/slot py-3.5"
        >
          <Plus size={13} className="text-text-muted group-hover/slot:text-primary transition-colors" />
          <span className="text-[10px] font-black uppercase tracking-wider text-text-muted group-hover/slot:text-primary transition-colors">
            Dodaj do posiłku
          </span>
        </div>
      )}
    </div>
  );
}
