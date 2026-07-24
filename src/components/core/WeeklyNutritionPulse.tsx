import { AlertCircle, CheckCircle2, Utensils, Flame, Scale } from 'lucide-react';
import { useMemo } from 'react';
import { useNutritionData } from './useNutritionData';
import { needsNutritionCorrection } from '../../lib/horizonSignals';
import {
  buildWeeklyNutritionPulse,
  formatGrams,
  nutritionPulseHeadline,
} from '../../lib/weeklyNutritionPulse';
import Badge from '../ui/Badge';

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

  const proteinPct = pulse.avgProtein != null && pulse.proteinGoal > 0
    ? Math.min(100, Math.round((pulse.avgProtein / pulse.proteinGoal) * 100))
    : 0;

  return (
    <section className="rounded-3xl border border-border-custom/60 bg-surface/70 p-4.5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="flex items-center gap-1.5 text-2xs font-black uppercase tracking-widest text-text-muted">
              <Utensils size={12} className="text-primary" /> Odżywianie · 7 dni
            </p>
            <Badge variant="tag" className="text-3xs font-bold">
              Zapisane {pulse.loggedDays}/7 dni
            </Badge>
          </div>
          <h3 className="mt-1 text-base font-bold text-text-primary">
            {data.loading ? 'Ładuję przebieg…' : nutritionPulseHeadline(pulse)}
          </h3>
        </div>
        {needsAttention ? (
          <Badge variant="tag" color="var(--color-warning)" className="shrink-0">
            <AlertCircle size={12} className="mr-1 inline" /> Uwaga
          </Badge>
        ) : (
          <Badge variant="tag" color="var(--color-success)" className="shrink-0">
            <CheckCircle2 size={12} className="mr-1 inline" /> Ok
          </Badge>
        )}
      </div>

      {/* Hero Block 1: Protein Target vs Actual (Primary Spotlight) */}
      <div className={`rounded-2xl border p-3.5 space-y-2.5 transition-all ${
        !pulse.proteinOnTrack
          ? 'border-warning/30 bg-warning/10'
          : 'border-success/30 bg-success/10'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-3xs font-black uppercase tracking-widest text-text-muted flex items-center gap-1.5">
            <Scale size={11} className={!pulse.proteinOnTrack ? 'text-warning' : 'text-success'} /> Średnie białko
          </span>
          <span className={`text-2xs font-extrabold px-2 py-0.5 rounded-full ${
            !pulse.proteinOnTrack
              ? 'bg-warning/15 text-warning'
              : 'bg-success/15 text-success'
          }`}>
            {proteinPct}% celu ({pulse.proteinGoal}g)
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-black tracking-tight text-text-primary">
            {pulse.avgProtein == null ? '—' : `${pulse.avgProtein}`}
            <span className="text-sm font-bold text-text-muted ml-1">/ {pulse.proteinGoal} g</span>
          </p>
          <div className="text-right">
            <p className="text-3xs font-bold uppercase tracking-wider text-text-muted">Śr. Kcal</p>
            <p className="text-base font-black text-text-primary">
              {pulse.avgCalories == null ? '—' : `${pulse.avgCalories} kcal`}
              <span className={`text-2xs font-extrabold ml-1 ${
                pulse.caloriesDeltaPct > 0 ? 'text-warning' : 'text-text-muted'
              }`}>
                ({pulse.caloriesDeltaPct > 0 ? '+' : ''}{pulse.caloriesDeltaPct}%)
              </span>
            </p>
          </div>
        </div>

        {/* Protein progress bar */}
        <div className="h-1.5 w-full rounded-full bg-surface-raised/60 overflow-hidden">
          <div
            className={`h-full transition-all rounded-full ${
              !pulse.proteinOnTrack ? 'bg-warning' : 'bg-success'
            }`}
            style={{ width: `${proteinPct}%` }}
          />
        </div>
      </div>

      {/* Secondary Macros & Quality Grid */}
      <div className="grid grid-cols-4 gap-2">
        <MacroChip label="Jakość" value={pulse.avgQuality == null ? '—' : `${pulse.avgQuality}/100`} />
        <MacroChip label="Węgle" value={formatGrams(pulse.avgCarbs)} />
        <MacroChip label="Tłuszcze" value={formatGrams(pulse.avgFat)} />
        <MacroChip label="Błonnik" value={formatGrams(pulse.avgFiber)} />
      </div>

      {/* Footer warning line */}
      {needsAttention && (
        <div className="flex items-center gap-2 rounded-xl bg-warning/10 border border-warning/20 px-3 py-2 text-xs font-semibold text-warning">
          <AlertCircle size={13} className="shrink-0" />
          <p className="leading-tight">
            {!pulse.proteinOnTrack
              ? `Średnia podaż białka (${pulse.avgProtein ?? 0}g) jest poniżej bezpiecznego celu (${pulse.proteinGoal}g).`
              : pulse.loggedDays < 5
              ? 'Uzupełnij brakujące dni w dzienniku żywieniowym.'
              : 'Skoryguj bilans makro na pozostałą część tygodnia.'}
          </p>
        </div>
      )}
    </section>
  );
}

function MacroChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-custom/30 bg-surface/50 p-2 text-center">
      <p className="text-3xs font-bold uppercase tracking-wider text-text-muted">{label}</p>
      <p className="mt-0.5 text-xs font-black text-text-primary truncate">{value}</p>
    </div>
  );
}
