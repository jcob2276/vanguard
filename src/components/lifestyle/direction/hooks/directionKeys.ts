/**
 * Pure derivations for useDirection: the date/week/month context the review rituals key
 * off, and the localStorage draft-key builders derived from that context. No React state,
 * no side effects — safe to unit-reason about independently of the hook that consumes it.
 */
import { addDays, endOfWeek, format, startOfWeek } from 'date-fns';
import { pl } from 'date-fns/locale';
import { currentWeekStart as getCurrentWeekStart, closingMonthStartForReview } from '../../../../lib/goal/goalSpine';
import { getTodayWarsaw } from '../../../../lib/date';
import type { getSprintInfo } from '../../../../lib/growth/sprintUtils';

export interface DirectionDateContext {
  currentWeekStart: string;
  isSunday: boolean;
  planWeekStart: Date;
  planWeekEnd: Date;
  planWeekLabel: string;
  closingWeekStart: string;
  planTargetWeekStart: string;
  closingMonthStart: string | null;
}

export function computeDirectionDateContext(): DirectionDateContext {
  const currentWeekStart = getCurrentWeekStart();
  const todayNoon = new Date(getTodayWarsaw() + 'T12:00:00');
  const isSunday = todayNoon.getDay() === 0;
  const planRef = isSunday ? addDays(todayNoon, 7) : todayNoon;
  const planWeekStart = startOfWeek(planRef, { weekStartsOn: 1 });
  const planWeekEnd = endOfWeek(planRef, { weekStartsOn: 1 });
  const planWeekLabel = `${format(planWeekStart, 'd MMM', { locale: pl })} – ${format(planWeekEnd, 'd MMM', { locale: pl })}`;
  const closingWeekStart = currentWeekStart;
  const planTargetWeekStart = isSunday ? format(planWeekStart, 'yyyy-MM-dd') : currentWeekStart;
  const closingMonthStart = closingMonthStartForReview(getTodayWarsaw());
  return { currentWeekStart, isSunday, planWeekStart, planWeekEnd, planWeekLabel, closingWeekStart, planTargetWeekStart, closingMonthStart };
}

export function directionDraftKeys(
  userId: string,
  ctx: Pick<DirectionDateContext, 'closingWeekStart' | 'planTargetWeekStart' | 'closingMonthStart'>,
  sprintInfo: ReturnType<typeof getSprintInfo>,
) {
  return {
    reflKey: (f: string) => `vanguard_review_draft_${f}_${userId}_${ctx.closingWeekStart}`,
    planKey: (f: string) => `vanguard_review_draft_${f}_${userId}_${ctx.planTargetWeekStart}`,
    monthKey: (f: string) => `vanguard_month_draft_${f}_${userId}_${ctx.closingMonthStart ?? 'none'}`,
    sprintDraftKey: (f: string) => `vanguard_sprint_draft_${f}_${userId}_${sprintInfo.personalYear}_${sprintInfo.sprintNumber}`,
  };
}
