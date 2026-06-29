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
import DirectionPlanningMode from './DirectionPlanningMode';
import DirectionRadarMode from './DirectionRadarMode';
import { useHaptics } from '../../hooks/useHaptics';
import { usePersistentDraft } from '../../hooks/usePersistentDraft';
import { useLifeGoals } from '../../hooks/useLifeGoals';
import WeekHub from './WeekHub';

type DailyWinRow = Tables<'daily_wins'>;
type WeeklyReviewRow = Tables<'weekly_reviews'>;
type Phase1Recap = { narrative: string; longterm_motif: string | null; question: string };
type Phase2Recap = {
  narrative_check: string;
  deepening_questions?: string[];
  block5_material?: { cialo: string; duch: string; konto: string };
};
type PillarScores = { cialo: number | null; duch: number | null; konto: number | null };
type CalendarRow = Pick<Tables<'vanguard_calendar'>, 'summary' | 'start_time' | 'end_time'>;
type TodoItemRow = Pick<Tables<'todo_items'>, 'id' | 'title' | 'status' | 'priority' | 'ai_bucket' | 'due_date' | 'section_id'>;

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
  const [focusTasks, setFocusTasks] = useState<TodoItemRow[]>([]);
  const { displayRows: lifeGoalRows } = useLifeGoals(userId);

  const currentWeekStart = format(startOfWeek(new Date(todayWarsaw() + 'T12:00:00'), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  // Persisted — multi-paragraph weekly review answers, filled in over a session;
  // a backgrounded-tab kill (Android reclaiming memory) must not erase them before submit.
  // Keyed by week_start so a stale draft never bleeds into next week's blank review.
  const draftKey = (field: string) => `vanguard_review_draft_${field}_${userId}_${currentWeekStart}`;
  const [proudOf, setProudOf] = usePersistentDraft(draftKey('proudOf'), '');
  const [doDifferently, setDoDifferently] = usePersistentDraft(draftKey('doDifferently'), '');
  const [sabotage, setSabotage] = usePersistentDraft(draftKey('sabotage'), '');
  const [obligation, setObligation] = usePersistentDraft(draftKey('obligation'), '');
  const [weekHighlight, setWeekHighlight] = usePersistentDraft(draftKey('weekHighlight'), '');
  const [weekRegret, setWeekRegret] = usePersistentDraft(draftKey('weekRegret'), '');
  const [newBelief, setNewBelief] = usePersistentDraft(draftKey('newBelief'), '');
  const [weekIntention, setWeekIntention] = usePersistentDraft(draftKey('weekIntention'), '');
  const [weekCommitment, setWeekCommitment] = usePersistentDraft(draftKey('weekCommitment'), '');
  const [weekGoalCialo, setWeekGoalCialo] = usePersistentDraft(draftKey('weekGoalCialo'), '');
  const [weekGoalDuch, setWeekGoalDuch] = usePersistentDraft(draftKey('weekGoalDuch'), '');
  const [weekGoalKonto, setWeekGoalKonto] = usePersistentDraft(draftKey('weekGoalKonto'), '');
  const [pillarScores, setPillarScores] = useState<PillarScores>({ cialo: null, duch: null, konto: null });
  const [prevWeekReview, setPrevWeekReview] = useState<WeeklyReviewRow | null>(null);
  const [focusGoalMappings, setFocusGoalMappings] = useState<Record<string, string>>({});
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
  const [deepeningAnswers, setDeepeningAnswers] = usePersistentDraft<Record<string, string>>(draftKey('deepeningAnswers'), {});
  const [completing, setCompleting] = useState(false);


  const todayNoon = new Date(todayWarsaw() + 'T12:00:00');
  const isSunday = todayNoon.getDay() === 0;

  // Sunday → plan next week; otherwise → current week
  const planRef = isSunday ? addDays(todayNoon, 7) : todayNoon;
  const planWeekStart = startOfWeek(planRef, { weekStartsOn: 1 });
  const planWeekEnd = endOfWeek(planRef, { weekStartsOn: 1 });
  const planWeekLabel = `${format(planWeekStart, 'd MMM', { locale: pl })} – ${format(planWeekEnd, 'd MMM', { locale: pl })}`;

  const planSaved = !!currentReview?.review_completed_at;
  const showPlanningMode = isSunday && !planSaved;

  const planCalEvents = allCalEvents.filter((e) => {
    if (!e.start_time) return false;
    const eDay = formatWarsawDate(e.start_time);
    return eDay >= format(planWeekStart, 'yyyy-MM-dd') && eDay <= format(planWeekEnd, 'yyyy-MM-dd');
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const today = todayWarsaw();
    const userId = session.user.id;
    const now = new Date(today + 'T12:00:00');

    const calFrom = subDays(startOfWeek(now, { weekStartsOn: 1 }), 1).toISOString();
    const calTo = addDays(endOfWeek(addDays(now, 7), { weekStartsOn: 1 }), 1).toISOString();
    const prevWeekStart = format(subDays(startOfWeek(now, { weekStartsOn: 1 }), 7), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');

    try {
      const [
        ,
        { data: historyData },
        { data: reviewData },
        { data: calData },
        { data: prevReviewData },
        { data: ouraData },
        { data: runsData },
        { data: nutritionData },
        { data: nutritionTargetData },
        { data: doneTasksData },
      ] = await Promise.all([
        supabase.from('daily_wins').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
        supabase.from('daily_wins').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(60),
        supabase.from('weekly_reviews').select('*').eq('user_id', userId).eq('week_start', currentWeekStart).maybeSingle(),
        supabase.from('vanguard_calendar').select('summary, start_time, end_time').eq('user_id', userId).gte('start_time', calFrom).lt('start_time', calTo).order('start_time'),
        supabase.from('weekly_reviews').select('*').eq('user_id', userId).eq('week_start', prevWeekStart).maybeSingle(),
        supabase.from('oura_daily_summary').select('total_sleep_hours, readiness_score').eq('user_id', userId).gte('date', currentWeekStart).lte('date', weekEnd),
        supabase.from('strava_activities').select('distance').eq('user_id', userId).gte('start_date', warsawDayBoundsISO(currentWeekStart).fromISO).lte('start_date', warsawDayBoundsISO(weekEnd).toISO),
        supabase.from('daily_nutrition').select('calories').eq('user_id', userId).gte('date', currentWeekStart).lte('date', weekEnd),
        supabase.from('nutrition_targets').select('target_kcal').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('todo_items').select('title, status').eq('user_id', userId).in('status', ['done', 'dropped']).gte('updated_at', warsawDayBoundsISO(currentWeekStart).fromISO).lte('updated_at', warsawDayBoundsISO(weekEnd).toISO),
      ]);

      setHistory(historyData || []);
      setAllCalEvents(calData || []);
      setPrevWeekReview(prevReviewData || null);
      setWeekOura(ouraData || []);
      setWeekRuns(runsData || []);
      setWeekNutrition(nutritionData || []);
      setNutritionTarget((nutritionTargetData as any)?.target_kcal ?? null);
      setWeekDoneTasks((doneTasksData || []).map((t: any) => ({ title: t.title, status: t.status })));

      if (reviewData) {
        setCurrentReview(reviewData);
        if (reviewData.proud_of) setProudOf(reviewData.proud_of);
        if (reviewData.do_differently) setDoDifferently(reviewData.do_differently);
        if (reviewData.sabotage) setSabotage(reviewData.sabotage);
        if (reviewData.obligation) setObligation(reviewData.obligation);
        if ((reviewData as any).week_highlight) setWeekHighlight((reviewData as any).week_highlight);
        if ((reviewData as any).week_regret) setWeekRegret((reviewData as any).week_regret);
        if ((reviewData as any).new_belief) setNewBelief((reviewData as any).new_belief);
        if ((reviewData as any).week_intention) setWeekIntention((reviewData as any).week_intention);
        if ((reviewData as any).week_commitment) setWeekCommitment((reviewData as any).week_commitment);
        if ((reviewData as any).week_goal_cialo) setWeekGoalCialo((reviewData as any).week_goal_cialo);
        if ((reviewData as any).week_goal_duch) setWeekGoalDuch((reviewData as any).week_goal_duch);
        if ((reviewData as any).week_goal_konto) setWeekGoalKonto((reviewData as any).week_goal_konto);
        if (reviewData.pillar_scores && typeof reviewData.pillar_scores === 'object' && !Array.isArray(reviewData.pillar_scores)) {
          setPillarScores((prev) => ({ ...prev, ...(reviewData.pillar_scores as Partial<PillarScores>) }));
        }
        const recap = reviewData.ai_recap as { phase1?: Phase1Recap; phase2?: Phase2Recap } | null;
        if (recap?.phase1) setPhase1(recap.phase1);
        // Only restore phase2 from DB if it's the new format (has deepening_questions)
        if (recap?.phase2 && Array.isArray(recap.phase2.deepening_questions)) setPhase2(recap.phase2);
        if (reviewData.focus_goal_mappings && typeof reviewData.focus_goal_mappings === 'object' && !Array.isArray(reviewData.focus_goal_mappings)) {
          setFocusGoalMappings(reviewData.focus_goal_mappings as Record<string, string>);
        }
        if (reviewData.deepening_answers && typeof reviewData.deepening_answers === 'object' && !Array.isArray(reviewData.deepening_answers)) {
          setDeepeningAnswers(reviewData.deepening_answers as Record<string, string>);
        }
      }

      if (reviewData?.focus_task_ids && reviewData.focus_task_ids.length > 0) {
        const { data: ft } = await supabase.from('todo_items').select('*').in('id', reviewData.focus_task_ids).eq('user_id', userId);
        setFocusTasks(
          reviewData.focus_task_ids.map((id) => (ft || []).find((t) => t.id === id)).filter(Boolean) as any[]
        );
      }

      const pastUnfinished = historyData?.filter((d) => d.date && d.date < today && d.result === null) || [];
      if (pastUnfinished.length > 0) {
        const { error } = await supabase.from('daily_wins').update({ result: 'P' }).in('id', pastUnfinished.map((d) => d.id));
        if (!error) {
          const { data: updated } = await supabase.from('daily_wins').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(60);
          setHistory(updated || []);
        } else {
          console.error('Failed to mark past unfinished days as P:', error);
        }
      }
    } catch (err) {
      console.error('Direction fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [session, currentWeekStart]);

  useEffect(() => {
    const t = setTimeout(() => { if (session?.user?.id) fetchData(); }, 0);
    return () => clearTimeout(t);
  }, [session?.user?.id, fetchData]);

  const callWeekRecap = useCallback(async (phase: 'before' | 'after') => {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vanguard-week-recap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ weekStart: currentWeekStart, phase }),
      signal: AbortSignal.timeout(45000),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Błąd generowania przeglądu tygodnia');
    return data;
  }, [session, currentWeekStart]);

  // Warstwa 1 jest automatyczna — odpala się raz, gdy wchodzimy w niedzielny rytuał
  // i jeszcze nie ma wygenerowanego wzorca dla tego tygodnia.
  useEffect(() => {
    if (!showPlanningMode || loading || phase1 || phase1Loading) return;
    setPhase1Loading(true);
    callWeekRecap('before')
      .then((data) => setPhase1(data.phase1))
      .catch((err) => console.error('Layer 1 (before) failed:', err))
      .finally(() => setPhase1Loading(false));
  }, [showPlanningMode, loading, phase1, phase1Loading, callWeekRecap]);

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

    const { data, error } = await supabase
      .from('daily_wins')
      .update(updates)
      .eq('id', dayWin.id)
      .select()
      .single();

    if (!error && data) {
      setHistory((prev) => prev.map((d) => d.id === data.id ? data : d));
      if (allDone) haptics.success();
    }
  }

  const reflectionSaved = phase2Loading || (phase2 !== null && Array.isArray(phase2.deepening_questions));

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
    const { data } = await supabase
      .from('weekly_reviews')
      .upsert(
        {
          user_id: session.user.id,
          week_start: currentWeekStart,
          proud_of: proudOf || null,
          do_differently: doDifferently || null,
          sabotage: sabotage || null,
          obligation: obligation || null,
          week_highlight: weekHighlight || null,
          week_regret: weekRegret || null,
          new_belief: newBelief || null,
          pillar_scores: pillarScores,
          // Surfaced next week as "Lekcja z poprzedniego tygodnia" in the radar
          // view — "where did I take the easy way out" is the most direct
          // forward-looking lesson of the three reflection prompts.
          bottleneck: doDifferently || null,
        } as any,
        { onConflict: 'user_id,week_start' }
      )
      .select()
      .maybeSingle();
    if (data) setCurrentReview(data);
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

  async function completeReview() {
    if (completing) return;
    setCompleting(true);
    const { data } = await supabase
      .from('weekly_reviews')
      .upsert(
        {
          user_id: session.user.id,
          week_start: currentWeekStart,
          deepening_answers: Object.keys(deepeningAnswers).length > 0 ? deepeningAnswers : null,
          week_intention: weekIntention || null,
          week_commitment: weekCommitment || null,
          week_goal_cialo: weekGoalCialo || null,
          week_goal_duch: weekGoalDuch || null,
          week_goal_konto: weekGoalKonto || null,
          review_completed_at: new Date().toISOString(),
        } as any,
        { onConflict: 'user_id,week_start' }
      )
      .select()
      .maybeSingle();
    if (data) setCurrentReview(data);
    setCompleting(false);
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
          title={showPlanningMode ? 'Plan następnego tygodnia' : 'Radar tygodnia'}
          detail={planWeekLabel}
        />

        {showPlanningMode ? (
          <DirectionPlanningMode
            session={session}
            weekStart={currentWeekStart}
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
          />
        ) : (
          <div className="space-y-6">
            <WeekHub session={session} onOpenActionCenter={onOpenActionCenter} />
            <details className="group rounded-2xl border border-border-custom bg-surface/30 open:bg-surface/50">
              <summary className="cursor-pointer list-none px-4 py-3 text-[11px] font-black uppercase tracking-widest text-text-muted">
                Radar szczegóły
              </summary>
              <div className="px-1 pb-4 pt-1">
                <DirectionRadarMode
                  stats={stats}
                  history={history}
                  prevWeekReview={prevWeekReview}
                  planWeekStart={planWeekStart}
                  allCalEvents={allCalEvents}
                  togglePowerListTask={togglePowerListTask}
                  focusTasks={focusTasks}
                  focusGoalMappings={focusGoalMappings}
                  currentReview={currentReview}
                  lifeGoalRows={lifeGoalRows}
                />
              </div>
            </details>
          </div>
        )}
      </section>

    </div>
  );
}
