import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import type { Tables, Json } from '../../../../lib/database.types';
import { monthCarryToWeekPlan } from '../../../../lib/growth/monthCarry';
import { getSprintInfo } from '../../../../lib/growth/sprintUtils';
import { useHaptics } from '../../../../hooks/useHaptics';
import { usePersistentDraft } from '../../../../hooks/usePersistentDraft';
import { useWarsawDayChange } from '../../../../hooks/useWarsawDayChange';
import { calculateStats, calculateWeekFacts } from '../../directionHelpers';
import { fetchDirectionData } from './directionFetcher';
import { createDirectionActions } from './directionActions';
import { computeDirectionDateContext, directionDraftKeys } from './directionKeys';
import type { SprintProjectDecision } from '../../../../lib/goal/goalSpine';
import type { DirectionRawData } from './directionFetcher';
import { directionKeys } from '../../../../lib/queryKeys';
import type { MonthFacts } from '../../../../lib/growth/monthReview';
import type { SprintReview } from '../../../../lib/goal/goalSpine.types';
import type { SprintFacts } from '../../../../lib/growth/sprintReview';

type DailyWinRow = Tables<'daily_wins'>;
type CalendarEventRow = DirectionRawData['calData'] extends (infer T)[] | null ? T : never;
type WeeklyReviewRow = Tables<'weekly_reviews'>;
type Phase1Recap = { narrative: string; longterm_motif: string | null; question: string };
type MonthRecap = Phase1Recap;
type Phase2Recap = { narrative_check: string; deepening_questions?: string[]; block5_material?: { cialo: string; duch: string; konto: string } };
type PillarScores = { cialo: number | null; duch: number | null; konto: number | null };



export function useDirection(session: Session, _onOpenActionCenter?: () => void) {
  const haptics = useHaptics();
  const userId = session.user.id;

  // ── Derived date constants + draft keys (pure — see directionKeys.ts) ────
  const { currentWeekStart, isSunday, planWeekStart, planWeekEnd, planWeekLabel,
    closingWeekStart, planTargetWeekStart, closingMonthStart } = computeDirectionDateContext();

  const sprintInfo = useMemo(() => getSprintInfo(), []);
  const { reflKey, planKey, monthKey, sprintDraftKey } = directionDraftKeys(
    userId, { closingWeekStart, planTargetWeekStart, closingMonthStart }, sprintInfo);
  const sprintClosingWeek = sprintInfo.weekInSprint === 12;

  // ── Main data fetch (react-query) ──────────────────────────────────────
  const directionQuery = useQuery({
    queryKey: directionKeys.data(userId, currentWeekStart),
    queryFn: () => fetchDirectionData(userId, currentWeekStart, sprintClosingWeek),
    enabled: !!userId,
  });

  const raw = directionQuery.data;
  const loading = directionQuery.isLoading;

  // ── Core state (synced from query) ─────────────────────────────────────
  const [history, setHistory] = useState<DailyWinRow[]>([]);
  const [currentReview, setCurrentReview] = useState<WeeklyReviewRow | null>(null);
  const [allCalEvents, setAllCalEvents] = useState<CalendarEventRow[]>([]);
  const [prevWeekReview, setPrevWeekReview] = useState<WeeklyReviewRow | null>(null);
  const [weekDoneTasks, setWeekDoneTasks] = useState<{ title: string; status: string }[]>([]);
  const [weekOura, setWeekOura] = useState<{ total_sleep_hours: number | null; readiness_score: number | null }[]>([]);
  const [weekRuns, setWeekRuns] = useState<{ distance: number | null }[]>([]);
  const [weekNutrition, setWeekNutrition] = useState<{ calories: number | null }[]>([]);
  const [nutritionTarget, setNutritionTarget] = useState<number | null>(null);
  const [activeProjects, setActiveProjects] = useState<{ id: string; name: string }[]>([]);

  // ── Reflection / plan drafts ────────────────────────────────────────────
  const [proudOf, setProudOf]             = usePersistentDraft(reflKey('proudOf'), '');
  const [doDifferently, setDoDifferently] = usePersistentDraft(reflKey('doDifferently'), '');
  const [sabotage, setSabotage]           = usePersistentDraft(reflKey('sabotage'), '');
  const [obligation, setObligation]       = usePersistentDraft(reflKey('obligation'), '');
  const [weekHighlight, setWeekHighlight] = usePersistentDraft(reflKey('weekHighlight'), '');
  const [weekRegret, setWeekRegret]       = usePersistentDraft(reflKey('weekRegret'), '');
  const [newBelief, setNewBelief]         = usePersistentDraft(reflKey('newBelief'), '');
  const [weekIntention, setWeekIntention]   = usePersistentDraft(planKey('weekIntention'), '');
  const [weekCommitment, setWeekCommitment] = usePersistentDraft(planKey('weekCommitment'), '');
  const [weekGoalCialo, setWeekGoalCialo]   = usePersistentDraft(planKey('weekGoalCialo'), '');
  const [weekGoalDuch, setWeekGoalDuch]     = usePersistentDraft(planKey('weekGoalDuch'), '');
  const [weekGoalKonto, setWeekGoalKonto]   = usePersistentDraft(planKey('weekGoalKonto'), '');
  const [deepeningAnswers, setDeepeningAnswers] = usePersistentDraft<Record<string, string>>(reflKey('deepeningAnswers'), {});

  // ── AI recap state ──────────────────────────────────────────────────────
  const [pillarScores, setPillarScores]   = useState<PillarScores>({ cialo: null, duch: null, konto: null });
  const [phase1, setPhase1]               = useState<Phase1Recap | null>(null);
  const [phase1Loading, setPhase1Loading] = useState(false);
  const [phase2, setPhase2]               = useState<Phase2Recap | null>(null);
  const [phase2Loading, setPhase2Loading] = useState(false);
  const [savingReflection, setSavingReflection]   = useState(false);
  const [_reflectionPersisted, setReflectionPersisted] = useState(false);
  const [completing, setCompleting]       = useState(false);
  const [ritualClosed, setRitualClosed]   = useState(false);
  const [forceWeeklyReview, setForceWeeklyReview] = useState(false);

  // ── Monthly state ───────────────────────────────────────────────────────
  const [monthReview, setMonthReview]         = useState<Tables<'monthly_reviews'> | null>(null);
  const [monthFacts, setMonthFacts]           = useState<MonthFacts | null>(null);
  const [monthRecap, setMonthRecap]           = useState<MonthRecap | null>(null);
  const [monthRecapLoading, setMonthRecapLoading] = useState(false);
  const [monthCompleting, setMonthCompleting] = useState(false);
  const [patternNote, setPatternNote]     = usePersistentDraft(monthKey('pattern'), '');
  const [leverageNote, setLeverageNote]   = usePersistentDraft(monthKey('leverage'), '');
  const [correctionNote, setCorrectionNote] = usePersistentDraft(monthKey('correction'), '');
  const [monthTheme, setMonthTheme]       = usePersistentDraft(monthKey('theme'), '');

  // ── Sprint state ────────────────────────────────────────────────────────
  const [sprintReview, setSprintReview]   = useState<SprintReview | null>(null);
  const [sprintFacts, setSprintFacts]     = useState<SprintFacts | null>(null);
  const [sprintCompleting, setSprintCompleting] = useState(false);
  const [sprintReflection, setSprintReflection] = usePersistentDraft(sprintDraftKey('reflection'), '');
  const [nextSprintGoal, setNextSprintGoal]     = usePersistentDraft(sprintDraftKey('nextGoal'), '');
  const [projectDecisions, setProjectDecisions] = usePersistentDraft<Record<string, SprintProjectDecision>>(sprintDraftKey('projects'), {});
  const [intentionFromMonth, setIntentionFromMonth] = useState(false);
  const [carryMonthTheme, setCarryMonthTheme]       = useState<string | null>(null);
  const [planCarriedFromMonth, setPlanCarriedFromMonth] = useState(false);

  // ── Sync query result → local state (runs once per fresh data) ──────────
  const syncedVersionRef = useRef(0);
  useEffect(() => {
    if (!raw) return;
    const v = directionQuery.dataUpdatedAt;
    if (v === syncedVersionRef.current) return;
    syncedVersionRef.current = v;

    // Defer state updates to avoid synchronous setState in effect
    queueMicrotask(() => {
      setHistory(raw.historyData ?? []);
      setAllCalEvents(raw.calData ?? []);
      setPrevWeekReview(raw.prevReviewData ?? null);
      setWeekOura(raw.ouraData ?? []);
      setWeekRuns(raw.runsData ?? []);
      setWeekNutrition(raw.nutritionData ?? []);
      setNutritionTarget((raw.nutritionTargetData as { target_kcal?: number | null } | null)?.target_kcal ?? null);
      setWeekDoneTasks((raw.doneTasksData ?? []).map((t: { title: string; status: string }) => ({ title: t.title, status: t.status })));
      setActiveProjects((raw.projectsData ?? []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));

      if (raw.monthReviewData) {
        setMonthReview(raw.monthReviewData);
        if (raw.monthReviewData.pattern_note) setPatternNote(raw.monthReviewData.pattern_note);
        if (raw.monthReviewData.leverage_note) setLeverageNote(raw.monthReviewData.leverage_note);
        if (raw.monthReviewData.correction_note) setCorrectionNote(raw.monthReviewData.correction_note);
        if (raw.monthReviewData.month_theme) setMonthTheme(raw.monthReviewData.month_theme);
        const mRecap = raw.monthReviewData.ai_recap as { phase1?: MonthRecap } | null;
        if (mRecap?.phase1) setMonthRecap(mRecap.phase1);
      } else { setMonthReview(null); setMonthRecap(null); }
      setMonthFacts(raw.monthFactsData);

      if (raw.sprintReviewData) {
        setSprintReview(raw.sprintReviewData);
        if (raw.sprintReviewData.reflection) setSprintReflection(raw.sprintReviewData.reflection);
      } else setSprintReview(null);
      setSprintFacts(raw.sprintFactsData);
      setCarryMonthTheme(raw.activeThemeReviewData?.month_theme?.trim() || null);

      const reviewData = raw.reviewData;
      if (reviewData) {
        setCurrentReview(reviewData);
        if (reviewData.review_completed_at) setRitualClosed(false);
        if (reviewData.proud_of) setProudOf(reviewData.proud_of);
        if (reviewData.do_differently) setDoDifferently(reviewData.do_differently);
        if (reviewData.sabotage) setSabotage(reviewData.sabotage);
        if (reviewData.obligation) setObligation(reviewData.obligation);
        if (reviewData.week_highlight) setWeekHighlight(reviewData.week_highlight);
        if (reviewData.week_regret) setWeekRegret(reviewData.week_regret);
        if (reviewData.new_belief) setNewBelief(reviewData.new_belief);
        if (reviewData.pillar_scores && typeof reviewData.pillar_scores === 'object' && !Array.isArray(reviewData.pillar_scores)) {
          setPillarScores(prev => ({ ...prev, ...(reviewData.pillar_scores as Partial<PillarScores>) }));
        }
        const recap = reviewData.ai_recap as { phase1?: Phase1Recap; phase2?: Phase2Recap } | null;
        if (recap?.phase1) setPhase1(recap.phase1);
        if (recap?.phase2 && Array.isArray(recap.phase2.deepening_questions)) setPhase2(recap.phase2);
        if (reviewData.deepening_answers && typeof reviewData.deepening_answers === 'object' && !Array.isArray(reviewData.deepening_answers)) {
          setDeepeningAnswers(reviewData.deepening_answers as Record<string, string>);
        }
        const hasReflection = Boolean(reviewData.proud_of?.trim()) || Boolean(reviewData.obligation?.trim()) || Boolean(reviewData.do_differently?.trim()) || Boolean(reviewData.sabotage?.trim());
        if (hasReflection) setReflectionPersisted(true);
      }

      const planSource: WeeklyReviewRow | null = raw.planReviewData ?? (isSunday ? null : reviewData);
      if (planSource) {
        if (planSource.week_intention) setWeekIntention(planSource.week_intention);
        if (planSource.week_commitment) setWeekCommitment(planSource.week_commitment);
        if (planSource.week_goal_cialo) setWeekGoalCialo(planSource.week_goal_cialo);
        if (planSource.week_goal_duch) setWeekGoalDuch(planSource.week_goal_duch);
        if (planSource.week_goal_konto) setWeekGoalKonto(planSource.week_goal_konto);
      }
    });
  }, [raw, directionQuery.dataUpdatedAt, isSunday,
    setPatternNote, setLeverageNote, setCorrectionNote, setMonthTheme,
    setSprintReflection, setProudOf, setDoDifferently, setSabotage,
    setObligation, setWeekHighlight, setWeekRegret, setNewBelief,
    setDeepeningAnswers, setWeekIntention, setWeekCommitment,
    setWeekGoalCialo, setWeekGoalDuch, setWeekGoalKonto]);

  // ── Refetch helpers ─────────────────────────────────────────────────────
  const fetchData = useCallback(async (_opts?: { silent?: boolean }) => {
    await directionQuery.refetch();
  }, [directionQuery]);

  useWarsawDayChange(() => { void directionQuery.refetch(); });

  // ── Month carry ─────────────────────────────────────────────────────────
  const applyMonthCarry = useCallback(
    (review: { month_theme?: string | null; correction_note?: string | null; leverage_note?: string | null } | null, facts: MonthFacts | Json | null) => {
      const carry = monthCarryToWeekPlan(review, facts as MonthFacts | null);
      let applied = false;
      if (carry.intention && !weekIntention.trim()) { setWeekIntention(carry.intention); setIntentionFromMonth(true); applied = true; }
      if (carry.commitment && !weekCommitment.trim()) { setWeekCommitment(carry.commitment); applied = true; }
      for (const pillar of ['cialo', 'duch', 'konto'] as const) {
        const val = carry[pillar];
        const setter = pillar === 'cialo' ? setWeekGoalCialo : pillar === 'duch' ? setWeekGoalDuch : setWeekGoalKonto;
        const current = pillar === 'cialo' ? weekGoalCialo : pillar === 'duch' ? weekGoalDuch : weekGoalKonto;
        if (val && !current.trim()) { setter(val); applied = true; }
      }
      if (applied) setPlanCarriedFromMonth(true);
    },
    [weekIntention, weekCommitment, weekGoalCialo, weekGoalDuch, weekGoalKonto, setWeekIntention, setWeekCommitment, setWeekGoalCialo, setWeekGoalDuch, setWeekGoalKonto],
  );

  // ── Derived flags ───────────────────────────────────────────────────────
  const planSaved = ritualClosed || !!currentReview?.review_completed_at;
  const showPlanningMode = isSunday && !planSaved;
  const sprintCloseDue  = sprintClosingWeek && !sprintReview?.completed_at;
  const showSprintMode  = sprintCloseDue;
  const monthlyDue      = Boolean(closingMonthStart && !monthReview?.completed_at);
  const monthlyComplete = Boolean(monthReview?.completed_at);
  const showMonthlyMode = monthlyDue && !showSprintMode;
  const showWeeklyPlanning = (showPlanningMode && (!showMonthlyMode || monthlyComplete) && !showSprintMode) || forceWeeklyReview;

  useEffect(() => {
    if (!showWeeklyPlanning || planCarriedFromMonth) return;
    const review = monthReview ?? (carryMonthTheme ? { month_theme: carryMonthTheme } : null);
    void (async () => { applyMonthCarry(review, monthFacts); })();
  }, [showWeeklyPlanning, planCarriedFromMonth, monthReview, monthFacts, carryMonthTheme, applyMonthCarry]);

  // ── Actions (bound to current state) ────────────────────────────────────
  const actions = createDirectionActions({
    userId, session, haptics,
    closingWeekStart, closingMonthStart, isSunday, planTargetWeekStart,
    setHistory,
    setCurrentReview, setReflectionPersisted,
    setPhase2, setPhase2Loading, setSavingReflection,
    setMonthReview, setMonthCompleting,
    setSprintReview, setSprintCompleting,
    setCompleting, setRitualClosed, setForceWeeklyReview,
    applyMonthCarry, fetchData,
  });

  // ── AI recap auto-trigger effects ───────────────────────────────────────
  useEffect(() => {
    if (!showWeeklyPlanning || loading || phase1 || phase1Loading) return;
    void (() => {
      setPhase1Loading(true);
      actions.callWeekRecap('before')
        .then(data => setPhase1(data.phase1))
        .catch(err => console.error('Layer 1 (before) failed:', err))
        .finally(() => setPhase1Loading(false));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- actions is stable; effect should only trigger on condition changes
  }, [showWeeklyPlanning, loading, phase1, phase1Loading]);

  useEffect(() => {
    if (!showMonthlyMode || loading || monthRecap || monthRecapLoading) return;
    void (() => {
      setMonthRecapLoading(true);
      actions.callMonthRecap()
        .then(data => { if (data?.phase1) setMonthRecap(data.phase1); })
        .catch(err => console.error('Month recap failed:', err))
        .finally(() => setMonthRecapLoading(false));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- actions is stable; effect should only trigger on condition changes
  }, [showMonthlyMode, loading, monthRecap, monthRecapLoading]);

  // ── Derived memos ───────────────────────────────────────────────────────
  const stats = useMemo(() => calculateStats(history), [history]);
  const prevWeekScores = useMemo(() => {
    const ps = prevWeekReview?.pillar_scores;
    if (!ps || typeof ps !== 'object' || Array.isArray(ps)) return null;
    return ps as { cialo?: number; duch?: number; konto?: number };
  }, [prevWeekReview]);
  const weekFacts = useMemo(() => calculateWeekFacts(weekDoneTasks, weekOura, weekRuns, weekNutrition, nutritionTarget), [weekDoneTasks, weekOura, weekRuns, weekNutrition, nutritionTarget]);

  return {
    loading, history, currentReview, allCalEvents,
    planWeekLabel, planWeekStart, planWeekEnd,
    proudOf, setProudOf, doDifferently, setDoDifferently,
    sabotage, setSabotage, obligation, setObligation,
    weekHighlight, setWeekHighlight, weekRegret, setWeekRegret,
    newBelief, setNewBelief,
    weekIntention, setWeekIntention, weekCommitment, setWeekCommitment,
    weekGoalCialo, setWeekGoalCialo, weekGoalDuch, setWeekGoalDuch, weekGoalKonto, setWeekGoalKonto,
    pillarScores, setPillarScores, prevWeekReview,
    phase1, phase1Loading, phase2, phase2Loading,
    savingReflection, deepeningAnswers, setDeepeningAnswers,
    completing, ritualClosed, setForceWeeklyReview,
    monthReview, monthFacts, monthRecap, monthRecapLoading, monthCompleting,
    patternNote, setPatternNote, leverageNote, setLeverageNote,
    correctionNote, setCorrectionNote, monthTheme, setMonthTheme,
    sprintReview, sprintFacts, sprintCompleting,
    sprintReflection, setSprintReflection,
    nextSprintGoal, setNextSprintGoal,
    projectDecisions, setProjectDecisions,
    intentionFromMonth, planCarriedFromMonth,
    showSprintMode, showMonthlyMode, monthlyComplete, showWeeklyPlanning,
    stats, prevWeekScores, weekFacts, activeProjects,
    closingMonthStart, planTargetWeekStart, currentWeekStart,
    // actions — zero-arg API matching Direction.tsx expectations
    saveReflection: () => actions.saveReflection({
      proudOf, doDifferently, sabotage, obligation,
      weekHighlight, weekRegret, newBelief, pillarScores,
    }),
    completeMonthly: () => actions.completeMonthly({
      patternNote, leverageNote, correctionNote, monthTheme, monthRecap, monthFacts,
    }),
    completeSprint: () => actions.completeSprint({
      sprintReflection, nextSprintGoal, projectDecisions,
    }),
    completeReview: () => actions.completeReview({
      deepeningAnswers, weekIntention, weekCommitment,
      weekGoalCialo, weekGoalDuch, weekGoalKonto,
    }),
    togglePowerListTask: actions.togglePowerListTask,
  };
}
