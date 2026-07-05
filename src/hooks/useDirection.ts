import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  addDays,
  endOfWeek,
  format,
  startOfWeek,
  subDays,
} from 'date-fns';
import { pl } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import type { Tables, TablesUpdate } from '../lib/database.types';
import {
  closingMonthStartForReview,
  completeMonthlyReview,
  completeSprintClose,
  completeWeeklyReview,
  currentWeekStart as getCurrentWeekStart,
  fetchMonthlyReview,
  fetchSprintReview,
  fetchWeeklyReviewFull,
  gatherMonthFacts,
  gatherSprintFacts,
  nextWeekStart,
  previousWeekStart,
  markDailyWinsPartial,
  saveWeeklyReviewReflection,
  updateDailyWin,
} from '../lib/goalSpine';
import { monthCarryToWeekPlan } from '../lib/monthCarry';
import { monthThemeSourceStart } from '../lib/monthReview';
import { getSprintInfo } from '../components/desktop/desktopUtils';
import { useHaptics } from './useHaptics';
import { usePersistentDraft } from './usePersistentDraft';
import { useWarsawDayChange } from './useWarsawDayChange';
import { formatWarsawDate, getTodayWarsaw, warsawDayBoundsISO } from '../lib/date';
import { calculateStats, calculateWeekFacts } from '../components/lifestyle/directionHelpers';

type DailyWinRow = Tables<'daily_wins'>;
type WeeklyReviewRow = Tables<'weekly_reviews'>;
type Phase1Recap = { narrative: string; longterm_motif: string | null; question: string };
type MonthRecap = Phase1Recap;
type Phase2Recap = {
  narrative_check: string;
  deepening_questions?: string[];
  block5_material?: { cialo: string; duch: string; konto: string };
};
type PillarScores = { cialo: number | null; duch: number | null; konto: number | null };
type CalendarRow = Pick<Tables<'vanguard_calendar'>, 'summary' | 'start_time' | 'end_time'>;
type SprintProjectDecision = any; // matches desktopUtils

const todayWarsaw = () => getTodayWarsaw();

export function useDirection(session: Session, onOpenActionCenter?: () => void) {
  const haptics = useHaptics();
  const userId = session.user.id;
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<DailyWinRow[]>([]);

  const [currentReview, setCurrentReview] = useState<WeeklyReviewRow | null>(null);
  const [allCalEvents, setAllCalEvents] = useState<CalendarRow[]>([]);

  const currentWeekStart = getCurrentWeekStart();

  const todayNoon = new Date(todayWarsaw() + 'T12:00:00');
  const isSunday = todayNoon.getDay() === 0;

  // Sunday → plan next week; otherwise → current week
  const planRef = isSunday ? addDays(todayNoon, 7) : todayNoon;
  const planWeekStart = startOfWeek(planRef, { weekStartsOn: 1 });
  const planWeekEnd = endOfWeek(planRef, { weekStartsOn: 1 });
  const planWeekLabel = `${format(planWeekStart, 'd MMM', { locale: pl })} – ${format(planWeekEnd, 'd MMM', { locale: pl })}`;
  const closingWeekStart = currentWeekStart;
  const planTargetWeekStart = isSunday ? format(planWeekStart, 'yyyy-MM-dd') : currentWeekStart;

  // Persisted drafts
  const reflectionDraftKey = (field: string) =>
    `vanguard_review_draft_${field}_${userId}_${closingWeekStart}`;
  const planDraftKey = (field: string) =>
    `vanguard_review_draft_${field}_${userId}_${planTargetWeekStart}`;

  const [proudOf, setProudOf] = usePersistentDraft(reflectionDraftKey('proudOf'), '');
  const [doDifferently, setDoDifferently] = usePersistentDraft(reflectionDraftKey('doDifferently'), '');
  const [sabotage, setSabotage] = usePersistentDraft(reflectionDraftKey('sabotage'), '');
  const [obligation, setObligation] = usePersistentDraft(reflectionDraftKey('obligation'), '');
  const [weekHighlight, setWeekHighlight] = usePersistentDraft(reflectionDraftKey('weekHighlight'), '');
  const [weekRegret, setWeekRegret] = usePersistentDraft(reflectionDraftKey('weekRegret'), '');
  const [newBelief, setNewBelief] = usePersistentDraft(reflectionDraftKey('newBelief'), '');
  const [weekIntention, setWeekIntention] = usePersistentDraft(planDraftKey('weekIntention'), '');
  const [weekCommitment, setWeekCommitment] = usePersistentDraft(planDraftKey('weekCommitment'), '');
  const [weekGoalCialo, setWeekGoalCialo] = usePersistentDraft(planDraftKey('weekGoalCialo'), '');
  const [weekGoalDuch, setWeekGoalDuch] = usePersistentDraft(planDraftKey('weekGoalDuch'), '');
  const [weekGoalKonto, setWeekGoalKonto] = usePersistentDraft(planDraftKey('weekGoalKonto'), '');

  const [pillarScores, setPillarScores] = useState<PillarScores>({ cialo: null, duch: null, konto: null });
  const [prevWeekReview, setPrevWeekReview] = useState<WeeklyReviewRow | null>(null);
  const [weekDoneTasks, setWeekDoneTasks] = useState<{ title: string; status: string }[]>([]);
  const [weekOura, setWeekOura] = useState<{ total_sleep_hours: number | null; readiness_score: number | null }[]>([]);
  const [weekRuns, setWeekRuns] = useState<{ distance: number | null }[]>([]);
  const [weekNutrition, setWeekNutrition] = useState<{ calories: number | null }[]>([]);
  const [nutritionTarget, setNutritionTarget] = useState<number | null>(null);

  const [phase1, setPhase1] = useState<Phase1Recap | null>(null);
  const [phase1Loading, setPhase1Loading] = useState(false);
  const [phase2, setPhase2] = useState<Phase2Recap | null>(null);
  const [phase2Loading, setPhase2Loading] = useState(false);

  const [savingReflection, setSavingReflection] = useState(false);
  const [reflectionPersisted, setReflectionPersisted] = useState(false);
  const [deepeningAnswers, setDeepeningAnswers] = usePersistentDraft<Record<string, string>>(
    reflectionDraftKey('deepeningAnswers'),
    {},
  );
  const [completing, setCompleting] = useState(false);
  const [ritualClosed, setRitualClosed] = useState(false);
  const [forceWeeklyReview, setForceWeeklyReview] = useState(false);

  const planSaved = ritualClosed || !!currentReview?.review_completed_at;
  const showPlanningMode = isSunday && !planSaved;

  const closingMonthStart = closingMonthStartForReview(todayWarsaw());
  const [monthReview, setMonthReview] = useState<Tables<'monthly_reviews'> | null>(null);
  const [monthFacts, setMonthFacts] = useState<any>(null);
  const [monthRecap, setMonthRecap] = useState<MonthRecap | null>(null);
  const [monthRecapLoading, setMonthRecapLoading] = useState(false);
  const [monthCompleting, setMonthCompleting] = useState(false);

  const monthDraftKey = (field: string) =>
    `vanguard_month_draft_${field}_${userId}_${closingMonthStart ?? 'none'}`;
  const [patternNote, setPatternNote] = usePersistentDraft(monthDraftKey('pattern'), '');
  const [leverageNote, setLeverageNote] = usePersistentDraft(monthDraftKey('leverage'), '');
  const [correctionNote, setCorrectionNote] = usePersistentDraft(monthDraftKey('correction'), '');
  const [monthTheme, setMonthTheme] = usePersistentDraft(monthDraftKey('theme'), '');

  const sprintInfo = useMemo(() => getSprintInfo(), []);
  const sprintClosingWeek = sprintInfo.weekInSprint === 12;
  const [sprintReview, setSprintReview] = useState<any>(null);
  const [sprintFacts, setSprintFacts] = useState<any>(null);
  const [sprintCompleting, setSprintCompleting] = useState(false);

  const sprintDraftKey = (field: string) =>
    `vanguard_sprint_draft_${field}_${userId}_${sprintInfo.personalYear}_${sprintInfo.sprintNumber}`;
  const [sprintReflection, setSprintReflection] = usePersistentDraft(sprintDraftKey('reflection'), '');
  const [nextSprintGoal, setNextSprintGoal] = usePersistentDraft(sprintDraftKey('nextGoal'), '');
  const [projectDecisions, setProjectDecisions] = usePersistentDraft<Record<string, SprintProjectDecision>>(
    sprintDraftKey('projects'),
    {},
  );
  const [intentionFromMonth, setIntentionFromMonth] = useState(false);
  const [carryMonthTheme, setCarryMonthTheme] = useState<string | null>(null);
  const [planCarriedFromMonth, setPlanCarriedFromMonth] = useState(false);

  const sprintCloseDue = sprintClosingWeek && !sprintReview?.completed_at;
  const showSprintMode = sprintCloseDue;
  const monthlyDue = Boolean(closingMonthStart && !monthReview?.completed_at);
  const monthlyComplete = Boolean(monthReview?.completed_at);
  const showMonthlyMode = monthlyDue && !showSprintMode;
  const showWeeklyPlanning =
    ((showPlanningMode && (!showMonthlyMode || monthlyComplete) && !showSprintMode) || forceWeeklyReview);

  const [activeProjects, setActiveProjects] = useState<{ id: string; name: string }[]>([]);

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const today = todayWarsaw();
    const now = new Date(today + 'T12:00:00');
    const isSundayFetch = now.getDay() === 0;
    const planWeekStartStr = isSundayFetch ? nextWeekStart(currentWeekStart) : null;

    const calFrom = subDays(startOfWeek(now, { weekStartsOn: 1 }), 1).toISOString();
    const calTo = addDays(endOfWeek(addDays(now, 7), { weekStartsOn: 1 }), 1).toISOString();
    const prevWeekStart = previousWeekStart(currentWeekStart);
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const monthStart = closingMonthStartForReview(today);

    try {
      const [
        ,
        { data: historyData },
        reviewData,
        planReviewData,
        { data: calData },
        prevReviewData,
        { data: ouraData },
        { data: runsData },
        { data: nutritionData },
        { data: nutritionTargetData },
        { data: doneTasksData },
        { data: projectsData },
        monthReviewData,
        monthFactsData,
        sprintReviewData,
        sprintFactsData,
        activeThemeReviewData,
      ] = await Promise.all([
        supabase.from('daily_wins').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
        supabase.from('daily_wins').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(60),
        fetchWeeklyReviewFull(userId, currentWeekStart),
        planWeekStartStr ? fetchWeeklyReviewFull(userId, planWeekStartStr) : Promise.resolve(null),
        supabase.from('vanguard_calendar').select('summary, start_time, end_time').eq('user_id', userId).gte('start_time', calFrom).lt('start_time', calTo).order('start_time'),
        fetchWeeklyReviewFull(userId, prevWeekStart),
        supabase.from('oura_daily_summary').select('total_sleep_hours, readiness_score').eq('user_id', userId).gte('date', currentWeekStart).lte('date', weekEnd),
        supabase.from('strava_activities').select('distance').eq('user_id', userId).gte('start_date', warsawDayBoundsISO(currentWeekStart).fromISO).lte('start_date', warsawDayBoundsISO(weekEnd).toISO),
        supabase.from('daily_nutrition').select('calories').eq('user_id', userId).gte('date', currentWeekStart).lte('date', weekEnd),
        supabase.from('nutrition_targets').select('target_kcal').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('todo_items').select('title, status').eq('user_id', userId).in('status', ['done', 'dropped']).gte('updated_at', warsawDayBoundsISO(currentWeekStart).fromISO).lte('updated_at', warsawDayBoundsISO(weekEnd).toISO),
        supabase.from('projects').select('id, name').eq('user_id', userId).eq('status', 'active'),
        monthStart ? fetchMonthlyReview(userId, monthStart) : Promise.resolve(null),
        monthStart ? gatherMonthFacts(userId, monthStart) : Promise.resolve(null),
        sprintClosingWeek ? fetchSprintReview(userId) : Promise.resolve(null),
        sprintClosingWeek ? gatherSprintFacts(userId) : Promise.resolve(null),
        isSundayFetch ? fetchMonthlyReview(userId, monthThemeSourceStart(today)) : Promise.resolve(null),
      ]);

      setHistory(historyData || []);
      setAllCalEvents(calData || []);
      setPrevWeekReview(prevReviewData || null);
      setWeekOura(ouraData || []);
      setWeekRuns(runsData || []);
      setWeekNutrition(nutritionData || []);
      setNutritionTarget((nutritionTargetData as any)?.target_kcal ?? null);
      setWeekDoneTasks((doneTasksData || []).map((t: any) => ({ title: t.title, status: t.status })));
      setActiveProjects((projectsData || []).map((p: any) => ({ id: p.id, name: p.name })));

      if (monthReviewData) {
        setMonthReview(monthReviewData);
        if (monthReviewData.pattern_note) setPatternNote(monthReviewData.pattern_note);
        if (monthReviewData.leverage_note) setLeverageNote(monthReviewData.leverage_note);
        if (monthReviewData.correction_note) setCorrectionNote(monthReviewData.correction_note);
        if (monthReviewData.month_theme) setMonthTheme(monthReviewData.month_theme);
        const mRecap = monthReviewData.ai_recap as { phase1?: MonthRecap } | null;
        if (mRecap?.phase1) setMonthRecap(mRecap.phase1);
      } else {
        setMonthReview(null);
        setMonthRecap(null);
      }
      setMonthFacts(monthFactsData);

      if (sprintReviewData) {
        setSprintReview(sprintReviewData);
        if (sprintReviewData.reflection) setSprintReflection(sprintReviewData.reflection);
      } else {
        setSprintReview(null);
      }
      setSprintFacts(sprintFactsData);
      setCarryMonthTheme(activeThemeReviewData?.month_theme?.trim() || null);

      if (reviewData) {
        setCurrentReview(reviewData);
        if (reviewData.review_completed_at) setRitualClosed(false);
        if (reviewData.proud_of) setProudOf(reviewData.proud_of);
        if (reviewData.do_differently) setDoDifferently(reviewData.do_differently);
        if (reviewData.sabotage) setSabotage(reviewData.sabotage);
        if (reviewData.obligation) setObligation(reviewData.obligation);
        if ((reviewData as any).week_highlight) setWeekHighlight((reviewData as any).week_highlight);
        if ((reviewData as any).week_regret) setWeekRegret((reviewData as any).week_regret);
        if ((reviewData as any).new_belief) setNewBelief((reviewData as any).new_belief);
        if (reviewData.pillar_scores && typeof reviewData.pillar_scores === 'object' && !Array.isArray(reviewData.pillar_scores)) {
          setPillarScores((prev) => ({ ...prev, ...(reviewData.pillar_scores as Partial<PillarScores>) }));
        }
        const recap = reviewData.ai_recap as { phase1?: Phase1Recap; phase2?: Phase2Recap } | null;
        if (recap?.phase1) setPhase1(recap.phase1);
        if (recap?.phase2 && Array.isArray(recap.phase2.deepening_questions)) setPhase2(recap.phase2);
        if (reviewData.deepening_answers && typeof reviewData.deepening_answers === 'object' && !Array.isArray(reviewData.deepening_answers)) {
          setDeepeningAnswers(reviewData.deepening_answers as Record<string, string>);
        }
        const hasReflection =
          Boolean(reviewData.proud_of?.trim()) ||
          Boolean(reviewData.obligation?.trim()) ||
          Boolean(reviewData.do_differently?.trim()) ||
          Boolean(reviewData.sabotage?.trim());
        if (hasReflection) setReflectionPersisted(true);
      }

      const planSource = planReviewData ?? (isSundayFetch ? null : reviewData);
      if (planSource) {
        if ((planSource as any).week_intention) setWeekIntention((planSource as any).week_intention);
        if ((planSource as any).week_commitment) setWeekCommitment((planSource as any).week_commitment);
        if ((planSource as any).week_goal_cialo) setWeekGoalCialo((planSource as any).week_goal_cialo);
        if ((planSource as any).week_goal_duch) setWeekGoalDuch((planSource as any).week_goal_duch);
        if ((planSource as any).week_goal_konto) setWeekGoalKonto((planSource as any).week_goal_konto);
      }

      const pastUnfinished = historyData?.filter((d) => d.date && d.date < today && d.result === null) || [];
      if (pastUnfinished.length > 0) {
        try {
          await markDailyWinsPartial(userId, pastUnfinished.map((d) => d.id));
          const { data: updated } = await supabase.from('daily_wins').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(60);
          setHistory(updated || []);
        } catch (err) {
          console.error('Failed to mark past unfinished days as P:', err);
        }
      }
    } catch (err) {
      console.error('Direction fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, currentWeekStart, sprintClosingWeek]);

  const applyMonthCarry = useCallback(
    (review: { month_theme?: string | null; correction_note?: string | null; leverage_note?: string | null } | null, facts: any) => {
      const carry = monthCarryToWeekPlan(review, facts);
      let applied = false;
      if (carry.intention && !weekIntention.trim()) {
        setWeekIntention(carry.intention);
        setIntentionFromMonth(true);
        applied = true;
      }
      if (carry.commitment && !weekCommitment.trim()) {
        setWeekCommitment(carry.commitment);
        applied = true;
      }
      for (const pillar of ['cialo', 'duch', 'konto'] as const) {
        const val = carry[pillar];
        const setter = pillar === 'cialo' ? setWeekGoalCialo : pillar === 'duch' ? setWeekGoalDuch : setWeekGoalKonto;
        const current = pillar === 'cialo' ? weekGoalCialo : pillar === 'duch' ? weekGoalDuch : weekGoalKonto;
        if (val && !current.trim()) {
          setter(val);
          applied = true;
        }
      }
      if (applied) setPlanCarriedFromMonth(true);
    },
    [weekIntention, weekCommitment, weekGoalCialo, weekGoalDuch, weekGoalKonto, setWeekIntention, setWeekCommitment, setWeekGoalCialo, setWeekGoalDuch, setWeekGoalKonto],
  );

  useEffect(() => {
    if (!showWeeklyPlanning || planCarriedFromMonth) return;
    const review = monthReview ?? (carryMonthTheme ? { month_theme: carryMonthTheme } : null);
    applyMonthCarry(review, monthFacts);
  }, [showWeeklyPlanning, planCarriedFromMonth, monthReview, monthFacts, carryMonthTheme, applyMonthCarry]);

  useEffect(() => {
    const t = setTimeout(() => { if (userId) void fetchData(); }, 0);
    return () => clearTimeout(t);
  }, [userId, fetchData]);

  useWarsawDayChange(() => {
    if (userId) void fetchData({ silent: true });
  });

  const callWeekRecap = useCallback(async (phase: 'before' | 'after') => {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vanguard-week-recap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ weekStart: closingWeekStart, phase }),
      signal: AbortSignal.timeout(45000),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Błąd generowania przeglądu tygodnia');
    return data;
  }, [session, closingWeekStart]);

  const callMonthRecap = useCallback(async () => {
    if (!closingMonthStart) return null;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vanguard-week-recap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ monthStart: closingMonthStart, phase: 'month' }),
      signal: AbortSignal.timeout(45000),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Błąd generowania przeglądu miesiąca');
    return data;
  }, [session, closingMonthStart]);

  useEffect(() => {
    if (!showWeeklyPlanning || loading || phase1 || phase1Loading) return;
    setPhase1Loading(true);
    callWeekRecap('before')
      .then((data) => setPhase1(data.phase1))
      .catch((err) => console.error('Layer 1 (before) failed:', err))
      .finally(() => setPhase1Loading(false));
  }, [showWeeklyPlanning, loading, phase1, phase1Loading, callWeekRecap]);

  useEffect(() => {
    if (!showMonthlyMode || loading || monthRecap || monthRecapLoading) return;
    setMonthRecapLoading(true);
    callMonthRecap()
      .then((data) => { if (data?.phase1) setMonthRecap(data.phase1); })
      .catch((err) => console.error('Month recap failed:', err))
      .finally(() => setMonthRecapLoading(false));
  }, [showMonthlyMode, loading, monthRecap, monthRecapLoading, callMonthRecap]);

  const stats = useMemo(() => calculateStats(history), [history]);

  const prevWeekScores = useMemo(() => {
    const ps = prevWeekReview?.pillar_scores;
    if (!ps || typeof ps !== 'object' || Array.isArray(ps)) return null;
    return ps as { cialo?: number; duch?: number; konto?: number };
  }, [prevWeekReview]);

  const weekFacts = useMemo(() => {
    return calculateWeekFacts(weekDoneTasks, weekOura, weekRuns, weekNutrition, nutritionTarget);
  }, [weekDoneTasks, weekOura, weekRuns, weekNutrition, nutritionTarget]);

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

    const updates: TablesUpdate<'daily_wins'> = {
      [field]: newValue,
      [timeField]: timestamp
    };

    if (allDone) updates.result = 'Z';
    else {
      if (dayWin.result === 'Z') updates.result = null;
      const isPastDeadline = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Warsaw' })).getHours() >= 23;
      if (isPastDeadline && !allDone) updates.result = 'P';
    }

    try {
      const data = await updateDailyWin(userId, dayWin.id, updates);
      setHistory((prev) => prev.map((d) => d.id === data.id ? data : d));
      if (allDone) haptics.success();
    } catch (e) {
      console.error('[Direction] togglePowerListTask failed', e);
    }
  }

  async function saveReflection() {
    if (savingReflection) return;
    setSavingReflection(true);
    const data = await saveWeeklyReviewReflection(userId, closingWeekStart, {
      proud_of: proudOf || null,
      do_differently: doDifferently || null,
      sabotage: sabotage || null,
      obligation: obligation || null,
      week_highlight: weekHighlight || null,
      week_regret: weekRegret || null,
      new_belief: newBelief || null,
      pillar_scores: pillarScores,
      bottleneck: doDifferently || null,
    });
    if (data) {
      setCurrentReview(data);
      setReflectionPersisted(true);
    }
    setSavingReflection(false);

    setPhase2Loading(true);
    try {
      const recap = await callWeekRecap('after');
      if (recap.phase2 && Array.isArray(recap.phase2.deepening_questions)) {
        setPhase2(recap.phase2);
      }
    } catch (err) {
      console.error('Phase after failed:', err);
    } finally {
      setPhase2Loading(false);
    }
  }

  async function completeMonthly() {
    if (!closingMonthStart || monthCompleting) return;
    setMonthCompleting(true);
    try {
      const data = await completeMonthlyReview(
        userId,
        closingMonthStart,
        {
          pattern_note: patternNote || null,
          leverage_note: leverageNote || null,
          correction_note: correctionNote || null,
          month_theme: monthTheme || null,
          ai_recap: monthRecap ? { phase1: monthRecap } : null,
          ritual_stats: monthFacts ? (monthFacts as any) : null,
        },
      );
      if (data) {
        setMonthReview(data);
        applyMonthCarry(
          {
            month_theme: monthTheme,
            correction_note: correctionNote,
            leverage_note: leverageNote,
          },
          monthFacts,
        );
        void fetchData({ silent: true });
      }
    } catch (e) {
      console.error('completeMonthly failed:', e);
    } finally {
      setMonthCompleting(false);
    }
  }

  async function completeSprint() {
    if (sprintCompleting || !nextSprintGoal.trim()) return;
    setSprintCompleting(true);
    try {
      await completeSprintClose(userId, {
        reflection: sprintReflection || null,
        nextSprintGoal: nextSprintGoal.trim(),
        projectDecisions,
      });
      setSprintReview(await fetchSprintReview(userId));
      void fetchData({ silent: true });
    } catch (e) {
      console.error('completeSprint failed:', e);
    } finally {
      setSprintCompleting(false);
    }
  }

  async function completeReview() {
    if (completing) return;
    setCompleting(true);
    try {
      const data = await completeWeeklyReview(
        userId,
        closingWeekStart,
        {
          deepening_answers: Object.keys(deepeningAnswers).length > 0 ? deepeningAnswers : null,
          week_intention: weekIntention || null,
          week_commitment: weekCommitment || null,
          week_goal_cialo: weekGoalCialo || null,
          week_goal_duch: weekGoalDuch || null,
          week_goal_konto: weekGoalKonto || null,
        },
        isSunday ? { planWeekStart: planTargetWeekStart } : undefined,
      );
      if (data) {
        setCurrentReview(data);
        setRitualClosed(true);
        setForceWeeklyReview(false);
        void fetchData({ silent: true });
      }
    } catch (e) {
      console.error('completeReview failed:', e);
    } finally {
      setCompleting(false);
    }
  }

  const reflectionSaved = reflectionPersisted;

  return {
    loading,
    history,
    currentReview,
    allCalEvents,
    planWeekLabel,
    planWeekStart,
    planWeekEnd,
    proudOf,
    setProudOf,
    doDifferently,
    setDoDifferently,
    sabotage,
    setSabotage,
    obligation,
    setObligation,
    weekHighlight,
    setWeekHighlight,
    weekRegret,
    setWeekRegret,
    newBelief,
    setNewBelief,
    weekIntention,
    setWeekIntention,
    weekCommitment,
    setWeekCommitment,
    weekGoalCialo,
    setWeekGoalCialo,
    weekGoalDuch,
    setWeekGoalDuch,
    weekGoalKonto,
    setWeekGoalKonto,
    pillarScores,
    setPillarScores,
    prevWeekReview,
    phase1,
    phase1Loading,
    phase2,
    phase2Loading,
    savingReflection,
    deepeningAnswers,
    setDeepeningAnswers,
    completing,
    ritualClosed,
    setForceWeeklyReview,
    monthReview,
    monthFacts,
    monthRecap,
    monthRecapLoading,
    monthCompleting,
    patternNote,
    setPatternNote,
    leverageNote,
    setLeverageNote,
    correctionNote,
    setCorrectionNote,
    monthTheme,
    setMonthTheme,
    sprintReview,
    sprintFacts,
    sprintCompleting,
    sprintReflection,
    setSprintReflection,
    nextSprintGoal,
    setNextSprintGoal,
    projectDecisions,
    setProjectDecisions,
    intentionFromMonth,
    planCarriedFromMonth,
    showSprintMode,
    showMonthlyMode,
    monthlyComplete,
    showWeeklyPlanning,
    stats,
    prevWeekScores,
    weekFacts,
    activeProjects,
    saveReflection,
    completeMonthly,
    completeSprint,
    completeReview,
    togglePowerListTask,
    closingMonthStart,
    planTargetWeekStart,
    currentWeekStart,
  };
}
