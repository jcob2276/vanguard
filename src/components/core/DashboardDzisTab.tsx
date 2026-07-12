import { TIMEZONE } from '../../lib/date';
import { Suspense, lazy } from 'react';
import { useSession } from '../../store/useStore';
import type { SpineGuidance, SpineGuideTarget } from '../../lib/goal/goalSpineGuide';
import type { Tables } from '../../lib/database.types';
import { SpineGuideStrip } from './SpineGuideStrip';
import OrientationFooter from './OrientationFooter';
import PowerList from '../lifestyle/PowerList';
import FoodQuickCapture from './nutrition/FoodQuickCapture';
import Spinner from '../ui/Spinner';

type DailyWinRow = Tables<'daily_wins'>;

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

interface Props {
  todayWin: DailyWinRow | null;
  spineGuidance: SpineGuidance | null;
  spineGuidanceLoading: boolean;
  weeklyReviewNudge: React.ReactNode;
  planDaySignal: number;
  nutritionKey: number;
  workoutKey: number;
  onRefresh: () => void;
  onSetNutritionKey: (fn: (k: number) => number) => void;
  onOpenFoodModal: () => void;
  onOpenShutdown: () => void;
  onSpineGuideNavigate: (target: SpineGuideTarget) => void;
  onPlanDay: () => void;
  onFocusPlan: () => void;
}

export function DashboardDzisTab({
  todayWin, spineGuidance, spineGuidanceLoading,
  weeklyReviewNudge, planDaySignal, nutritionKey, workoutKey,
  onRefresh, onSetNutritionKey, onOpenFoodModal, onOpenShutdown,
  onSpineGuideNavigate, onPlanDay, onFocusPlan,
}: Props) {
  const session = useSession();
  if (!session) return null;
  return (
    <div className="p-5 pb-8">
      <div className="space-y-5">
        <OrientationFooter />
        <SpineGuideStrip
          guidance={spineGuidance}
          loading={spineGuidanceLoading}
          onNavigate={onSpineGuideNavigate}
          onPlanDay={onPlanDay}
          onFocusPlan={onFocusPlan}
        />
        {weeklyReviewNudge}

        <Suspense fallback={<ViewFallback />}>
          <DailyStrainCard refreshSignal={nutritionKey + workoutKey} />
        </Suspense>

        <Suspense fallback={null}>
          <TodayEventsCard />
        </Suspense>

        <FoodQuickCapture
          session={session}
          refreshSignal={nutritionKey}
          onSaved={() => { onRefresh(); onSetNutritionKey(k => k + 1); }}
          onOpenFullModal={onOpenFoodModal}
        />

        <PowerList session={session} todayWin={todayWin} onUpdate={onRefresh} planDaySignal={planDaySignal} />

        {todayWin && isAfter20() && (
          <button
            onClick={onOpenShutdown}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-sm font-black uppercase tracking-wider text-indigo-500 hover:bg-indigo-500/20 active:scale-95 transition-all shadow-sm"
          >
            Domknij Dzień (Rytuał Wieczorny)
          </button>
        )}

        <Suspense fallback={<ViewFallback />}>
          <DailySnapshotCard />
        </Suspense>
      </div>
    </div>
  );
}
