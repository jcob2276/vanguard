import { X } from 'lucide-react';

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Śniadanie' },
  { id: 'lunch', label: 'Obiad' },
  { id: 'dinner', label: 'Kolacja' },
  { id: 'snack', label: 'Przekąska' },
];

interface FoodEntryHeaderProps {
  headerTitle: string;
  screen: string;
  savedFlash: boolean;
  mealType: string;
  setMealType: (v: string) => void;
  onClose: () => void;
  todayTotals: { calories: number; protein: number } | null;
  targets: { target_kcal: number | null; protein_floor_g: number | null } | null;
}

export default function FoodEntryHeader({
  headerTitle, screen, savedFlash,
  mealType, setMealType, onClose,
  todayTotals, targets,
}: FoodEntryHeaderProps) {
  return (
    <>
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-border-custom shrink-0">
        <div className="flex items-center gap-2">
          <span className={`text-[15px] font-black transition-colors ${savedFlash && screen === 'browse' ? 'text-emerald-400' : 'text-text-primary'}`}>
            {headerTitle}
          </span>
          {screen === 'browse' && (
            <div className="relative">
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                className="appearance-none rounded-full border border-border-custom bg-surface-solid/40 pl-3 pr-6 py-1 text-[10px] font-bold text-text-secondary cursor-pointer outline-none"
              >
                {MEAL_TYPES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none text-[11px]">▾</span>
            </div>
          )}
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary cursor-pointer">
          <X size={18} />
        </button>
      </div>

      {todayTotals && (
        <div className="px-5 py-2.5 border-b border-border-custom/60 bg-surface-solid/20 shrink-0">
          <div className="flex items-center justify-between text-[10px] font-bold text-text-muted mb-1.5">
            <span>
              <span className="text-text-primary">{todayTotals.calories}</span>
              {targets?.target_kcal ? ` / ${targets.target_kcal}` : ''} kcal dziś
            </span>
            {targets?.protein_floor_g != null && (
              <span>
                <span className="text-text-primary">{Math.round(todayTotals.protein)}</span> / {targets.protein_floor_g} g B
              </span>
            )}
          </div>
          {targets?.target_kcal ? (
            <div className="h-1 rounded-full bg-border-custom overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${todayTotals.calories > targets.target_kcal ? 'bg-amber-500' : 'bg-primary'}`}
                style={{ width: `${Math.min(100, (todayTotals.calories / targets.target_kcal) * 100)}%` }}
              />
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
