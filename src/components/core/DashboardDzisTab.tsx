import { TIMEZONE } from '../../lib/date';
import { Suspense, lazy } from 'react';
import { useSession } from '../../store/useStore';
import { SpineGuideStrip } from './SpineGuideStrip';
import OrientationFooter from './OrientationFooter';
import PowerList from '../lifestyle/PowerList';
import FoodQuickCapture from './nutrition/FoodQuickCapture';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';
import { useDashboardContext } from './context/DashboardContext';

const DailyStrainCard  = lazy(() => import('../biometrics/DailyStrainCard'));
const DailySnapshotCard = lazy(() => import('./DailySnapshotCard'));
const TodayEventsCard   = lazy(() => import('./TodayEventsCard'));

function ViewFallback() {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
      <Spinner size="md" />
    </div>
  );
}

function isAfter20(): boolean {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, hour: 'numeric', hour12: false });
    return parseInt(formatter.format(new Date()), 10) >= 20;
  } catch {
    return new Date().getHours() >= 20;
  }
}

export function DashboardDzisTab() {
  const session = useSession();
  const s = useDashboardContext();

  if (!session) return null;

  const weeklyReviewNudge = new Date().getDay() === 0 && !s.taskReviewDoneThisWeek && (
    <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h4 className="text-sm font-black text-primary uppercase tracking-wider">Tygodniowy Przegląd Zadań</h4>
        <p className="text-xs text-text-secondary mt-0.5 break-words">Niedziela to czas na oczyszczenie skrzynki i audyt projektów.</p>
      </div>
      <button onClick={() => s.setShowWeeklyReview(true)} className="shrink-0 px-3.5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black transition-colors btn-press shadow-sm">
        Rozpocznij
      </button>
    </div>
  );

  return (
    <div className="p-5 pb-8">
      <div className="lg:grid lg:grid-cols-2 lg:gap-5 space-y-5 lg:space-y-0">
        {/* Lewa kolumna: Planowanie i aktywne zadania */}
        <div className="space-y-5">
          <OrientationFooter />
          <SpineGuideStrip
            guidance={s.spineGuidance}
            loading={s.spineGuidanceLoading}
            onNavigate={s.handleSpineGuideNavigate}
            onPlanDay={s.handlePlanDay}
            onFocusPlan={s.handleFocusPlan}
          />
          {weeklyReviewNudge}
          <PowerList session={session} todayWin={s.todayWin} onUpdate={s.refresh} planDaySignal={s.planDaySignal} />
          {s.todayWin && isAfter20() && (
            <Button
              onClick={() => s.setShowShutdown(true)}
              variant="tonal"
              size="lg"
              className="w-full !text-primary dark:!text-primary !border-primary/20 !bg-primary/5 hover:!bg-primary/10 text-xs font-black uppercase tracking-wider shadow-sm"
            >
              Domknij Dzień (Rytuał Wieczorny)
            </Button>
          )}
        </div>

        {/* Prawa kolumna: Telemetria, biometria i wykresy */}
        <div className="space-y-5">
          <Suspense fallback={<ViewFallback />}>
            <DailyStrainCard refreshSignal={s.nutritionKey + s.workoutKey} />
          </Suspense>
          <Suspense fallback={null}>
            <TodayEventsCard />
          </Suspense>
          <FoodQuickCapture
            refreshSignal={s.nutritionKey}
            onSaved={() => { s.refresh(); s.setNutritionKey(k => k + 1); }}
            onOpenFullModal={() => s.setShowQuickFoodEntry(true)}
          />
          <Suspense fallback={<ViewFallback />}>
            <DailySnapshotCard />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
