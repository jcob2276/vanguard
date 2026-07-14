import React from 'react';
import { useHaptics } from '../../hooks/useHaptics';

function getWeekdayAbbr(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr.slice(8);
    const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const day = date.getDay();
    const days = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
    return days[day] || dateStr.slice(8);
  } catch {
    return dateStr.slice(8);
  }
}

export interface NutritionChartProps {
  activeChartTab: 'calories' | 'protein';
  setActiveChartTab: (tab: 'calories' | 'protein') => void;
  chart: Array<{
    key: string;
    label: string;
    protein: number;
    calories: number;
    analysis: string | null;
    insulin_load: number | null;
  }>;
  kcalTarget: number;
  proteinGoal: number;
  todayRaw: string;
  haptics: ReturnType<typeof useHaptics>;
}

export default function NutritionChart({
  activeChartTab,
  setActiveChartTab,
  chart,
  kcalTarget,
  proteinGoal,
  todayRaw,
  haptics,
}: NutritionChartProps) {
  return (
    <div className="mt-4 border-t border-border-custom/50 pt-4">
      {/* Chart switcher tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-solid/15 border border-border-custom/50 mb-3">
        <button
          onClick={() => { haptics.light(); setActiveChartTab('calories'); }}
          className={`flex-1 text-center py-1 rounded-lg text-2xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeChartTab === 'calories'
              ? 'bg-surface-solid shadow-sm text-text-primary border border-border-custom/30'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Kalorie (7d)
        </button>
        <button
          onClick={() => { haptics.light(); setActiveChartTab('protein'); }}
          className={`flex-1 text-center py-1 rounded-lg text-2xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeChartTab === 'protein'
              ? 'bg-surface-solid shadow-sm text-text-primary border border-border-custom/30'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Białko (7d)
        </button>
      </div>

      {activeChartTab === 'calories' ? (
        <div className="mt-2">
          <div className="relative h-24 border-b border-border-custom/50 flex items-end justify-between px-2 pb-1">
            {/* Target baseline */}
            {kcalTarget > 0 && (
              <div 
                className="absolute left-0 right-0 border-t border-dashed border-warning/40 z-0 pointer-events-none"
                style={{ bottom: `${(kcalTarget / Math.max(...chart.map(c => c.calories), kcalTarget, 1)) * 100}%` }}
              />
            )}
            {chart.map((d) => {
              const maxVal = Math.max(...chart.map(c => c.calories), kcalTarget, 1);
              const pct = (d.calories / maxVal) * 100;
              const isToday = d.key === todayRaw;
              const weekday = getWeekdayAbbr(d.key);
              return (
                <div key={d.key} className="flex-1 flex flex-col items-center group relative z-10 h-full justify-end">
                  <div
                    className={`w-3.5 rounded-t-md transition-all duration-500 cursor-pointer ${
                      isToday
                        ? 'bg-gradient-to-t from-warning to-warning opacity-100 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                        : d.calories >= kcalTarget
                          ? 'bg-success/60 dark:bg-success/70 hover:opacity-100 opacity-70'
                          : 'bg-text-secondary/40 hover:opacity-85 opacity-55'
                    }`}
                    style={{ height: `${Math.max(pct, 5)}%` }}
                  />
                  <div className="absolute bottom-full mb-1 bg-surface-solid border border-border-custom px-1.5 py-0.5 rounded text-2xs font-bold text-text-primary opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md z-20 whitespace-nowrap">
                    {weekday}: {d.calories} kcal
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between px-2 mt-1.5">
            {chart.map((d) => {
              const isToday = d.key === todayRaw;
              const weekday = getWeekdayAbbr(d.key);
              return (
                <span key={d.key} className={`flex-1 text-center text-3xs font-black ${isToday ? 'text-primary' : 'text-text-muted'}`}>
                  {isToday ? 'Dziś' : weekday}
                </span>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <div className="relative h-24 border-b border-border-custom/50 flex items-end justify-between px-2 pb-1">
            {/* Protein Target baseline */}
            {proteinGoal > 0 && (
              <div 
                className="absolute left-0 right-0 border-t border-dashed border-primary/40 z-0 pointer-events-none"
                style={{ bottom: `${(proteinGoal / Math.max(...chart.map(c => c.protein), proteinGoal, 1)) * 100}%` }}
              />
            )}
            {chart.map((d) => {
              const maxVal = Math.max(...chart.map(c => c.protein), proteinGoal, 1);
              const pct = (d.protein / maxVal) * 100;
              const isToday = d.key === todayRaw;
              const weekday = getWeekdayAbbr(d.key);
              return (
                <div key={d.key} className="flex-1 flex flex-col items-center group relative z-10 h-full justify-end">
                  <div
                    className={`w-3.5 rounded-t-md transition-all duration-500 cursor-pointer ${
                      isToday
                        ? 'bg-gradient-to-t from-primary to-primary opacity-100 shadow-[0_0_8px_rgba(99,102,241,0.25)]'
                        : d.protein >= proteinGoal
                          ? 'bg-success/60 dark:bg-success/70 hover:opacity-100 opacity-70'
                          : 'bg-primary/45 hover:opacity-85 opacity-55'
                    }`}
                    style={{ height: `${Math.max(pct, 5)}%` }}
                  />
                  <div className="absolute bottom-full mb-1 bg-surface-solid border border-border-custom px-1.5 py-0.5 rounded text-2xs font-bold text-text-primary opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md z-20 whitespace-nowrap">
                    {weekday}: {d.protein}g B
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between px-2 mt-1.5">
            {chart.map((d) => {
              const isToday = d.key === todayRaw;
              const weekday = getWeekdayAbbr(d.key);
              return (
                <span key={d.key} className={`flex-1 text-center text-3xs font-black ${isToday ? 'text-primary' : 'text-text-muted'}`}>
                  {isToday ? 'Dziś' : weekday}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
