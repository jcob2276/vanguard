import React from 'react';
import { computeBudgetBarState } from './calendarHelpers';
import { LIFE_SPHERES } from '../../lib/projects/lifeSpheres';
import Button from '../ui/Button';

interface Budget {
  category: string;
  min_hours: number | null;
  max_hours: number | null;
}

interface CalendarBudgetPanelProps {
  categoryWeeklyTotals: Record<string, number>;
  categoryPrevWeeklyTotals?: Record<string, number>;
  budgets: Budget[];
  onConfigure?: () => void;
  isMobile?: boolean;
}

const BUDGET_CATEGORIES = LIFE_SPHERES.map((s) => ({ key: s.id, label: s.label, color: s.bar, dot: s.dot }));

export default function CalendarBudgetPanel({
  categoryWeeklyTotals,
  categoryPrevWeeklyTotals = {},
  budgets,
  onConfigure,
  isMobile = false,
}: CalendarBudgetPanelProps) {
  // Helper to format hours
  const formatHours = (h: number) => {
    return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
  };

  const renderCategory = (cat: typeof BUDGET_CATEGORIES[0]) => {
    const spent = categoryWeeklyTotals[cat.key] || 0;
    const prevSpent = categoryPrevWeeklyTotals[cat.key] || 0;
    const diff = spent - prevSpent;
    const diffText = diff > 0 ? `+${formatHours(diff)}` : diff < 0 ? `-${formatHours(Math.abs(diff))}` : '0h';
    const diffColor = diff > 0 ? 'text-success/80 dark:text-success/80' : diff < 0 ? 'text-danger/85 dark:text-danger/80' : 'text-text-muted/40';

    const b = budgets.find((item) => item.category === cat.key);
    const minVal = b?.min_hours;
    const maxVal = b?.max_hours;
    const { pct, statusText, barColor } = computeBudgetBarState(spent, minVal, maxVal, cat.color);

    return (
      <div key={cat.key} className="p-2.5 bg-surface-solid/5 dark:bg-white/[0.015] border border-border-custom/30 rounded-xl flex flex-col justify-between hover:bg-surface-solid/10 dark:hover:bg-white/[0.025] transition-all">
        <div className="flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cat.dot}`} />
            <span className="text-text-primary truncate">{cat.label}</span>
          </div>
          <span className="text-text-primary tabular-nums shrink-0 font-extrabold">{formatHours(spent)}</span>
        </div>

        <div className="flex items-center justify-between text-2xs font-medium mt-0.5">
          <span className="text-text-muted">
            {minVal || maxVal ? statusText : 'Brak limitu'}
          </span>
          <span className={`tabular-nums font-bold ${diffColor}`} title={`Poprzedni tydzień: ${formatHours(prevSpent)}`}>
            vs poprz. {diffText}
          </span>
        </div>

        {(minVal || maxVal) && (
          <div className="w-full h-1 bg-border-custom/40 rounded-full overflow-hidden mt-1.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
    );
  };

  if (isMobile) {
    return (
      <div className="px-4 pb-3.5 pt-1 grid grid-cols-2 gap-2">
        {BUDGET_CATEGORIES.map(renderCategory)}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Budżety czasu (Tydzień)</span>
        {onConfigure && (
          <Button variant="ghost" size="sm" onClick={onConfigure} className="text-xs font-black hover:underline">
            Konfiguruj
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2">
        {BUDGET_CATEGORIES.map(renderCategory)}
      </div>
    </div>
  );
}
