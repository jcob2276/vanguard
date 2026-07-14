import Button from '../ui/Button';
import { ChevronRight, Sparkles } from 'lucide-react';

import type { SpineGuidance, SpineGuideTarget } from '../../lib/goal/goalSpineGuide';
import { Card } from '../ui/Card';



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

    <Card
      className={readyForDay ? 'border border-primary/10' : 'border border-primary/30'}
      style={{ background: readyForDay ? 'color-mix(in oklch, var(--color-primary) 2%, transparent)' : 'color-mix(in oklch, var(--color-primary) 6%, transparent)' }}
      padding="0.875rem 1rem"
    >

      <p className="text-2xs font-black uppercase tracking-[var(--legacy-arbitrary-002)] text-primary/70 mb-1.5">

        {readyForDay ? 'Dziś w kontekście tygodnia' : 'Następny krok'}

      </p>

      <p className="text-sm font-semibold text-text-primary leading-snug">{primaryCue}</p>



      {dayProgress && (

        <div className="mt-3 space-y-1.5">

          <div className="flex items-center justify-between text-2xs font-bold uppercase tracking-wider text-text-muted">

            <span>Zwycięstwa dziś</span>

            <span className="text-primary">

              {dayProgress.done}/{dayProgress.total}

            </span>

          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-border-custom">

            <div

              className="h-full rounded-full bg-primary transition-all duration-[var(--motion-long)]"

              style={{ width: `${progressPct}%` }}

            />

          </div>

        </div>

      )}



      {primaryAction.type === 'navigate' && (

        <Button

          variant="primary"

          size="sm"

          onClick={() => onNavigate(primaryAction.target)}

          className="!mt-3 !rounded-full"

        >

          {primaryAction.label}

          <ChevronRight size={12} />

        </Button>

      )}



      {primaryAction.type === 'plan_day' && onPlanDay && (

        <Button

          variant="primary"

          size="sm"

          onClick={onPlanDay}

          icon={<Sparkles size={12} />}

          className="!mt-3 !rounded-full"

        >

          {primaryAction.label}

        </Button>

      )}



      {primaryAction.type === 'focus_plan' && onFocusPlan && (

        <Button

          variant="tonal"

          size="sm"

          onClick={onFocusPlan}

          className="!mt-3 !rounded-full border border-primary/30"

        >

          {primaryAction.label}

          <ChevronRight size={12} />

        </Button>

      )}



      {!readyForDay && pending.length > 1 && (

        <p className="mt-2.5 text-xs text-text-muted leading-relaxed">

          Potem: {pending.filter((s) => s.status !== 'now').slice(0, 2).map((s) => s.label).join(' → ')}

        </p>

      )}

    </Card>

  );

}
