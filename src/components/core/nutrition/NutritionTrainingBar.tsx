import { Activity, Flag, Target } from 'lucide-react';
import Button from '../../ui/Button';
import Badge from '../../ui/Badge';
import { Card } from '../../ui/Card';
import type { NutritionDayContext } from '../../../lib/health/nutritionContext';

const TRAJECTORY_STYLE: Record<string, string> = {
  on_track: 'text-emerald-500',
  ahead: 'text-sky-400',
  behind: 'text-amber-500',
};

const TRAJECTORY_LABEL: Record<string, string> = {
  on_track: 'Na kursie',
  ahead: 'Przed planem',
  behind: 'Za planem',
};

export default function NutritionTrainingBar({
  ctx,
  logClosed,
  onToggleLogClosed,
  loading,
}: {
  ctx: NutritionDayContext | null;
  logClosed: boolean;
  onToggleLogClosed: () => void;
  loading?: boolean;
}) {
  if (loading && !ctx) {
    return (
      <div className="rounded-xl border border-border-custom/60 bg-background/30 px-3 py-2.5 animate-pulse h-20" />
    );
  }
  if (!ctx) return null;

  const remainingKcal =
    ctx.targetKcal != null ? Math.round(ctx.targetKcal - ctx.calories) : null;
  const remainingProtein =
    ctx.targetProtein != null ? Math.max(0, Math.round(ctx.targetProtein - ctx.protein)) : null;
  const traj = ctx.trajectory ? TRAJECTORY_STYLE[ctx.trajectory] : 'text-text-muted';
  const trajLabel = ctx.trajectory ? TRAJECTORY_LABEL[ctx.trajectory] : null;

  const trend = ctx.weightTrendKgWeek;
  const planLoss = ctx.plannedWeeklyLossKg ?? 0.35;
  const stalling = trend != null && trend >= -0.05;

  const goalWeightLabel =
    ctx.goalWeightKg != null
      ? `~${ctx.goalWeightKg} kg`
      : null;
  const goalBfLabel = ctx.goalBodyFat != null ? `${ctx.goalBodyFat}% BF` : null;
  const goalLine = [goalWeightLabel, goalBfLabel].filter(Boolean).join(' · ');

  return (
    <Card variant="accent" padding="0.625rem 0.75rem" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Target size={12} className="text-primary shrink-0" />
          <p className="text-[9px] font-black uppercase tracking-wider text-text-primary truncate">
            Cel {goalLine || (ctx.goalBodyFat != null ? `${ctx.goalBodyFat}% BF` : 'redukcja')}
            {ctx.eventName ? ` · ${ctx.eventName}` : ''}
          </p>
        </div>
        {ctx.daysToMarathon != null && ctx.daysToMarathon >= 0 ? (
          <span className="text-[9px] font-bold text-text-muted shrink-0">
            <Flag size={10} className="inline -mt-0.5 mr-0.5" />
            {ctx.daysToMarathon} dni
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[10px]">
        <span className="inline-flex items-center gap-1 rounded-full border border-border-custom/80 bg-surface/60 px-2 py-0.5 font-semibold text-text-secondary">
          <Activity size={10} />
          {ctx.trainingLabel}
        </span>
        {ctx.inTaper ? (
          <Badge variant="tag" color="#f59e0b">Taper — bez deficytu</Badge>
        ) : ctx.addBackKcal > 0 ? (
          <span className="text-[9px] text-text-muted">
            +{ctx.addBackKcal} kcal pod trening
          </span>
        ) : ctx.deficitKcal > 0 ? (
          <span className="text-[9px] text-text-muted">−{ctx.deficitKcal} kcal plan</span>
        ) : null}
        {trajLabel ? (
          <span className={`text-[9px] font-bold ${traj}`}>{trajLabel}</span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <p className="text-text-muted text-[8px] font-black uppercase tracking-wider">Kalorie</p>
          <p className="font-bold text-text-primary">
            {Math.round(ctx.calories)}
            {ctx.targetKcal != null ? (
              <span className="text-text-muted font-semibold">
                {' '}/ {ctx.targetKcal}
                {remainingKcal != null && (
                  <span className={remainingKcal < 0 ? ' text-amber-500' : ' text-emerald-500'}>
                    {' '}
                    ({remainingKcal >= 0 ? `zostało ${remainingKcal}` : `+${Math.abs(remainingKcal)}`})
                  </span>
                )}
              </span>
            ) : null}
          </p>
        </div>
        <div>
          <p className="text-text-muted text-[8px] font-black uppercase tracking-wider">Białko floor</p>
          <p className="font-bold text-text-primary">
            {Math.round(ctx.protein)}
            {ctx.targetProtein != null ? (
              <span className="text-text-muted font-semibold">
                {' '}/ {ctx.targetProtein} g
                {remainingProtein != null && remainingProtein > 0 ? (
                  <span className="text-amber-500"> · brakuje {remainingProtein} g</span>
                ) : ctx.targetProtein != null && ctx.protein >= ctx.targetProtein ? (
                  <span className="text-emerald-500"> · OK</span>
                ) : null}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      {ctx.todayFocus ? (
        <p className="text-[10px] leading-snug text-text-secondary border-t border-border-custom/40 pt-2">
          {ctx.todayFocus}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-border-custom/40 pt-2">
        <div className="min-w-0 space-y-1 text-[9px] text-text-muted leading-snug">
          {ctx.currentWeightKg != null ? (
            <p>
              Waga dziś <span className="font-bold text-text-primary">{ctx.currentWeightKg} kg</span>
              {ctx.currentBodyFatEst != null ? (
                <span> · est. {ctx.currentBodyFatEst}% BF</span>
              ) : null}
            </p>
          ) : null}
          {trend != null ? (
            <p>
              Tempo ze wagi:{' '}
              <span className={stalling ? 'font-bold text-amber-500' : 'font-bold text-emerald-500'}>
                {trend >= 0 ? '+' : ''}
                {trend.toFixed(2)} kg/tydz
              </span>
              <span className="text-text-muted"> (plan −{planLoss} kg/tydz)</span>
            </p>
          ) : (
            <p>Trend wagi — za mało ważeń (min. ~2 tygodnie)</p>
          )}
          {ctx.forecastWeight90d != null || ctx.forecastBf90d != null ? (
            <p>
              Gdyby tempo się nie zmieniło → za 90 dni{' '}
              {ctx.forecastWeight90d != null ? (
                <span className="font-semibold text-text-secondary">~{ctx.forecastWeight90d} kg</span>
              ) : null}
              {ctx.forecastBf90d != null ? (
                <span className="font-semibold text-text-secondary"> · ~{ctx.forecastBf90d.toFixed(1)}% BF</span>
              ) : null}
              {stalling && goalBfLabel ? (
                <span className="text-amber-500"> — nie domyka {goalBfLabel}</span>
              ) : null}
            </p>
          ) : null}
          {ctx.daysToGoalEst != null && !stalling ? (
            <p className="text-emerald-500 font-semibold">
              Przy tym tempie cel BF za ~{ctx.daysToGoalEst} dni
            </p>
          ) : stalling && goalLine ? (
            <p className="text-amber-500/90">
              Przy tym tempie {goalLine} nie wchodzi — trzymaj się targetu kcal i białka floor
            </p>
          ) : null}
        </div>
        <Button
          variant={logClosed ? 'tonal' : 'outline'}
          size="sm"
          type="button"
          onClick={onToggleLogClosed}
          className={logClosed ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/15' : ''}
        >
          {logClosed ? 'Log domknięty ✓' : 'Domknij log'}
        </Button>
      </div>
    </Card>
  );
}
