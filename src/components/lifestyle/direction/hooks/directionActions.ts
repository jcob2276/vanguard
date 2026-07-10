/**
 * Async action handlers for useDirection.
 * All "write" operations live here — separated from state management.
 */
import type { Session } from '@supabase/supabase-js';
import type { Tables, TablesUpdate } from '../../../../lib/database.types';
import {
  completeMonthlyReview,
  completeSprintClose,
  completeWeeklyReview,
  fetchSprintReview,
  saveWeeklyReviewReflection,
  updateDailyWin,
} from '../../../../lib/goal/goalSpine';
import { supabase } from '../../../../lib/supabase';
import { useHaptics } from '../../../../hooks/useHaptics';
import { notify } from '../../../../lib/notify';
import { TIMEOUTS } from '../../../../lib/constants';

type DailyWinRow = Tables<'daily_wins'>;

export interface ReflectionPayload {
  proudOf: string;
  doDifferently: string;
  sabotage: string;
  obligation: string;
  weekHighlight: string;
  weekRegret: string;
  newBelief: string;
  pillarScores: { cialo: number | null; duch: number | null; konto: number | null };
}

export interface PlanPayload {
  deepeningAnswers: Record<string, string>;
  weekIntention: string;
  weekCommitment: string;
  weekGoalCialo: string;
  weekGoalDuch: string;
  weekGoalKonto: string;
}

export interface MonthPayload {
  patternNote: string;
  leverageNote: string;
  correctionNote: string;
  monthTheme: string;
  monthRecap: any;
  monthFacts: any;
}

export interface SprintPayload {
  sprintReflection: string;
  nextSprintGoal: string;
  projectDecisions: Record<string, any>;
}

/** Returns action handlers bound to the provided state + setters. */
export function createDirectionActions(params: {
  userId: string;
  session: Session;
  haptics: ReturnType<typeof useHaptics>;
  closingWeekStart: string;
  closingMonthStart: string | null;
  isSunday: boolean;
  planTargetWeekStart: string;
  // setters
  setHistory: (fn: (prev: DailyWinRow[]) => DailyWinRow[]) => void;
  setCurrentReview: (v: any) => void;
  setReflectionPersisted: (v: boolean) => void;
  setPhase2: (v: any) => void;
  setPhase2Loading: (v: boolean) => void;
  setSavingReflection: (v: boolean) => void;
  setMonthReview: (v: any) => void;
  setMonthCompleting: (v: boolean) => void;
  setSprintReview: (v: any) => void;
  setSprintCompleting: (v: boolean) => void;
  setCompleting: (v: boolean) => void;
  setRitualClosed: (v: boolean) => void;
  setForceWeeklyReview: (v: boolean) => void;
  applyMonthCarry: (review: any, facts: any) => void;
  fetchData: (opts?: { silent?: boolean }) => Promise<void>;
}) {
  const {
    userId, session, haptics,
    closingWeekStart, closingMonthStart, isSunday, planTargetWeekStart,
    setHistory, setCurrentReview, setReflectionPersisted,
    setPhase2, setPhase2Loading, setSavingReflection,
    setMonthReview, setMonthCompleting,
    setSprintReview, setSprintCompleting,
    setCompleting, setRitualClosed, setForceWeeklyReview,
    applyMonthCarry, fetchData,
  } = params;

  const callWeekRecap = async (phase: 'before' | 'after') => {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recap?type=weekly-recap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ weekStart: closingWeekStart, phase }),
      signal: AbortSignal.timeout(TIMEOUTS.heavy),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Błąd generowania przeglądu tygodnia');
    return data;
  };

  const callMonthRecap = async () => {
    if (!closingMonthStart) return null;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recap?type=weekly-recap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ monthStart: closingMonthStart, phase: 'month' }),
      signal: AbortSignal.timeout(TIMEOUTS.heavy),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Błąd generowania przeglądu miesiąca');
    return data;
  };

  async function togglePowerListTask(dayWinStale: DailyWinRow, index: number) {
    haptics.light();
    const { data: fresh } = await supabase.from('daily_wins').select('*').eq('id', dayWinStale.id).single();
    const dayWin = fresh ?? dayWinStale;
    const dayWinAny = dayWin as any;
    const field = `done_${index + 1}`;
    const timeField = `completed_at_${index + 1}`;
    const newValue = !dayWinAny[field];
    const timestamp = newValue ? new Date().toISOString() : null;

    const allDone = [1, 2, 3, 4, 5].every(i => {
      if (!dayWinAny[`task_${i}`]) return true;
      if (i === index + 1) return newValue;
      return dayWinAny[`done_${i}`];
    });

    const updates: TablesUpdate<'daily_wins'> = { [field]: newValue, [timeField]: timestamp };
    if (allDone) updates.result = 'Z';
    else {
      if (dayWin.result === 'Z') updates.result = null;
      const isPastDeadline = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Warsaw' })).getHours() >= 23;
      if (isPastDeadline && !allDone) updates.result = 'P';
    }

    try {
      const data = await updateDailyWin(userId, dayWin.id, updates);
      setHistory(prev => prev.map(d => d.id === data.id ? data : d));
      if (allDone) haptics.success();
    } catch (e: unknown) { notify('Nie udało się zapisać wygranej dnia.', 'error'); console.warn('[directionActions] Failed to update daily win:', e); }
  }

  async function saveReflection(payload: ReflectionPayload) {
    setSavingReflection(true);
    const data = await saveWeeklyReviewReflection(userId, closingWeekStart, {
      proud_of: payload.proudOf || null,
      do_differently: payload.doDifferently || null,
      sabotage: payload.sabotage || null,
      obligation: payload.obligation || null,
      week_highlight: payload.weekHighlight || null,
      week_regret: payload.weekRegret || null,
      new_belief: payload.newBelief || null,
      pillar_scores: payload.pillarScores,
      bottleneck: payload.doDifferently || null,
    });
    if (data) { setCurrentReview(data); setReflectionPersisted(true); }
    setSavingReflection(false);

    setPhase2Loading(true);
    try {
      const recap = await callWeekRecap('after');
      if (recap.phase2 && Array.isArray(recap.phase2.deepening_questions)) setPhase2(recap.phase2);
    } catch (err: unknown) { console.warn('[directionActions] Failed to call weekly recap:', err); } finally {
      setPhase2Loading(false);
    }
  }

  async function completeMonthly(payload: MonthPayload) {
    if (!closingMonthStart) return;
    setMonthCompleting(true);
    try {
      const data = await completeMonthlyReview(userId, closingMonthStart, {
        pattern_note: payload.patternNote || null,
        leverage_note: payload.leverageNote || null,
        correction_note: payload.correctionNote || null,
        month_theme: payload.monthTheme || null,
        ai_recap: payload.monthRecap ? { phase1: payload.monthRecap } : null,
        ritual_stats: payload.monthFacts ? (payload.monthFacts as any) : null,
      });
      if (data) {
        setMonthReview(data);
        applyMonthCarry({ month_theme: payload.monthTheme, correction_note: payload.correctionNote, leverage_note: payload.leverageNote }, payload.monthFacts);
        void fetchData({ silent: true });
      }
    } catch (e: unknown) { notify('Nie udało się zapisać miesięcznego podsumowania.', 'error'); console.warn('[directionActions] Failed to complete monthly review:', e); } finally {
      setMonthCompleting(false);
    }
  }

  async function completeSprint(payload: SprintPayload) {
    if (!payload.nextSprintGoal.trim()) return;
    setSprintCompleting(true);
    try {
      await completeSprintClose(userId, {
        reflection: payload.sprintReflection || null,
        nextSprintGoal: payload.nextSprintGoal.trim(),
        projectDecisions: payload.projectDecisions,
      });
      setSprintReview(await fetchSprintReview(userId));
      void fetchData({ silent: true });
    } catch (e: unknown) { notify('Nie udało się zapisać podsumowania sprintu.', 'error'); console.warn('[directionActions] Failed to complete sprint close:', e); } finally {
      setSprintCompleting(false);
    }
  }

  async function completeReview(payload: PlanPayload) {
    setCompleting(true);
    try {
      const data = await completeWeeklyReview(
        userId,
        closingWeekStart,
        {
          deepening_answers: Object.keys(payload.deepeningAnswers).length > 0 ? payload.deepeningAnswers : null,
          week_intention: payload.weekIntention || null,
          week_commitment: payload.weekCommitment || null,
          week_goal_cialo: payload.weekGoalCialo || null,
          week_goal_duch: payload.weekGoalDuch || null,
          week_goal_konto: payload.weekGoalKonto || null,
        },
        isSunday ? { planWeekStart: planTargetWeekStart } : undefined,
      );
      if (data) {
        setCurrentReview(data);
        setRitualClosed(true);
        setForceWeeklyReview(false);
        void fetchData({ silent: true });
      }
    } catch (e: unknown) { notify('Nie udało się zapisać podsumowania tygodnia.', 'error'); console.warn('[directionActions] Failed to complete weekly review:', e); } finally {
      setCompleting(false);
    }
  }

  return { callWeekRecap, callMonthRecap, togglePowerListTask, saveReflection, completeMonthly, completeSprint, completeReview };
}
