import { formatWarsawDate, getTodayWarsaw, nowWarsaw, warsawDayBoundsISO } from '../../lib/date';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Calendar } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  addDays,
  differenceInDays,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfWeek,
  subDays,
} from 'date-fns';
import { pl } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import type { Tables, TablesUpdate } from '../../lib/database.types';
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
  type SprintReview,
} from '../../lib/goalSpine';
import type { MonthFacts } from '../../lib/monthReview';
import { monthCarryToWeekPlan } from '../../lib/monthCarry';
import { monthThemeSourceStart } from '../../lib/monthReview';
import type { SprintFacts, SprintProjectDecision } from '../../lib/sprintReview';
import { getSprintInfo } from '../desktop/desktopUtils';
import DirectionMonthlyMode from './DirectionMonthlyMode';
import DirectionSprintMode from './DirectionSprintMode';
import DirectionPlanningMode from './DirectionPlanningMode';
import DirectionRadarMode from './DirectionRadarMode';
import { useHaptics } from '../../hooks/useHaptics';
import { usePersistentDraft } from '../../hooks/usePersistentDraft';
import { useWarsawDayChange } from '../../hooks/useWarsawDayChange';
import WeekHub from './WeekHub';

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

const todayWarsaw = () => getTodayWarsaw();
const APP_LAUNCH_DATE = '2026-05-03';

function SectionTitle({ icon: Icon, title, detail, action }: { icon: LucideIcon; title: string; detail?: string; action?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4">
      <div>
        <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.22em] text-text-muted">
          <Icon size={12} /> {title}
        </p>
        {detail && <p className="mt-1 text-[11px] font-semibold leading-relaxed text-text-secondary">{detail}</p>}
      </div>
      {action}
    </header>
  );
}

export default function Direction({
  session,
  onOpenActionCenter,
}: {
  session: Session;
  onOpenActionCenter?: () => void;
}) {
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

  // Persisted — multi-paragraph weekly review answers, filled in over a session;
  // a backgrounded-tab kill (Android reclaiming memory) must not erase them before submit.
  // Reflection drafts keyed to closing week; plan drafts keyed to target plan week.
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
  const [monthFacts, setMonthFacts] = useState<MonthFacts | null>(null);
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
  const [sprintReview, setSprintReview] = useState<SprintReview | null>(null);
  const [sprintFacts, setSprintFacts] = useState<SprintFacts | null>(null);
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

  const planCalEvents = allCalEvents.filter((e) => {
    if (!e.start_time) return false;
    const eDay = formatWarsawDate(e.start_time);
    return eDay >= format(planWeekStart, 'yyyy-MM-dd') && eDay <= format(planWeekEnd, 'yyyy-MM-dd');
  });

  const [activeProjects, setActiveProjects] = useState<{ id: string; name: string }[]>([]);

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const today = todayWarsaw();
    const userId = session.user.id;
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
        // Only restore phase2 from DB if it's the new format (has deepening_questions)
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
      if (!opts?.silent) setLoading(false);
    }
  }, [session, currentWeekStart, sprintClosingWeek]);

  const applyMonthCarry = useCallback(
    (review: { month_theme?: string | null; correction_note?: string | null; leverage_note?: string | null } | null, facts: MonthFacts | null) => {
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
    const t = setTimeout(() => { if (session?.user?.id) void fetchData(); }, 0);
    return () => clearTimeout(t);
  }, [session?.user?.id, fetchData]);

  useWarsawDayChange(() => {
    if (session?.user?.id) void fetchData({ silent: true });
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

  // Warstwa 1 tygodnia — po monthly (jeśli due)
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

  const stats = useMemo(() => {
    if (!history.length) return { streak: 0, weeklyP: 0, monthlyWin: false, weeks: [] };
    let streak = 0;
    const sorted = [...history].sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
    const today = todayWarsaw();
    const yesterday = format(subDays(nowWarsaw(), 1), 'yyyy-MM-dd');
    if (sorted[0]?.date === today || sorted[0]?.date === yesterday) {
      for (const day of sorted) {
        if (day.result === 'Z') streak++;
        else if (day.date !== today) break;
      }
    }
    const weeks = [];
    for (let i = 0; i < 4; i++) {
      const start = startOfWeek(subDays(nowWarsaw(), i * 7), { weekStartsOn: 1 });
      const end = endOfWeek(start, { weekStartsOn: 1 });
      const weekDays = history.filter((d) => d.date && parseISO(d.date) >= start && parseISO(d.date) <= end);
      const now = startOfDay(nowWarsaw());
      const expectedPastDays = isWithinInterval(now, { start, end }) ? differenceInDays(now, start) : 7;
      const explicitP = weekDays.filter((d) => d.result === 'P').length;
      let missing = 0;
      for (let day = 0; day < expectedPastDays; day++) {
        const checkDate = format(subDays(now, expectedPastDays - day), 'yyyy-MM-dd');
        if (!weekDays.some((e) => e.date === checkDate) && checkDate >= APP_LAUNCH_DATE) missing++;
      }
      const pCount = explicitP + missing;
      weeks.push({ isWeekWin: pCount <= 2 && (expectedPastDays > 0 || weekDays.length > 0), pCount, start });
    }
    return { streak, weeklyP: weeks[0]?.pCount || 0, monthlyWin: weeks.filter((w) => w.isWeekWin).length >= 3, weeks };
  }, [history]);

  async function togglePowerListTask(dayWinStale: DailyWinRow, index: number) {
    haptics.light();
    const { data: fresh } = await supabase.from('daily_wins').select('*').eq('id', dayWinStale.id).single();
    const dayWin = fresh ?? dayWinStale;
    const dayWinAny = dayWin as any;
    const field = `done_${index + 1}`;
    const timeField = `completed_at_${index + 1}`;
    const newValue = !dayWinAny[field];
    const timestamp = newValue ? nowWarsaw().toISOString() : null;

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
      const isPastDeadline = nowWarsaw().getHours() >= 23;
      if (isPastDeadline && !allDone) updates.result = 'P';
    }

    try {
      const data = await updateDailyWin(session.user.id, dayWin.id, updates);
      setHistory((prev) => prev.map((d) => d.id === data.id ? data : d));
      if (allDone) haptics.success();
    } catch (e) {
      console.error('[Direction] togglePowerListTask failed', e);
    }
  }

  const reflectionSaved = reflectionPersisted;

  const prevWeekScores = useMemo(() => {
    const ps = prevWeekReview?.pillar_scores;
    if (!ps || typeof ps !== 'object' || Array.isArray(ps)) return null;
    return ps as { cialo?: number; duch?: number; konto?: number };
  }, [prevWeekReview]);

  const weekFacts = useMemo(() => {
    const done = weekDoneTasks.filter((t) => t.status === 'done').map((t) => t.title);
    const dropped = weekDoneTasks.filter((t) => t.status === 'dropped').map((t) => t.title);
    const sleepArr = weekOura.map((o) => o.total_sleep_hours).filter((v): v is number => v != null);
    const readArr = weekOura.map((o) => o.readiness_score).filter((v): v is number => v != null);
    const kcalArr = weekNutrition.map((n) => n.calories).filter((v): v is number => v != null);
    const totalKm = weekRuns.reduce((s, r) => s + (r.distance || 0), 0) / 1000;
    return {
      doneCount: done.length,
      totalCount: done.length + dropped.length,
      doneTasks: done.slice(0, 10),
      droppedTasks: dropped.slice(0, 5),
      sleepHrs: sleepArr.length ? sleepArr.reduce((a, b) => a + b, 0) / sleepArr.length : null,
      readiness: readArr.length ? readArr.reduce((a, b) => a + b, 0) / readArr.length : null,
      totalKm: totalKm > 0 ? totalKm : null,
      avgKcal: kcalArr.length ? kcalArr.reduce((a, b) => a + b, 0) / kcalArr.length : null,
      targetKcal: nutritionTarget,
    };
  }, [weekDoneTasks, weekOura, weekRuns, weekNutrition, nutritionTarget]);

  async function saveReflection() {
    if (savingReflection) return;
    setSavingReflection(true);
    const data = await saveWeeklyReviewReflection(session.user.id, closingWeekStart, {
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
        session.user.id,
        closingMonthStart,
        {
          pattern_note: patternNote || null,
          leverage_note: leverageNote || null,
          correction_note: correctionNote || null,
          month_theme: monthTheme || null,
          ai_recap: monthRecap ? { phase1: monthRecap } : null,
          ritual_stats: monthFacts ? (monthFacts as unknown as Tables<'monthly_reviews'>['ritual_stats']) : null,
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
      await completeSprintClose(session.user.id, {
        reflection: sprintReflection || null,
        nextSprintGoal: nextSprintGoal.trim(),
        projectDecisions,
      });
      setSprintReview(await fetchSprintReview(session.user.id));
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
        session.user.id,
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

  if (loading) {
    return <div className="p-8 text-center text-text-muted uppercase font-black animate-pulse tracking-widest">Wczytywanie Kierunku...</div>;
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto animate-fadeIn">

      {/* ── Tydzień ── */}
      <section className="space-y-3">
        <SectionTitle
          icon={Calendar}
          title={
            showSprintMode
              ? 'Zamknięcie sprintu'
              : showMonthlyMode && !monthlyComplete
                ? 'Przegląd miesiąca'
                : showWeeklyPlanning
                  ? 'Plan następnego tygodnia'
                  : 'Radar tygodnia'
          }
          detail={
            showSprintMode && sprintFacts
              ? `${sprintFacts.sprintLabel} · 12/12`
              : showMonthlyMode && !monthlyComplete && monthFacts
                ? monthFacts.monthLabel
                : planWeekLabel
          }
        />

        {showSprintMode && !sprintFacts && (
          <div className="py-6 text-center text-sm text-text-muted animate-pulse">
            Zbieram dane sprintu…
          </div>
        )}

        {showSprintMode && sprintFacts && (
          <DirectionSprintMode
            sprintFacts={sprintFacts}
            reflection={sprintReflection}
            setReflection={setSprintReflection}
            nextSprintGoal={nextSprintGoal}
            setNextSprintGoal={setNextSprintGoal}
            projectDecisions={projectDecisions}
            setProjectDecisions={setProjectDecisions}
            onComplete={completeSprint}
            completing={sprintCompleting}
          />
        )}

        {showMonthlyMode && closingMonthStart && !monthFacts && (
          <div className="py-6 text-center text-sm text-text-muted animate-pulse">
            Zbieram dane miesiąca…
          </div>
        )}

        {showMonthlyMode && closingMonthStart && monthFacts && (
          <DirectionMonthlyMode
            session={session}
            monthStart={closingMonthStart}
            monthFacts={monthFacts}
            recap={monthRecap}
            recapLoading={monthRecapLoading}
            patternNote={patternNote}
            setPatternNote={setPatternNote}
            leverageNote={leverageNote}
            setLeverageNote={setLeverageNote}
            correctionNote={correctionNote}
            setCorrectionNote={setCorrectionNote}
            monthTheme={monthTheme}
            setMonthTheme={setMonthTheme}
            onComplete={completeMonthly}
            completing={monthCompleting}
          />
        )}

        {showWeeklyPlanning ? (
          <DirectionPlanningMode
            session={session}
            weekStart={closingWeekStart}
            planWeekStart={planTargetWeekStart}
            weekFacts={weekFacts}
            phase1={phase1}
            phase1Loading={phase1Loading}
            phase2={phase2}
            phase2Loading={phase2Loading}
            prevWeekScores={prevWeekScores}
            pillarScores={pillarScores}
            setPillarScores={setPillarScores}
            obligation={obligation}
            setObligation={setObligation}
            doDifferently={doDifferently}
            setDoDifferently={setDoDifferently}
            proudOf={proudOf}
            setProudOf={setProudOf}
            sabotage={sabotage}
            setSabotage={setSabotage}
            weekHighlight={weekHighlight}
            setWeekHighlight={setWeekHighlight}
            weekRegret={weekRegret}
            setWeekRegret={setWeekRegret}
            newBelief={newBelief}
            setNewBelief={setNewBelief}
            deepeningAnswers={deepeningAnswers}
            setDeepeningAnswers={setDeepeningAnswers}
            weekIntention={weekIntention}
            setWeekIntention={setWeekIntention}
            intentionFromMonth={intentionFromMonth}
            planCarriedFromMonth={planCarriedFromMonth}
            weekCommitment={weekCommitment}
            setWeekCommitment={setWeekCommitment}
            weekGoalCialo={weekGoalCialo}
            setWeekGoalCialo={setWeekGoalCialo}
            weekGoalDuch={weekGoalDuch}
            setWeekGoalDuch={setWeekGoalDuch}
            weekGoalKonto={weekGoalKonto}
            setWeekGoalKonto={setWeekGoalKonto}
            saveReflection={saveReflection}
            savingReflection={savingReflection}
            onComplete={completeReview}
            completing={completing}
            reflectionSaved={reflectionSaved}
            activeProjects={activeProjects}
          />
        ) : (!showMonthlyMode || monthlyComplete) ? (
          <div className="space-y-6">
            <WeekHub
              session={session}
              onOpenActionCenter={onOpenActionCenter}
              onStartWeeklyReview={() => setForceWeeklyReview(true)}
            />
            <div className="rounded-2xl border border-border-custom bg-surface/30">
              <p className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-text-muted">
                Radar szczegóły
              </p>
              <div className="px-1 pb-4 pt-1">
                <DirectionRadarMode
                  stats={stats}
                  history={history}
                  prevWeekReview={prevWeekReview}
                  planWeekStart={planWeekStart}
                  allCalEvents={allCalEvents}
                  togglePowerListTask={togglePowerListTask}
                  currentReview={currentReview}

                />
              </div>
            </div>
          </div>
        ) : null}
      </section>

    </div>
  );
}
