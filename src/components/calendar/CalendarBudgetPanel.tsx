import React from 'react';
import { computeBudgetBarState } from './calendarHelpers';
import { LIFE_SPHERES } from '../../lib/lifeSpheres';

interface Budget {
  category: string;
  min_hours: number | null;
  max_hours: number | null;
}

interface CalendarBudgetPanelProps {
  categoryWeeklyTotals: Record<string, number>;
  budgets: Budget[];
  onConfigure?: () => void;
  isMobile?: boolean;
}

const BUDGET_CATEGORIES = LIFE_SPHERES.map((s) => ({ key: s.id, label: s.label, color: s.bar, dot: s.dot }));

export default function CalendarBudgetPanel({
  categoryWeeklyTotals,
  budgets,
  onConfigure,
  isMobile = false,
}: CalendarBudgetPanelProps) {
  if (isMobile) {
    return (
      <div className="px-4 pb-3.5 pt-1 grid grid-cols-2 gap-3.5">
        {BUDGET_CATEGORIES.map((cat) => {
          const spent = categoryWeeklyTotals[cat.key] || 0;
          const b = budgets.find((item) => item.category === cat.key);
          const minVal = b?.min_hours;
          const maxVal = b?.max_hours;
          const { pct, statusText, barColor } = computeBudgetBarState(spent, minVal, maxVal, cat.color);

          return (
            <div key={cat.key} className="space-y-1.5 p-2 bg-slate-50 dark:bg-white/[0.015] border border-border-custom/50 rounded-xl">
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-text-primary">{cat.label}</span>
                <span className="text-text-muted">{statusText}</span>
              </div>
              {(minVal || maxVal) ? (
                <div className="w-full h-1.5 bg-border-custom/40 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              ) : (
                <div className="text-[9px] text-text-muted/40 italic">Brak limitu</div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Budżety czasu (Tydzień)</span>
        {onConfigure && (
          <button
            onClick={onConfigure}
            className="text-[10px] text-primary font-black hover:underline"
          >
            Konfiguruj
          </button>
        )}
      </div>
      <div className="space-y-2">
        {BUDGET_CATEGORIES.map((cat) => {
          const spent = categoryWeeklyTotals[cat.key] || 0;
          const b = budgets.find((item) => item.category === cat.key);
          const minVal = b?.min_hours;
          const maxVal = b?.max_hours;
          const { pct, statusText, barColor } = computeBudgetBarState(spent, minVal, maxVal, cat.color);

          return (
            <div key={cat.key} className="space-y-1 p-2.5 bg-surface-solid/5 dark:bg-white/[0.015] border border-border-custom/30 rounded-xl">
              <div className="flex items-center justify-between text-[10px] font-bold">
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
                  <span className="text-text-primary">{cat.label}</span>
                </div>
                <span className="text-text-muted">{statusText}</span>
              </div>
              {(minVal || maxVal) ? (
                <div className="w-full h-1 bg-border-custom/40 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              ) : (
                <div className="text-[9px] text-text-muted/40 italic mt-0.5">Brak limitu</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
