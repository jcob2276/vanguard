import { ChevronRight, Sparkles } from 'lucide-react';
import type { SpineGuidance, SpineGuideTarget } from '../../lib/goalSpineGuide';

export function SpineGuideStrip({
  guidance,
  loading,
  onNavigate,
  onPlanDay,
  onFocusPlan,
}: {
  guidance: SpineGuidance | null;
  loading?: boolean;
  onNavigate: (target: SpineGuideTarget) => void;
  onPlanDay?: () => void;
  onFocusPlan?: () => void;
}) {
  if (loading || !guidance) return null;

  const { primaryCue, primaryAction, readyForDay, steps, dayProgress } = guidance;
  const pending = steps.filter((s) => s.status !== 'done');
  const progressPct =
    dayProgress && dayProgress.total > 0
      ? Math.round((dayProgress.done / dayProgress.total) * 100)
      : 0;

  return (
    <div
      className={`rounded-[20px] border px-4 py-3.5 ${
        readyForDay
          ? 'border-primary/10 bg-primary/[0.02]'
          : 'border-primary/30 bg-primary/[0.06]'
      }`}
    >
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/70 mb-1.5">
        {readyForDay ? 'Dziś w kontekście tygodnia' : 'Następny krok'}
      </p>
      <p className="text-[13px] font-semibold text-text-primary leading-snug">{primaryCue}</p>

      {dayProgress && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-text-muted">
            <span>Zwycięstwa dziś</span>
            <span className="text-primary">
              {dayProgress.done}/{dayProgress.total}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-border-custom">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {primaryAction.type === 'navigate' && (
        <button
          type="button"
          onClick={() => onNavigate(primaryAction.target)}
          className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-white cursor-pointer hover:bg-primary-hover"
        >
          {primaryAction.label}
          <ChevronRight size={12} />
        </button>
      )}

      {primaryAction.type === 'plan_day' && onPlanDay && (
        <button
          type="button"
          onClick={onPlanDay}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-white cursor-pointer hover:bg-primary-hover"
        >
          <Sparkles size={12} />
          {primaryAction.label}
        </button>
      )}

      {primaryAction.type === 'focus_plan' && onFocusPlan && (
        <button
          type="button"
          onClick={onFocusPlan}
          className="mt-3 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-primary cursor-pointer hover:bg-primary/20"
        >
          {primaryAction.label}
          <ChevronRight size={12} />
        </button>
      )}

      {!readyForDay && pending.length > 1 && (
        <p className="mt-2.5 text-[10px] text-text-muted leading-relaxed">
          Potem: {pending.filter((s) => s.status !== 'now').slice(0, 2).map((s) => s.label).join(' → ')}
        </p>
      )}
    </div>
  );
}
