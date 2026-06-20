import { formatWarsawDate, getTodayWarsaw } from '../../lib/date';
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

type DailyWinRow = Tables<'daily_wins'>;
type HabitRow = Tables<'habits'>;
type HabitLogRow = Tables<'habit_logs'>;
type WeeklyReviewRow = Tables<'weekly_reviews'>;
type CalendarRow = Pick<Tables<'vanguard_calendar'>, 'summary' | 'start_time' | 'end_time'>;
type TodoItemRow = Pick<Tables<'todo_items'>, 'id' | 'title' | 'status' | 'priority' | 'ai_bucket' | 'due_date' | 'section_id'>;
type LifeGoalRow = Pick<Tables<'life_goals'>, 'goal_cialo' | 'date_cialo' | 'goal_duch' | 'date_duch' | 'goal_konto' | 'date_konto'>;
type TodoSectionRow = Pick<Tables<'todo_sections'>, 'id' | 'name' | 'project_id'>;

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

export default function Direction({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<DailyWinRow[]>([]);
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLogRow[]>([]);

  const [currentReview, setCurrentReview] = useState<WeeklyReviewRow | null>(null);
  const [allCalEvents, setAllCalEvents] = useState<CalendarRow[]>([]);
  const [weekTodos, setWeekTodos] = useState<TodoItemRow[]>([]);
  const [focusTasks, setFocusTasks] = useState<TodoItemRow[]>([]);
  const [weekGoals, setWeekGoals] = useState<LifeGoalRow | null>(null);

  const [todoSections, setTodoSections] = useState<TodoSectionRow[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [proudOf, setProudOf] = useState('');
  const [bottleneck, setBottleneck] = useState('');
  const [prevWeekReview, setPrevWeekReview] = useState<WeeklyReviewRow | null>(null);
  const [focusGoalMappings, setFocusGoalMappings] = useState<Record<string, string>>({});

  const [weekSentiment, setWeekSentiment] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [quickTaskInput, setQuickTaskInput] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  const [chainProjects, setChainProjects] = useState<any[]>([]);
  const [chainDreams, setChainDreams] = useState<any[]>([]);


  const nowWarsaw = new Date(todayWarsaw() + 'T12:00:00');
  const isSunday = nowWarsaw.getDay() === 0;
  const currentWeekStart = format(startOfWeek(nowWarsaw, { weekStartsOn: 1 }), 'yyyy-MM-dd');

  // Sunday → plan next week; otherwise → current week
  const planRef = isSunday ? addDays(nowWarsaw, 7) : nowWarsaw;
  const planWeekStart = startOfWeek(planRef, { weekStartsOn: 1 });
  const planWeekEnd = endOfWeek(planRef, { weekStartsOn: 1 });
  const planWeekLabel = `${format(planWeekStart, 'd MMM', { locale: pl })} – ${format(planWeekEnd, 'd MMM', { locale: pl })}`;

  const planSaved = !!(
    currentReview?.focus_task_ids?.length ||
    currentReview?.week_sentiment ||
    currentReview?.week_focus ||
    currentReview?.proud_of
  );
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

    // Fetch 2 weeks of calendar (this week + next) so both planning and radar views work
    const calFrom = subDays(startOfWeek(now, { weekStartsOn: 1 }), 1).toISOString();
    const calTo = addDays(endOfWeek(addDays(now, 7), { weekStartsOn: 1 }), 1).toISOString();
    const prevWeekStart = format(subDays(startOfWeek(now, { weekStartsOn: 1 }), 7), 'yyyy-MM-dd');

    try {
      const [
        ,
        { data: historyData },
        { data: habitsData },
        { data: logsData },
        { data: reviewData },
        { data: calData },
        { data: todosData },
        { data: goalsData },
        { data: sectionsData },
        { data: prevReviewData },
      ] = await Promise.all([
        supabase.from('daily_wins').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
        supabase.from('daily_wins').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(60),
        supabase.from('habits').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
        supabase.from('habit_logs').select('*').eq('user_id', userId).gte('date', formatWarsawDate(subDays(now, 45))),
        supabase.from('weekly_reviews').select('*').eq('user_id', userId).eq('week_start', currentWeekStart).maybeSingle(),
        supabase.from('vanguard_calendar').select('summary, start_time, end_time').eq('user_id', userId).gte('start_time', calFrom).lt('start_time', calTo).order('start_time'),
        supabase.from('todo_items').select('id, title, status, priority, ai_bucket, due_date, section_id').eq('user_id', userId).eq('status', 'open').order('created_at', { ascending: false }),
        supabase.from('life_goals').select('goal_cialo, date_cialo, goal_duch, date_duch, goal_konto, date_konto').eq('user_id', userId).maybeSingle(),
        supabase.from('todo_sections').select('id, name, project_id').eq('user_id', userId).eq('is_archived', false).order('sort_order', { ascending: true }),
        supabase.from('weekly_reviews').select('*').eq('user_id', userId).eq('week_start', prevWeekStart).maybeSingle(),
      ]);

      setHistory(historyData || []);
      setHabits(habitsData || []);
      setHabitLogs(logsData || []);
      setAllCalEvents(calData || []);
      setWeekTodos(todosData || []);
      setWeekGoals(goalsData || null);
      setTodoSections(sectionsData || []);
      setPrevWeekReview(prevReviewData || null);

      if (reviewData) {
        setCurrentReview(reviewData);
        if (reviewData.week_sentiment) setWeekSentiment(reviewData.week_sentiment);
        if (reviewData.proud_of) setProudOf(reviewData.proud_of);
        if (reviewData.bottleneck) setBottleneck(reviewData.bottleneck);
        if (reviewData.focus_goal_mappings && typeof reviewData.focus_goal_mappings === 'object' && !Array.isArray(reviewData.focus_goal_mappings)) {
          setFocusGoalMappings(reviewData.focus_goal_mappings as Record<string, string>);
        }
      }

      // Load the specific tasks user committed to (maintain their selection order)
      if (reviewData?.focus_task_ids && reviewData.focus_task_ids.length > 0) {
        const { data: ft } = await supabase
          .from('todo_items')
          .select('*')
          .in('id', reviewData.focus_task_ids)
          .eq('user_id', userId);
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
    setTimeout(() => { if (session?.user?.id) fetchData(); }, 0);
  }, [session?.user?.id, fetchData]);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    Promise.all([
      supabase.from('projects').select('id, dream_id').eq('user_id', uid),
      supabase.from('dreams').select('id, life_goal').eq('user_id', uid),
    ]).then(([{ data: p }, { data: d }]) => {
      setChainProjects(p ?? []);
      setChainDreams(d ?? []);
    }).catch(() => {});
  }, [session?.user?.id]);

  const sectionGoalMap = useMemo(() => {
    const dreamGoal = Object.fromEntries(
      chainDreams.filter((d: any) => d.life_goal).map((d: any) => [d.id, `goal_${d.life_goal}` as string])
    );
    const projectDream = Object.fromEntries(
      chainProjects.filter((p: any) => p.dream_id).map((p: any) => [p.id, p.dream_id as string])
    );
    const result: Record<string, string> = {};
    for (const sec of todoSections as any[]) {
      if (!sec.project_id) continue;
      const dreamId = projectDream[sec.project_id];
      if (!dreamId) continue;
      const goal = dreamGoal[dreamId];
      if (goal) result[sec.id] = goal;
    }
    return result;
  }, [chainProjects, chainDreams, todoSections]);

  const stats = useMemo(() => {
    if (!history.length) return { streak: 0, weeklyP: 0, monthlyWin: false, weeks: [] };
    let streak = 0;
    const sorted = [...history].sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
    const today = todayWarsaw();
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    if (sorted[0]?.date === today || sorted[0]?.date === yesterday) {
      for (const day of sorted) {
        if (day.result === 'Z') streak++;
        else if (day.date !== today) break;
      }
    }
    const weeks = [];
    for (let i = 0; i < 4; i++) {
      const start = startOfWeek(subDays(new Date(), i * 7), { weekStartsOn: 1 });
      const end = endOfWeek(start, { weekStartsOn: 1 });
      const weekDays = history.filter((d) => d.date && parseISO(d.date) >= start && parseISO(d.date) <= end);
      const now = startOfDay(new Date());
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

  const pastWeekStats = useMemo(() => {
    const today = new Date();
    const last7Days = history.filter((d) => {
      const diff = Math.round((today.getTime() - new Date(d.date || '').getTime()) / 86400000);
      return diff >= 0 && diff < 7;
    });
    const wins = last7Days.filter((d) => d.result === 'Z').length;

    const last7DaysStrings = Array.from({ length: 7 }).map((_, i) =>
      format(subDays(new Date(), i), 'yyyy-MM-dd')
    );
    const totalLogs = habitLogs.filter((log) => log.date && last7DaysStrings.includes(log.date)).length;
    const totalPossible = habits.length * 7;
    const habitPercent = totalPossible > 0 ? Math.round((totalLogs / totalPossible) * 100) : 0;

    return { wins, habitPercent };
  }, [history, habitLogs, habits]);

  const filteredTasks = useMemo(() => {
    return weekTodos.filter((t) => {
      const matchesSection = selectedSectionId === 'all' || t.section_id === selectedSectionId;
      const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSection && matchesSearch;
    });
  }, [weekTodos, selectedSectionId, searchQuery]);


  async function togglePowerListTask(dayWinStale: DailyWinRow, index: number) {
    // Re-fetch the row fresh to avoid acting on a stale render-time snapshot
    // when two checkboxes are toggled in quick succession (race on `allDone`).
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
      const isPastDeadline = new Date().getHours() >= 23;
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
    }
  }

  function toggleTaskSelection(id: string) {
    const isSelected = selectedTaskIds.has(id);
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
    if (!isSelected) {
      const todo = weekTodos.find(t => t.id === id);
      const autoGoal = todo?.section_id ? sectionGoalMap[todo.section_id] : null;
      if (autoGoal) {
        setFocusGoalMappings(prev => ({ ...prev, [id]: prev[id] ?? autoGoal }));
      }
    }
  }

  async function addQuickTask() {
    const title = quickTaskInput.trim();
    if (!title || addingTask) return;
    setAddingTask(true);
    const { data, error } = await supabase
      .from('todo_items')
      .insert({ user_id: session.user.id, title, status: 'open', priority: 'normal', ai_bucket: 'soon' })
      .select('id, title, status, priority, ai_bucket, due_date, section_id')
      .single();
    if (!error && data) { setWeekTodos((prev) => [data, ...prev]); setQuickTaskInput(''); }
    setAddingTask(false);
  }

  async function saveWeeklyPlan() {
    if (savingPlan) return;
    setSavingPlan(true);
    const ids = [...selectedTaskIds];
    const focusText = weekTodos.filter((t) => ids.includes(t.id)).map((t) => t.title).join(' · ') || null;

    const { data } = await supabase
      .from('weekly_reviews')
      .upsert(
        { user_id: session.user.id, week_start: currentWeekStart, week_sentiment: weekSentiment || null, focus_task_ids: ids, week_focus: focusText, proud_of: proudOf || null, bottleneck: bottleneck || null, focus_goal_mappings: focusGoalMappings },
        { onConflict: 'user_id,week_start' }
      )
      .select()
      .maybeSingle();

    if (ids.length > 0) {
      await supabase
        .from('todo_items')
        .update({ ai_bucket: 'today', ai_classified_at: new Date().toISOString() })
        .in('id', ids)
        .eq('user_id', session.user.id);
    }

    if (data) {
      setCurrentReview(data);
      setFocusTasks(weekTodos.filter((t) => ids.includes(t.id)));
    }
    setSavingPlan(false);
  }

  if (loading) {
    return <div className="p-8 text-center text-text-muted uppercase font-black animate-pulse tracking-widest">Wczytywanie Kierunku...</div>;
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto">

      {/* ── Tydzień ── */}
      <section className="space-y-3">
        <SectionTitle
          icon={Calendar}
          title={showPlanningMode ? 'Plan następnego tygodnia' : 'Radar tygodnia'}
          detail={planWeekLabel}
        />

        {showPlanningMode ? (
          <DirectionPlanningMode
            pastWeekStats={pastWeekStats}
            weekSentiment={weekSentiment}
            setWeekSentiment={setWeekSentiment}
            proudOf={proudOf}
            setProudOf={setProudOf}
            bottleneck={bottleneck}
            setBottleneck={setBottleneck}
            planWeekStart={planWeekStart}
            planCalEvents={planCalEvents}
            selectedSectionId={selectedSectionId}
            setSelectedSectionId={setSelectedSectionId}
            todoSections={todoSections}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filteredTasks={filteredTasks}
            quickTaskInput={quickTaskInput}
            setQuickTaskInput={setQuickTaskInput}
            addQuickTask={addQuickTask}
            addingTask={addingTask}
            selectedTaskIds={selectedTaskIds}
            toggleTaskSelection={toggleTaskSelection}
            weekTodos={weekTodos}
            sectionGoalMap={sectionGoalMap}
            focusGoalMappings={focusGoalMappings}
            setFocusGoalMappings={setFocusGoalMappings}
            saveWeeklyPlan={saveWeeklyPlan}
            savingPlan={savingPlan}
          />
        ) : (
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
            weekGoals={weekGoals}
          />
        )}
      </section>

    </div>
  );
}
