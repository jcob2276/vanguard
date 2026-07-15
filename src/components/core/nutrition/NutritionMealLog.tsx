import type { Dispatch, SetStateAction } from 'react';
import type { useNutritionData, TodayEntry } from '../useNutritionData';
import { Card } from '../../ui/Card';
import NutritionMealGroupCard from './NutritionMealGroupCard';

type NutritionData = ReturnType<typeof useNutritionData>;

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const MEAL_LABEL: Record<string, string> = {
  breakfast: 'Śniadanie',
  lunch: 'Obiad',
  dinner: 'Kolacja',
  snack: 'Przekąska',
};
const MEAL_ICON: Record<string, string> = {
  breakfast: '🍳',
  lunch: '🍲',
  dinner: '🥗',
  snack: '🍎',
};

function qualityColor(score: number): string {
  if (score >= 75) return 'text-success border-success/25 bg-success/10';
  if (score >= 55) return 'text-warning border-warning/25 bg-warning/10';
  return 'text-danger border-danger/25 bg-danger/10';
}

interface NutritionMealLogProps {
  isExpanded: boolean;
  setIsExpanded: Dispatch<SetStateAction<boolean>>;
  haptics: NutritionData['haptics'];
  todayQualityScore: NutritionData['todayQualityScore'];
  remainingKcalToday: number;
  todayMissingData: boolean;
  kcalTarget: number;
  todayEntries: TodayEntry[];
  mealGroupsWithEntries: NutritionData['mealGroupsWithEntries'];
  mealGroups: NutritionData['mealGroups'];
  deletingId: string | null;
  deleteEntry: NutritionData['deleteEntry'];
  setSelectedMealType: Dispatch<SetStateAction<string | undefined>>;
  setShowEntryModal: Dispatch<SetStateAction<boolean>>;
  setEditEntry: Dispatch<SetStateAction<TodayEntry | null>>;
}

export default function NutritionMealLog({
  isExpanded,
  setIsExpanded,
  haptics,
  todayQualityScore,
  remainingKcalToday,
  todayMissingData,
  kcalTarget,
  todayEntries,
  mealGroupsWithEntries,
  mealGroups,
  deletingId,
  deleteEntry,
  setSelectedMealType,
  setShowEntryModal,
  setEditEntry,
}: NutritionMealLogProps) {
  return (
    <>
      {/* ── Dzisiaj: remaining + grouped meal log ──────────────────────────────── */}
      <div className="my-4 border-t border-border-custom/50" />

      {/* Expandable / Collapsible toggle card banner */}
        <Card
          onClick={() => { haptics.light(); setIsExpanded(!isExpanded); }}
          className="flex flex-col cursor-pointer group select-none hover:bg-surface-solid/25 mb-4"
          padding="0.875rem"
        >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-[var(--ds-arbitrary-0-12em)] text-text-secondary font-display flex items-center gap-2">
              {isExpanded ? 'Ukryj dzisiejsze posiłki' : 'Pokaż dzisiejsze posiłki'}
              <span className={`text-xs transition-transform duration-[var(--motion-slow)] text-text-muted ${isExpanded ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </span>
            {todayQualityScore != null && (
              <span className={`rounded-full border px-2 py-0.5 text-2xs font-black uppercase tracking-wider ${qualityColor(todayQualityScore)}`}>
                Jakość {todayQualityScore}
              </span>
            )}
          </div>
          <span className={`text-sm font-black font-display ${
            todayMissingData ? 'text-text-muted'
            : remainingKcalToday >= -75 ? 'text-success'
            : 'text-danger'
          }`}>
            {todayMissingData
              ? `cel ${kcalTarget} kcal`
              : remainingKcalToday >= 0
              ? `${remainingKcalToday} kcal wolnych`
              : `${Math.abs(remainingKcalToday)} kcal za dużo`}
          </span>
        </div>

        {/* Logged meals preview (shown only when collapsed) */}
        {!isExpanded && (
          <div className="mt-2 border-t border-border-custom/20 pt-2">
            {todayEntries.length === 0 ? (
              <p className="text-2xs text-text-muted italic">Brak wpisów — kliknij, by rozwinąć lub dodać szybki posiłek</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {mealGroupsWithEntries.map((g) => (
                  <span key={g.key} className="inline-flex items-center gap-1 rounded-lg bg-surface-solid border border-border-custom/40 px-2 py-0.5 text-2xs font-bold text-text-secondary shadow-sm">
                    <span>{MEAL_ICON[g.key] || '🍽️'}</span>
                    <span>{g.label}</span>
                    <span className="text-text-primary font-black ml-0.5">{g.totalKcal} kcal</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Grouped meal sections */}
      {isExpanded && (
        <div className="space-y-4 animate-fadeIn">
          {MEAL_ORDER.map((key) => {
            const group = mealGroups.find(g => g.key === key) || {
              key,
              label: MEAL_LABEL[key],
              entries: [],
              totalKcal: 0,
              totalProtein: 0,
              totalCarbs: 0,
              totalFat: 0
            };

            return (
              <NutritionMealGroupCard
                key={key}
                mealKey={key}
                group={group}
                deletingId={deletingId}
                deleteEntry={deleteEntry}
                onAddToMeal={() => { setSelectedMealType(key); setShowEntryModal(true); }}
                onEditEntry={(entry) => { setEditEntry(entry); setShowEntryModal(true); }}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
