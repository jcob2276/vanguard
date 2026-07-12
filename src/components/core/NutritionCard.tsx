import { useState } from 'react';
import { Plus } from 'lucide-react';
import FoodEntryModal from './nutrition/FoodEntryModal';
import NutritionMacroBoxes from './nutrition/NutritionMacroBoxes';
import NutritionMealLog from './nutrition/NutritionMealLog';
import NutritionForecastPanel from './nutrition/NutritionForecastPanel';
import NutritionTargetsGrid from './nutrition/NutritionTargetsGrid';
import { useNutritionData, type TodayEntry } from './useNutritionData';
import NutritionChart from './NutritionChart';
import type { Session } from '@supabase/supabase-js';

interface NutritionCardProps {
  weeklyCalories: number;
  session: Session;
  refreshSignal?: number;
}

export default function NutritionCard({
  weeklyCalories,
  session,
  refreshSignal,
}: NutritionCardProps) {
  const {
    todayRaw,
    haptics,
    proteinGoal,
    kcalTarget,
    weeklyBudget,
    todayEntries,
    deletingId,
    forecast,
    forecastNote,
    isExpanded, setIsExpanded,
    selectedMealType, setSelectedMealType,
    activeChartTab, setActiveChartTab,
    handleSaved,
    deleteEntry,
    caloriesProgress,
    chart,
    avgProtein7d,
    todayProtein,
    todayKcal,
    todayInsulinLoad,
    proteinPct,
    todayMissingData,
    remainingKcalToday,
    todayMacros,
    pPct,
    cPct,
    fPct,
    todayQualityScore,
    todayAnalysis,
    todayAnalysisIsStale,
    todayAnalysisRow,
    mealGroups,
    mealGroupsWithEntries,
  } = useNutritionData({ session, weeklyCalories, refreshSignal });

  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editEntry, setEditEntry] = useState<TodayEntry | null>(null);

  return (
    <section className="card p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-text-muted">Żywienie</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEntryModal(true)}
            className="rounded-xl border border-primary/30 bg-primary/[0.06] px-3 py-1.5 text-[10px] font-black text-primary hover:bg-primary/10 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
          >
            <Plus size={12} /> Dodaj posiłek
          </button>
        </div>
      </div>

      {/* Main Calorie HUD */}
      <div className="flex flex-col items-center justify-center py-4 bg-surface-solid/35 border border-border-custom/50 rounded-2xl mb-4 text-center">
        <span className="text-[9px] font-black uppercase tracking-[0.15em] text-text-muted">Pozostało dzisiaj</span>
        <p className={`font-display text-[32px] font-black tracking-tight leading-none my-1.5 ${
          remainingKcalToday >= -75 ? 'text-emerald-500' : 'text-rose-500'
        }`}>
          {remainingKcalToday >= 0 ? `${remainingKcalToday}` : `+${Math.abs(remainingKcalToday)}`}
          <span className="text-[12px] font-bold text-text-secondary ml-1">kcal</span>
        </p>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted">
          <span>Zjedzone: <strong className="text-text-secondary">{todayKcal} kcal</strong></span>
          <span>·</span>
          <span>Cel: <strong className="text-text-secondary">{kcalTarget} kcal</strong></span>
        </div>
      </div>

      <NutritionMacroBoxes proteinGoal={proteinGoal} todayMacros={todayMacros} pPct={pPct} cPct={cPct} fPct={fPct} />

      {/* Unified 7-Day Chart Widget */}
      <NutritionChart
        activeChartTab={activeChartTab}
        setActiveChartTab={setActiveChartTab}
        chart={chart}
        kcalTarget={kcalTarget}
        proteinGoal={proteinGoal}
        todayRaw={todayRaw}
        haptics={haptics}
      />

      <NutritionTargetsGrid
        weeklyCalories={weeklyCalories}
        weeklyBudget={weeklyBudget}
        caloriesProgress={caloriesProgress}
        todayInsulinLoad={todayInsulinLoad}
        todayProtein={todayProtein}
        proteinGoal={proteinGoal}
        proteinPct={proteinPct}
        avgProtein7d={avgProtein7d}
      />

      {/* Food quality analysis */}
      {todayAnalysis && (
        <div className="mt-3.5 rounded-xl bg-text-primary/[0.02] border border-border-custom/50 p-3">
          <p className="text-[9px] uppercase font-black tracking-wider text-text-muted mb-1">
            Analiza jakości jedzenia{todayAnalysisIsStale ? ` (${todayAnalysisRow!.key})` : ''}
          </p>
          <p className="text-[11.5px] leading-relaxed text-text-secondary">{todayAnalysis}</p>
        </div>
      )}

      <NutritionMealLog
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        haptics={haptics}
        todayQualityScore={todayQualityScore}
        remainingKcalToday={remainingKcalToday}
        todayMissingData={todayMissingData}
        kcalTarget={kcalTarget}
        todayEntries={todayEntries}
        mealGroupsWithEntries={mealGroupsWithEntries}
        mealGroups={mealGroups}
        deletingId={deletingId}
        deleteEntry={deleteEntry}
        setSelectedMealType={setSelectedMealType}
        setShowEntryModal={setShowEntryModal}
        setEditEntry={setEditEntry}
      />

      <NutritionForecastPanel forecast={forecast} forecastNote={forecastNote} />

      {showEntryModal && (
        <FoodEntryModal
          session={session}
          onClose={() => { setShowEntryModal(false); setEditEntry(null); setSelectedMealType(undefined); }}
          onSaved={handleSaved}
          initialEditEntry={editEntry ?? undefined}
          initialMealType={selectedMealType}
        />
      )}
    </section>
  );
}
