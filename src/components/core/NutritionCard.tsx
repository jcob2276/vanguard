import { useState } from 'react';
import { Plus, RefreshCw, X, Loader2, Zap, Flame, Droplet } from 'lucide-react';
import FoodEntryModal from './nutrition/FoodEntryModal';
import { useNutritionData, type TodayEntry } from './useNutritionData';
import NutritionChart from './NutritionChart';
import { Session } from '@supabase/supabase-js';

interface NutritionCardProps {
  weeklyCalories: number;
  session: Session;
  refreshSignal?: number;
}

function qualityColor(score: number): string {
  if (score >= 75) return 'text-emerald-400 border-emerald-500/25 bg-emerald-500/10';
  if (score >= 55) return 'text-amber-400 border-amber-500/25 bg-amber-500/10';
  return 'text-rose-400 border-rose-500/25 bg-rose-500/10';
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
    fetchRows,
    fetchTodayEntries,
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

  const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
  const MEAL_LABEL: Record<string, string> = {
    breakfast: 'Śniadanie',
    lunch: 'Obiad',
    dinner: 'Kolacja',
    snack: 'Przekąska',
  };

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

      {/* Suma makro dzisiaj */}
      <div className="mb-4 grid grid-cols-3 gap-2.5">
        {/* Protein Box */}
        {(() => {
          const protPct = proteinGoal > 0 ? Math.round((todayMacros.protein / proteinGoal) * 100) : 100;
          const protLow = protPct < 55 && todayMacros.protein > 0;
          return (
            <div className={`rounded-2xl border-l-4 border border-border-custom/40 bg-surface-solid/20 p-3 text-center flex flex-col justify-between ${protLow ? 'border-l-rose-500/80 bg-rose-500/5' : 'border-l-primary/70'}`}>
              <div>
                <p className={`text-[8px] font-black uppercase tracking-wider mb-1 flex items-center justify-center gap-1 ${protLow ? 'text-rose-500' : 'text-primary'}`}>
                  <Zap size={9} className={protLow ? 'fill-rose-500' : 'fill-primary'} /> Białko (B)
                </p>
                <p className="font-display text-[17px] font-black text-text-primary">{todayMacros.protein}g</p>
              </div>
              <div>
                <div className="w-full h-1 bg-border-custom rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${protLow ? 'bg-rose-500' : 'bg-primary'}`}
                    style={{ width: `${Math.min((todayMacros.protein / (proteinGoal || 1)) * 100, 100)}%` }}
                  />
                </div>
                <p className={`text-[7.5px] font-bold mt-1 ${protLow ? 'text-rose-400' : 'text-text-muted'}`}>
                  {proteinGoal > 0 ? `${protPct}% celu` : '—'}
                </p>
              </div>
            </div>
          );
        })()}

        {/* Carbs Box */}
        <div className="rounded-2xl border-l-4 border-l-amber-500/70 border border-border-custom/40 bg-surface-solid/20 p-3 text-center flex flex-col justify-between">
          <div>
            <p className="text-[8px] font-black uppercase tracking-wider text-amber-500 mb-1 flex items-center justify-center gap-1">
              <Flame size={9} className="fill-amber-500" /> Węgle (W)
            </p>
            <p className="font-display text-[17px] font-black text-text-primary">{todayMacros.carbs}g</p>
          </div>
          <div>
            <div className="w-full h-1 bg-border-custom rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-amber-400 h-full rounded-full transition-all duration-500" 
                style={{ width: `${cPct}%` }} 
              />
            </div>
            <p className="text-[7.5px] text-text-muted font-bold mt-1">
              {Math.round(cPct)}% makro
            </p>
          </div>
        </div>

        {/* Fat Box */}
        <div className="rounded-2xl border-l-4 border-l-rose-500/70 border border-border-custom/40 bg-surface-solid/20 p-3 text-center flex flex-col justify-between">
          <div>
            <p className="text-[8px] font-black uppercase tracking-wider text-rose-500 mb-1 flex items-center justify-center gap-1">
              <Droplet size={9} className="fill-rose-500" /> Tłuszcze (T)
            </p>
            <p className="font-display text-[17px] font-black text-text-primary">{todayMacros.fat}g</p>
          </div>
          <div>
            <div className="w-full h-1 bg-border-custom rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-rose-400 h-full rounded-full transition-all duration-500" 
                style={{ width: `${fPct}%` }} 
              />
            </div>
            <p className="text-[7.5px] text-text-muted font-bold mt-1">
              {Math.round(fPct)}% makro
            </p>
          </div>
        </div>
      </div>

      {/* Dynamic Macro Balance split progress bar */}
      {todayMacros.protein + todayMacros.carbs + todayMacros.fat > 0 && (
        <div className="mb-4 bg-surface-solid/10 border border-border-custom/30 rounded-xl p-2">
          <div className="h-2 w-full rounded-full bg-border-custom overflow-hidden flex">
            <div className="bg-primary h-full transition-all duration-700" style={{ width: `${pPct}%` }} title={`Białko: ${Math.round(pPct)}%`} />
            <div className="bg-amber-400 h-full transition-all duration-700" style={{ width: `${cPct}%` }} title={`Węglowodany: ${Math.round(cPct)}%`} />
            <div className="bg-rose-400 h-full transition-all duration-700" style={{ width: `${fPct}%` }} title={`Tłuszcze: ${Math.round(fPct)}%`} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[8px] font-black text-text-muted uppercase tracking-wider">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Białko ({Math.round(pPct)}%)</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Węgle ({Math.round(cPct)}%)</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Tłuszcze ({Math.round(fPct)}%)</span>
          </div>
        </div>
      )}

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

      {/* Sync / targets dashboard progress bars */}
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

      {/* Food quality analysis */}
      {todayAnalysis && (
        <div className="mt-3.5 rounded-xl bg-text-primary/[0.02] border border-border-custom/50 p-3">
          <p className="text-[9px] uppercase font-black tracking-wider text-text-muted mb-1">
            Analiza jakości jedzenia{todayAnalysisIsStale ? ` (${todayAnalysisRow!.key})` : ''}
          </p>
          <p className="text-[11.5px] leading-relaxed text-text-secondary">{todayAnalysis}</p>
        </div>
      )}

      {/* ── Dzisiaj: remaining + grouped meal log ──────────────────────────────── */}
      <div className="my-4 border-t border-border-custom/50" />

      {/* Expandable / Collapsible toggle card banner */}
      <div
        onClick={() => { haptics.light(); setIsExpanded(!isExpanded); }}
        className="flex flex-col p-3.5 rounded-2xl border border-border-custom bg-surface-solid/15 cursor-pointer group select-none hover:bg-surface-solid/25 active:scale-[0.99] transition-all mb-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-text-secondary font-display flex items-center gap-2">
              {isExpanded ? 'Ukryj dzisiejsze posiłki' : 'Pokaż dzisiejsze posiłki'}
              <span className={`text-[10px] transition-transform duration-300 text-text-muted ${isExpanded ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </span>
            {todayQualityScore != null && (
              <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${qualityColor(todayQualityScore)}`}>
                Jakość {todayQualityScore}
              </span>
            )}
          </div>
          <span className={`text-[12px] font-black font-display ${
            todayMissingData ? 'text-text-muted'
            : remainingKcalToday >= -75 ? 'text-emerald-500'
            : 'text-rose-400'
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
              <p className="text-[9.5px] text-text-muted italic">Brak wpisów — kliknij, by rozwinąć lub dodać szybki posiłek</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {mealGroupsWithEntries.map((g) => {
                  const mealIcon = {
                    breakfast: '🍳',
                    lunch: '🍲',
                    dinner: '🥗',
                    snack: '🍎'
                  }[g.key] || '🍽️';
                  return (
                    <span key={g.key} className="inline-flex items-center gap-1 rounded-lg bg-surface-solid border border-border-custom/40 px-2 py-0.5 text-[9px] font-bold text-text-secondary shadow-sm">
                      <span>{mealIcon}</span>
                      <span>{g.label}</span>
                      <span className="text-text-primary font-black ml-0.5">{g.totalKcal} kcal</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

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

            const mealIcon = {
              breakfast: '🍳',
              lunch: '🍲',
              dinner: '🥗',
              snack: '🍎'
            }[key] || '🍽️';

            const hasEntries = group.entries.length > 0;

            return (
              <div key={key} className="rounded-2xl border border-border-custom/70 bg-surface-solid/5 p-4 space-y-3">
                {/* Meal group header with subtotals and quick add button */}
                <div className="flex items-center justify-between border-b border-border-custom/40 pb-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-text-secondary font-display flex items-center gap-1.5">
                    <span className="text-[14px]">{mealIcon}</span>
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
                      onClick={() => { setSelectedMealType(key); setShowEntryModal(true); }}
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
                          onClick={() => { setEditEntry(e); setShowEntryModal(true); }}
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
                    onClick={() => { setSelectedMealType(key); setShowEntryModal(true); }}
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
          })}
        </div>
      )}

      {/* Thermodynamic forecast + adaptive correction */}
      {forecast && (forecast.forecast_30d_weight_kg != null || forecast.adaptive_correction_kcal) && (
        <div className="mt-3.5 rounded-xl border border-border-custom/50 bg-surface-solid/15 p-3">
          <p className="text-[9px] font-black uppercase tracking-wider text-text-muted mb-2">Prognoza przy obecnym tempie</p>
          {forecast.forecast_30d_weight_kg != null && (
            <div className="grid grid-cols-3 gap-2 mb-2">
              {([
                ['30d', forecast.forecast_30d_weight_kg, forecast.forecast_30d_bf_pct],
                ['60d', forecast.forecast_60d_weight_kg, forecast.forecast_60d_bf_pct],
                ['90d', forecast.forecast_90d_weight_kg, forecast.forecast_90d_bf_pct],
              ] as const).map(([label, w, bf]) => (
                <div key={label} className="rounded-lg border border-border-custom/40 bg-surface-solid/30 px-2 py-1.5 text-center">
                  <p className="text-[8px] font-black uppercase text-text-muted">{label}</p>
                  <p className="text-[12px] font-black text-text-primary">{w != null ? `${w}kg` : '—'}</p>
                  {bf != null && <p className="text-[9px] font-bold text-text-muted">{bf}% BF</p>}
                </div>
              ))}
            </div>
          )}
          {forecast.days_to_goal_est != null && (
            <p className="text-[10.5px] text-text-secondary mb-1">
              Przy tym tempie cel BF za <strong className="text-text-primary">~{forecast.days_to_goal_est} dni</strong>
            </p>
          )}
          {!!forecast.adaptive_correction_kcal && (
            <p className="text-[10.5px] text-text-secondary mb-1">
              🔧 Adaptive correction: <strong className={forecast.adaptive_correction_kcal > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                {forecast.adaptive_correction_kcal > 0 ? '-' : '+'}{Math.abs(forecast.adaptive_correction_kcal)} kcal/dzień
              </strong> (tempo vs plan)
            </p>
          )}
          {forecastNote && <p className="text-[10.5px] text-text-secondary leading-snug mt-1">{forecastNote}</p>}
        </div>
      )}


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
