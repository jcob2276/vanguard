import { Suspense, lazy } from 'react';
import { getTodayWarsaw, shiftDateStr } from '../../lib/date';
import { STORAGE_KEYS } from '../../lib/constants';
import type { RecentEntry } from './nutrition/hooks/useFoodEntryData';

const MorningPlanModal = lazy(() => import('./MorningPlanModal'));
const DailyShutdownModal = lazy(() => import('./DailyShutdownModal'));
const WeeklyReviewModal = lazy(() => import('../todo/WeeklyReviewModal'));
const FoodEntryModal = lazy(() => import('./nutrition/FoodEntryModal'));
const ActionCenterSheet = lazy(() => import('../shared/ActionCenterSheet').then(m => ({ default: m.ActionCenterSheet })));

interface DashboardModalsProps {
  showMorningPlan: boolean;
  setShowMorningPlan: (val: boolean) => void;
  morningPlanTargetDate: string | null;
  setMorningPlanTargetDate: (val: string | null) => void;
  showShutdown: boolean;
  setShowShutdown: (val: boolean) => void;
  showWeeklyReview: boolean;
  setShowWeeklyReview: (val: boolean) => void;
  setTaskReviewDoneThisWeek: (val: boolean) => void;
  showQuickFoodEntry: boolean;
  setShowQuickFoodEntry: (val: boolean) => void;
  foodEditEntry: RecentEntry | null;
  setFoodEditEntry: (val: RecentEntry | null) => void;
  actionCenterOpen: boolean;
  setActionCenterOpen: (val: boolean) => void;
  reloadPendingActions: () => void;
  refresh: () => void;
  setNutritionKey: React.Dispatch<React.SetStateAction<number>>;
}

export function DashboardModals({
  showMorningPlan,
  setShowMorningPlan,
  morningPlanTargetDate,
  setMorningPlanTargetDate,
  showShutdown,
  setShowShutdown,
  showWeeklyReview,
  setShowWeeklyReview,
  setTaskReviewDoneThisWeek,
  showQuickFoodEntry,
  setShowQuickFoodEntry,
  foodEditEntry,
  setFoodEditEntry,
  actionCenterOpen,
  setActionCenterOpen,
  reloadPendingActions,
  refresh,
  setNutritionKey,
}: DashboardModalsProps) {
  return (
    <Suspense fallback={null}>
      {showMorningPlan && (
        <MorningPlanModal
          targetDate={morningPlanTargetDate ?? undefined}
          onClose={() => {
            setShowMorningPlan(false);
            setMorningPlanTargetDate(null);
          }}
        />
      )}

      {showShutdown && (
        <DailyShutdownModal
          onClose={() => {
            try { localStorage.setItem(STORAGE_KEYS.SHUTDOWN_DISMISSED, getTodayWarsaw()); } catch (e: unknown) {
      console.warn('[DashboardModals] Failed to save shutdown dismissed date to localStorage:', e);
    }
            setShowShutdown(false);
          }}
          onSaved={refresh}
          onPlanTomorrow={() => {
            const tomorrowStr = shiftDateStr(getTodayWarsaw(), 1);
            try { localStorage.setItem(STORAGE_KEYS.SHUTDOWN_DISMISSED, getTodayWarsaw()); } catch (e: unknown) {
              console.warn('[DashboardModals] Failed to save shutdown dismissed date to localStorage:', e);
            }
            setShowShutdown(false);
            setMorningPlanTargetDate(tomorrowStr);
            setShowMorningPlan(true);
          }}
        />
      )}

      {showWeeklyReview && (
        <WeeklyReviewModal
          onClose={() => setShowWeeklyReview(false)}
          onFinished={() => {
            setTaskReviewDoneThisWeek(true);
            refresh();
          }}
        />
      )}

      {showQuickFoodEntry && (
        <FoodEntryModal
          onClose={() => {
            setShowQuickFoodEntry(false);
            setFoodEditEntry(null);
          }}
          onSaved={() => {
            refresh();
            setNutritionKey(k => k + 1);
          }}
          initialEditEntry={foodEditEntry ?? undefined}
        />
      )}

      <ActionCenterSheet
        open={actionCenterOpen}
        onClose={() => setActionCenterOpen(false)}
        onUpdated={() => void reloadPendingActions()}
      />
    </Suspense>
  );
}
