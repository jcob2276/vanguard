import type { Session } from '@supabase/supabase-js';
import MorningPlanModal from './MorningPlanModal';
import DailyShutdownModal from './DailyShutdownModal';
import WeeklyReviewModal from '../todo/WeeklyReviewModal';
import FoodEntryModal from './nutrition/FoodEntryModal';
import { ActionCenterSheet } from '../shared/ActionCenterSheet';
import { getTodayWarsaw, shiftDateStr } from '../../lib/date';

interface DashboardModalsProps {
  session: Session;
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
  foodEditEntry: any;
  setFoodEditEntry: (val: any) => void;
  actionCenterOpen: boolean;
  setActionCenterOpen: (val: boolean) => void;
  reloadPendingActions: () => void;
  refresh: () => void;
  setNutritionKey: React.Dispatch<React.SetStateAction<number>>;
}

export function DashboardModals({
  session,
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
    <>
      {showMorningPlan && (
        <MorningPlanModal
          session={session}
          targetDate={morningPlanTargetDate ?? undefined}
          onClose={() => {
            setShowMorningPlan(false);
            setMorningPlanTargetDate(null);
          }}
        />
      )}

      {showShutdown && (
        <DailyShutdownModal
          session={session}
          onClose={() => {
            try { localStorage.setItem('vanguard_shutdown_dismissed', getTodayWarsaw()); } catch (e: unknown) {
      console.warn('[DashboardModals] Failed to save shutdown dismissed date to localStorage:', e);
    }
            setShowShutdown(false);
          }}
          onSaved={refresh}
          onPlanTomorrow={() => {
            const tomorrowStr = shiftDateStr(getTodayWarsaw(), 1);
            try { localStorage.setItem('vanguard_shutdown_dismissed', getTodayWarsaw()); } catch (e: unknown) {
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
          session={session}
          onClose={() => setShowWeeklyReview(false)}
          onFinished={() => {
            setTaskReviewDoneThisWeek(true);
            refresh();
          }}
        />
      )}

      {showQuickFoodEntry && (
        <FoodEntryModal
          session={session}
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

      {session && (
        <ActionCenterSheet
          session={session}
          open={actionCenterOpen}
          onClose={() => setActionCenterOpen(false)}
          onUpdated={() => void reloadPendingActions()}
        />
      )}
    </>
  );
}
