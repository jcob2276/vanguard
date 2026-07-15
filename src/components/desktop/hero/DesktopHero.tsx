import type { StrainData, OuraData } from './CockpitBanner';
import { isSprintClosingWeek } from '../../../lib/goal/goalSpine';
import type { SprintReview } from '../../../lib/goal/goalSpine';
import type { SprintPanelProps } from '../fitness/SprintPanel';
import { SPRINT_SEASON } from '../desktopUtils';
import SprintMetricsGrid from '../fitness/SprintMetricsGrid';
import { LIMITER_PL } from '../../../lib/constants';
import { Card } from '../../ui/Card';
import { readinessTier } from '@vanguard/domain';

function cockpitDecision(status: string, limiter: string | null, strain: number | null, provisional: boolean | null) {
  const fuelLimiter = limiter === 'calories' || limiter === 'carbs';
  if (status === 'green') return 'Możesz cisnąć — wszystko na zielono';
  if (status === 'red') {
    if (limiter === 'sleep') return 'Zadedykuj czas na sen i odpoczynek';
    if (fuelLimiter && !provisional) return 'Uzupełnij energię — niski bilans';
    return 'Ładowanie baterii / Regeneracja';
  }
  if (limiter === 'sleep') return 'Umiarkowanie — sen poniżej normy';
  if (fuelLimiter && !provisional) return 'Umiarkowanie — dobierz kalorie';
  if (limiter === 'cardio_load' || limiter === 'strength_load') return 'Umiarkowanie — wczoraj duży koszt';
  return (strain || 0) < 8 ? 'Lekki dzień — jest zapas' : 'Umiarkowanie — monitoruj';
}

export interface DesktopHeroProps {
  strain: StrainData | null;
  oura: OuraData[];
  sprint: SprintPanelProps['sprint'];
  sprintGoal: SprintPanelProps['sprintGoal'];
  sprintReview?: SprintReview | null;
  metrics: SprintPanelProps['metrics'];
  prevMetrics: SprintPanelProps['prevMetrics'];
  projectMetrics: SprintPanelProps['projectMetrics'];
  goals: SprintPanelProps['goals'];
  currentWeight: number | null;
  weight30ago: number | null;
}

export default function DesktopHero({
  strain,
  oura,
  sprint,
  sprintGoal,
  sprintReview = null,
  metrics,
  prevMetrics,
  projectMetrics,
  goals,
  currentWeight,
  weight30ago,
}: DesktopHeroProps) {
  const latest = oura[oura.length - 1];
  const closingWeek = isSprintClosingWeek(sprint);

  const status = strain?.daily_status || 'unknown';
  const cfg = {
    green: { bg: 'var(--legacy-color-093)', border: '1px solid var(--legacy-color-098)', dot: 'bg-success', pulse: 'bg-success', tag: 'ZIELONY' },
    yellow: { bg: 'var(--legacy-color-119)', border: '1px solid var(--legacy-color-122)', dot: 'bg-warning', pulse: 'bg-warning', tag: 'ŻÓŁTY' },
    red: { bg: 'var(--legacy-color-110)', border: '1px solid var(--legacy-color-114)', dot: 'bg-danger', pulse: 'bg-danger', tag: 'CZERWONY' },
  }[status] || { bg: 'var(--legacy-color-141)', border: 'var(--border-desktop-hero-muted)', dot: 'bg-text-muted', pulse: 'bg-text-muted', tag: '—' };

  const msg = strain ? cockpitDecision(status, strain.main_limiter, strain.strain_score, strain.fueling_provisional) : 'Obserwatorium — pełny obraz z SQL';
  const limiter = strain?.main_limiter && strain.main_limiter !== 'recovery_ok' ? LIMITER_PL[strain.main_limiter] : null;
  const tier = latest?.readiness_score != null ? readinessTier(latest.readiness_score) : null;
  const readColor = !tier
    ? 'text-text-muted'
    : tier === 'green'
      ? 'text-success'
      : tier === 'yellow'
        ? 'text-warning'
        : 'text-danger';

  return (
    <section id="sprint" className="scroll-mt-28">
      <Card variant="surface" padding="0" className="overflow-hidden" style={{ borderRadius: 'var(--legacy-inline-style-009)', background: cfg.bg, border: cfg.border }}>
        <div className="px-8 py-5 flex items-center justify-between gap-8">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="relative flex items-center justify-center w-3 h-3">
              <div className={`absolute w-3 h-3 rounded-full ${cfg.pulse} opacity-[var(--opacity-40)] animate-ping`} />
              <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
            </div>
            <span className="text-2xs font-black uppercase tracking-[var(--legacy-arbitrary-044)] text-text-muted">{cfg.tag}</span>
          </div>
          <p className="font-display text-2xl font-black leading-tight text-text-primary">{msg}</p>
          {limiter && (
            <p className="text-xs text-text-secondary mt-1">
              Limiter: <span className="font-black">{limiter}</span>
            </p>
          )}
        </div>
        <div className="flex gap-4 shrink-0">
          {[
            { label: 'Readiness', val: latest?.readiness_score, unit: '/100', color: readColor },
            { label: 'HRV', val: latest?.hrv_avg, unit: 'ms' },
            { label: 'Sen', val: latest?.total_sleep_hours ? +latest.total_sleep_hours.toFixed(1) : null, unit: 'h' },
          ].map(({ label, val, unit, color }) => (
            <div key={label} className="text-center">
              <p className="text-2xs font-black uppercase tracking-widest text-text-muted mb-1">{label}</p>
              <p className={`font-display text-lg font-black leading-none ${color || 'text-text-primary'}`}>
                {val ?? '—'}
                <span className="text-xs text-text-muted font-semibold ml-0.5">{unit}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-8 py-4 border-t border-primary/10 bg-primary/[0.02]">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-2xs font-black uppercase tracking-[var(--legacy-arbitrary-044)] text-text-muted">
            Sprint scorecard
          </span>
          <span className="text-text-muted/40">·</span>
          <span className="text-2xs font-bold text-text-muted">
            {sprint.sprintStart} → {sprint.sprintEnd}
          </span>
          <span className="text-text-muted/40 hidden sm:inline">·</span>
          <span className="text-2xs font-black uppercase tracking-[var(--legacy-arbitrary-044)] text-text-muted hidden sm:inline">
            PY{sprint.personalYear}
          </span>
          <span className="text-text-muted/40 hidden sm:inline">→</span>
          <span className="rounded-full border border-primary/20 bg-primary/10 text-primary text-2xs font-black uppercase tracking-wider px-2.5 py-0.5 hidden sm:inline">
            Sprint {sprint.sprintNumber} · {SPRINT_SEASON[sprint.sprintNumber] || `S${sprint.sprintNumber}`}
          </span>
          <span className="text-2xs font-bold text-text-muted ml-auto">
            Tydzień {sprint.weekInSprint}/12 · {sprint.daysLeft} dni · {sprint.pct}%
          </span>
        </div>

        <div>
          {sprintGoal?.goal_text ? (
            <p className="text-lg font-black text-text-primary leading-snug">
              {sprintGoal.goal_text}
            </p>
          ) : (
            <p className="text-sm font-semibold text-text-muted italic">Brak celu sprintu</p>
          )}
          <a href="/?view=tydzien" className="text-xs font-black uppercase text-primary hover:underline">
            Edytuj w Tygodniu →
          </a>
        </div>

        <div className="h-1.5 mt-3 bg-border-custom rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-[var(--motion-deliberate)]" style={{ width: `${sprint.pct}%` }} />
        </div>

        {closingWeek && !sprintReview?.completed_at && (
          <div className="mt-4 pt-4 border-t border-primary/10 space-y-2">
            <p className="text-xs text-text-secondary leading-relaxed">
              Zamknięcie sprintu jest w zakładce <span className="font-bold text-primary">Tydzień</span> — agregat 12 tyg. + cel następnego sprintu.
            </p>
            <a
              href="/?view=tydzien"
              className="inline-flex rounded-[var(--radius-sm)] bg-primary/10 px-3 py-2 text-xs font-black uppercase text-primary"
            >
              Otwórz Tydzień → zamknij sprint
            </a>
          </div>
        )}
        {closingWeek && sprintReview?.completed_at && (
          <p className="mt-3 text-xs font-bold text-success">Sprint zamknięty w Tygodniu</p>
        )}

        <SprintMetricsGrid
          metrics={metrics}
          prevMetrics={prevMetrics}
          projectMetrics={projectMetrics}
          goals={goals}
          currentWeight={currentWeight}
          weight30ago={weight30ago}
        />
      </div>
      </Card>
    </section>
  );
}
