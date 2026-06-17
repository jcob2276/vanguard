import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Calendar,
  Check,
  Plus,
  Shield,
  Target,
  Wallet,
  Zap,
} from 'lucide-react';
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

type DailyWinRow = Tables<'daily_wins'>;
type HabitRow = Tables<'habits'>;
type HabitLogRow = Tables<'habit_logs'>;
type WeeklyReviewRow = Tables<'weekly_reviews'>;
type CalendarRow = Pick<Tables<'vanguard_calendar'>, 'summary' | 'start_time' | 'end_time'>;
type TodoItemRow = Pick<Tables<'todo_items'>, 'id' | 'title' | 'status' | 'priority' | 'ai_bucket' | 'due_date' | 'section_id'>;
type LifeGoalRow = Pick<Tables<'life_goals'>, 'goal_cialo' | 'date_cialo' | 'goal_duch' | 'date_duch' | 'goal_konto' | 'date_konto'>;
type TodoSectionRow = Pick<Tables<'todo_sections'>, 'id' | 'name' | 'project_id'>;

const todayDate = () => format(new Date(), 'yyyy-MM-dd');
const todayWarsaw = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

const GOAL_DEFS = [
  { key: 'goal_cialo', dateKey: 'date_cialo', Icon: Shield, color: 'text-emerald-500' },
  { key: 'goal_duch', dateKey: 'date_duch', Icon: Zap, color: 'text-indigo-400' },
  { key: 'goal_konto', dateKey: 'date_konto', Icon: Wallet, color: 'text-amber-400' },
];

const DAYS_PL = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];

const SENTIMENTS = [
  { value: 'bad', label: 'Słabo' },
  { value: 'ok', label: 'Okej' },
  { value: 'good', label: 'Dobrze' },
  { value: 'excellent', label: 'Wygrany' },
];

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

function MiniStat({ label, value, tone = 'text-text-primary', detail }: { label: string; value: string | number; tone?: string; detail?: string | null }) {
  return (
    <div className="rounded-[24px] border border-border-custom bg-surface backdrop-blur-md p-4 shadow-sm">
      <p className="text-[8px] font-black uppercase tracking-[0.18em] text-text-muted">{label}</p>
      <p className={`mt-2 text-[20px] font-black uppercase leading-none tracking-tight ${tone} font-display`}>{value}</p>
      {detail && <p className="mt-2 text-[9px] font-bold uppercase tracking-widest text-text-muted">{detail}</p>}
    </div>
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

  const isSunday = new Date().getDay() === 0;
  const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  // Sunday → plan next week; otherwise → current week
  const planRef = isSunday ? addDays(new Date(), 7) : new Date();
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
    const eDay = new Date(e.start_time).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    return eDay >= format(planWeekStart, 'yyyy-MM-dd') && eDay <= format(planWeekEnd, 'yyyy-MM-dd');
  });
  const todayCalEvents = allCalEvents.filter((e) => {
    if (!e.start_time) return false;
    return new Date(e.start_time).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' }) === todayWarsaw();
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const today = todayDate();
    const userId = session.user.id;
    const now = new Date();

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
        supabase.from('habit_logs').select('*').eq('user_id', userId).gte('date', subDays(now, 45).toISOString().split('T')[0]),
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

  const GOAL_CHIP: Record<string, { label: string; chip: string }> = {
    goal_cialo: { label: 'Ciało', chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    goal_duch:  { label: 'Duch',  chip: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'   },
    goal_konto: { label: 'Konto', chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400'       },
  };

  const stats = useMemo(() => {
    if (!history.length) return { streak: 0, weeklyP: 0, monthlyWin: false, weeks: [] };
    let streak = 0;
    const sorted = [...history].sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
    const today = todayDate();
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
        if (!weekDays.some((e) => e.date === checkDate) && checkDate >= '2026-05-03') missing++;
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


  async function togglePowerListTask(dayWin: DailyWinRow, index: number) {
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

  const displayFocusTasks = focusTasks.length > 0 ? focusTasks : weekTodos.slice(0, 3);

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
          /* ── Planning mode (Sunday, no plan yet) ── */
          <div className="space-y-5 rounded-2xl border border-primary/15 bg-primary/5 p-4 shadow-sm">

            {/* 1. Past Week Performance stats */}
            <div className="rounded-xl border border-border-custom/50 bg-surface/50 p-3.5">
              <p className="text-[8px] font-black uppercase tracking-widest text-text-muted mb-2">Podsumowanie minionego tygodnia</p>
              <div className="flex gap-4">
                <div className="flex-1">
                  <span className="block text-[16px] font-black text-emerald-500 font-display">{pastWeekStats.wins}/7</span>
                  <span className="text-[8px] font-bold uppercase tracking-wider text-text-muted">Dni wygranych</span>
                </div>
                <div className="w-[1px] bg-border-custom" />
                <div className="flex-1">
                  <span className="block text-[16px] font-black text-indigo-400 font-display">{pastWeekStats.habitPercent}%</span>
                  <span className="text-[8px] font-bold uppercase tracking-wider text-text-muted">Realizacja nawyków</span>
                </div>
              </div>
            </div>

            {/* 2. Sentiment */}
            <div>
              <p className="mb-2 text-[8px] font-black uppercase tracking-widest text-text-muted">Jak minął ten tydzień?</p>
              <div className="grid grid-cols-2 gap-2">
                {SENTIMENTS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setWeekSentiment(s.value)}
                    className={`py-3 rounded-xl border text-[12px] font-semibold transition-all cursor-pointer ${weekSentiment === s.value ? 'border-primary bg-primary text-white shadow-sm shadow-primary/20' : 'border-border-custom bg-surface text-text-secondary hover:bg-surface-solid'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Reflection fields */}
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-[8px] font-black uppercase tracking-widest text-text-muted">Z czego jestem najbardziej dumny?</p>
                <textarea
                  value={proudOf}
                  onChange={(e) => setProudOf(e.target.value)}
                  placeholder="Główny sukces, przełom lub ukończone ważne zadanie..."
                  rows={2}
                  className="w-full rounded-xl border border-border-custom bg-surface p-3 text-[12px] font-medium text-text-primary outline-none transition-all placeholder:text-text-muted/40 focus:border-primary/50 focus:bg-surface-solid"
                />
              </div>
              <div>
                <p className="mb-1.5 text-[8px] font-black uppercase tracking-widest text-text-muted">Co mnie spowalniało / Lekcja na przyszłość?</p>
                <textarea
                  value={bottleneck}
                  onChange={(e) => setBottleneck(e.target.value)}
                  placeholder="Brak energii, przeszkody, wnioski, co zmienić..."
                  rows={2}
                  className="w-full rounded-xl border border-border-custom bg-surface p-3 text-[12px] font-medium text-text-primary outline-none transition-all placeholder:text-text-muted/40 focus:border-primary/50 focus:bg-surface-solid"
                />
              </div>
            </div>

            {/* 4. Next week calendar */}
            <div>
              <p className="mb-2 text-[8px] font-black uppercase tracking-widest text-text-muted">Harmonogram na następny tydzień</p>
              <div className="flex gap-1 mb-2">
                {DAYS_PL.map((dayLabel, i) => {
                  const dayDate = addDays(planWeekStart, i);
                  const dayKey = dayDate.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
                  const hasEvent = planCalEvents.some((e) =>
                    new Date(e.start_time!).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' }) === dayKey
                  );
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] font-bold text-text-muted">{dayLabel}</span>
                      <span className="text-[10px] font-semibold text-text-primary">{format(dayDate, 'd')}</span>
                      <div className={`h-1.5 w-1.5 rounded-full ${hasEvent ? 'bg-primary' : 'bg-transparent'}`} />
                    </div>
                  );
                })}
              </div>
              {planCalEvents.length > 0 && (
                <div className="max-h-[110px] overflow-y-auto space-y-1 rounded-xl border border-border-custom bg-surface/30 p-2.5">
                  {planCalEvents.map((ev, i) => {
                    const eDay = new Date(ev.start_time!).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
                    const dayIdx = DAYS_PL.findIndex((_, j) =>
                      addDays(planWeekStart, j).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' }) === eDay
                    );
                    return (
                      <p key={i} className="text-[10px] font-semibold text-text-secondary truncate">
                        <span className="font-black text-primary mr-1">{dayIdx >= 0 ? DAYS_PL[dayIdx] : ''}</span>
                        <span className="text-text-muted text-[9px] mr-1.5">
                          {new Date(ev.start_time!).toLocaleTimeString('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {ev.summary}
                      </p>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 5. Task picker */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[8px] font-black uppercase tracking-widest text-text-muted font-display">Wybierz fokus tygodnia (maks. 3)</p>
                <span className="text-[9px] font-black uppercase tracking-wider text-text-muted">{selectedTaskIds.size}/3</span>
              </div>

              {/* Section Filters & Search */}
              <div className="space-y-2">
                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setSelectedSectionId('all')}
                    className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border whitespace-nowrap ${selectedSectionId === 'all' ? 'bg-primary border-primary text-white shadow-sm' : 'bg-surface border-border-custom text-text-secondary hover:bg-surface-solid'}`}
                  >
                    Wszystkie
                  </button>
                  {todoSections.map((sec) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setSelectedSectionId(sec.id)}
                      className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer border ${selectedSectionId === sec.id ? 'bg-primary border-primary text-white shadow-sm' : 'bg-surface border-border-custom text-text-secondary hover:bg-surface-solid'}`}
                    >
                      {sec.name}
                    </button>
                  ))}
                </div>

                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtruj lub szukaj zadania..."
                  className="w-full rounded-xl border border-border-custom bg-surface px-3 py-2 text-[12px] font-medium text-text-primary outline-none focus:border-primary/50 placeholder:text-text-muted/40"
                />
              </div>

              {filteredTasks.length === 0 ? (
                <div className="space-y-2 rounded-xl border border-dashed border-border-custom p-4 text-center">
                  <p className="text-[11px] font-semibold text-text-muted">
                    {searchQuery || selectedSectionId !== 'all' ? 'Brak pasujących zadań' : 'Brak zadań — dodaj pierwsze'}
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={quickTaskInput}
                      onChange={(e) => setQuickTaskInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addQuickTask()}
                      placeholder="Tytuł zadania..."
                      className="flex-1 rounded-lg border border-border-custom bg-surface px-3 py-2 text-[12px] font-medium text-text-primary outline-none focus:border-primary/50"
                    />
                    <button type="button" onClick={addQuickTask} disabled={addingTask || !quickTaskInput.trim()} className="flex items-center rounded-lg bg-primary px-3 text-white cursor-pointer disabled:opacity-40">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                  {filteredTasks.map((todo) => {
                    const isSelected = selectedTaskIds.has(todo.id);
                    const atMax = selectedTaskIds.size >= 3 && !isSelected;
                    return (
                      <div
                        key={todo.id}
                        onClick={() => !atMax && toggleTaskSelection(todo.id)}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-all ${
                          isSelected ? 'border-primary/30 bg-primary/8 cursor-pointer'
                          : atMax ? 'border-border-custom bg-surface opacity-30'
                          : 'border-border-custom bg-surface hover:bg-surface-solid cursor-pointer'
                        }`}
                      >
                        <div className={`h-5 w-5 shrink-0 rounded-full border-[1.5px] flex items-center justify-center transition-all ${isSelected ? 'border-primary bg-primary' : 'border-border-custom'}`}>
                          {isSelected && <Check size={10} className="text-white" />}
                        </div>
                        <span className="flex-1 truncate text-[12px] font-semibold text-text-primary">{todo.title}</span>
                        {todo.section_id && sectionGoalMap[todo.section_id] && (() => {
                          const g = GOAL_CHIP[sectionGoalMap[todo.section_id]];
                          return g ? (
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black ${g.chip}`}>{g.label}</span>
                          ) : null;
                        })()}
                        {todo.ai_bucket && (
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black ${
                            todo.ai_bucket === 'today' ? 'bg-rose-500/10 text-rose-500'
                            : todo.ai_bucket === 'soon' ? 'bg-primary/10 text-primary'
                            : 'bg-text-muted/10 text-text-muted'
                          }`}>
                            {todo.ai_bucket === 'today' ? 'Dziś' : todo.ai_bucket === 'soon' ? 'Wkrótce' : 'W tle'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {/* Inline quick add */}
                  <div className="flex gap-2 pt-1.5">
                    <input
                      value={quickTaskInput}
                      onChange={(e) => setQuickTaskInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addQuickTask()}
                      placeholder="Dodaj nowe zadanie..."
                      className="flex-1 rounded-xl border border-dashed border-border-custom bg-transparent px-3 py-2 text-[12px] font-medium text-text-primary outline-none focus:border-primary/50 placeholder:text-text-muted/40"
                    />
                    {quickTaskInput.trim() && (
                      <button type="button" onClick={addQuickTask} disabled={addingTask} className="flex items-center rounded-xl bg-primary px-3 text-white cursor-pointer disabled:opacity-40">
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Goal mapping picker */}
            {selectedTaskIds.size > 0 && (
              <div className="space-y-3 rounded-xl border border-border-custom bg-surface p-3">
                <p className="text-[8px] font-black uppercase tracking-widest text-text-muted">Połącz zadania z celami</p>
                <div className="space-y-2.5">
                  {[...selectedTaskIds].map((id) => {
                    const todo = weekTodos.find((t) => t.id === id);
                    if (!todo) return null;
                    const currentMapping = focusGoalMappings[todo.id] || 'other';
                    return (
                      <div key={todo.id} className="space-y-1">
                        <p className="text-[11px] font-bold text-text-primary truncate">{todo.title}</p>
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { value: 'goal_cialo', label: 'Ciało', color: 'border-emerald-500/35 text-emerald-500 bg-emerald-500/5' },
                            { value: 'goal_duch', label: 'Duch', color: 'border-indigo-500/35 text-indigo-500 bg-indigo-500/5' },
                            { value: 'goal_konto', label: 'Konto', color: 'border-amber-500/35 text-amber-500 bg-amber-500/5' },
                            { value: 'other', label: 'Inne', color: 'border-border-custom text-text-muted bg-surface/40' },
                          ].map((g) => {
                            const active = currentMapping === g.value;
                            return (
                              <button
                                key={g.value}
                                type="button"
                                onClick={() => setFocusGoalMappings((prev) => ({ ...prev, [todo.id]: g.value }))}
                                className={`py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border transition-all cursor-pointer ${
                                  active 
                                    ? g.value === 'goal_cialo' ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
                                      : g.value === 'goal_duch' ? 'border-indigo-500 bg-indigo-500 text-white shadow-sm'
                                      : g.value === 'goal_konto' ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                                      : 'border-text-primary bg-text-primary text-background shadow-sm'
                                    : 'border-border-custom bg-surface text-text-secondary hover:bg-surface-solid'
                                }`}
                              >
                                {g.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6. Confirm */}
            <button
              onClick={saveWeeklyPlan}
              disabled={savingPlan}
              className="w-full rounded-xl bg-primary hover:bg-primary-hover py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-md shadow-primary/20 transition-all cursor-pointer disabled:opacity-40"
            >
              {savingPlan ? 'Zapisywanie...' : 'Zatwierdź plan'}
            </button>
          </div>
        ) : (
          /* ── Radar mode ── */
          <div className="space-y-4">

            {/* 1. Kompaktowe statsy */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-[16px] border border-border-custom bg-surface p-3 shadow-sm text-center">
                <p className="text-[8px] font-black uppercase tracking-widest text-text-muted">Streak</p>
                <p className="text-[20px] font-black font-display text-primary mt-1 leading-none">{stats.streak}</p>
                <p className="text-[8px] font-bold text-text-muted mt-1">dni</p>
              </div>
              <div className="rounded-[16px] border border-border-custom bg-surface p-3 shadow-sm text-center">
                <p className="text-[8px] font-black uppercase tracking-widest text-text-muted">Tydzień</p>
                <p className={`text-[14px] font-black font-display mt-1 leading-none ${stats.weeklyP > 2 ? 'text-dayB' : 'text-dayC'}`}>
                  {stats.weeklyP > 2 ? 'Przeg.' : 'OK'}
                </p>
                <p className="text-[8px] font-bold text-text-muted mt-1">{stats.weeklyP}/2 P</p>
              </div>
              <div className="rounded-[16px] border border-border-custom bg-surface p-3 shadow-sm text-center">
                <p className="text-[8px] font-black uppercase tracking-widest text-text-muted">Miesiąc</p>
                <p className={`text-[14px] font-black font-display mt-1 leading-none ${stats.monthlyWin ? 'text-dayC' : 'text-orange-500'}`}>
                  {stats.weeks.filter((w) => w.isWeekWin).length}/3
                </p>
                <p className="text-[8px] font-bold text-text-muted mt-1">tyg. wygr.</p>
              </div>
            </div>

            {/* 2. Mapka 28 dni */}
            <div className="rounded-[24px] border border-border-custom bg-surface p-4 shadow-sm">
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 28 }).map((_, index) => {
                  const gridStart = startOfWeek(subDays(new Date(), 21), { weekStartsOn: 1 });
                  const dateObj = subDays(gridStart, -index);
                  const date = format(dateObj, 'yyyy-MM-dd');
                  const dayData = history.find((d) => d.date === date);
                  const isFuture = dateObj > new Date();
                  const isMissingLoss = date < todayDate() && !dayData && date >= '2026-05-03';
                  const color = isFuture ? 'border border-border-custom bg-transparent' : dayData?.result === 'Z' ? 'bg-dayC' : dayData?.result === 'P' || isMissingLoss ? 'bg-dayB' : 'border border-border-custom bg-surface';
                  return (
                    <div key={date} title={date} className={`flex aspect-square items-end justify-center rounded-lg ${color}`}>
                      {date === todayDate() && <span className="mb-1 h-1 w-1 rounded-full bg-white" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Lekcja z poprzedniego tygodnia */}
            {prevWeekReview?.bottleneck && (
              <div className="rounded-[24px] border border-amber-500/25 bg-amber-500/5 p-4 shadow-sm flex gap-3 items-start animate-in fade-in-50 duration-300">
                <span className="text-[18px] leading-none">💡</span>
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-amber-500 mb-0.5 font-display">Lekcja na ten tydzień</p>
                  <p className="text-[12px] font-semibold text-text-primary leading-relaxed">{prevWeekReview.bottleneck}</p>
                </div>
              </div>
            )}

            {/* 3. Weekly Board — na górze */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-text-muted font-display mb-3">Plan tygodnia</p>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-border-custom scrollbar-track-transparent snap-x">
              {DAYS_PL.map((dayLabel, i) => {
                const dayDate = addDays(planWeekStart, i);
                const dayKey = dayDate.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
                const isToday = dayKey === todayWarsaw();
                const dayWin = history.find((d) => d.date === dayKey);
                const dayEvents = allCalEvents.filter((e) => 
                  e.start_time && new Date(e.start_time).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' }) === dayKey
                );

                const dayWinAny = dayWin as any;
                const hasWins = dayWinAny && [0, 1, 2, 3, 4].some(slotIdx => dayWinAny[`task_${slotIdx + 1}`]);
                const hasContent = dayEvents.length > 0 || hasWins;

                if (!hasContent) {
                  return (
                    <div 
                      key={i} 
                      className={`min-w-[150px] max-w-[170px] shrink-0 flex flex-col rounded-[24px] border p-4 snap-align-start transition-all ${
                        isToday ? 'border-primary/45 bg-surface-solid shadow-sm' : 'border-border-custom bg-surface/20 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-border-custom/30 pb-2 mb-3">
                        <h4 className={`text-[12px] font-black uppercase tracking-wide ${isToday ? 'text-primary' : 'text-text-primary'}`}>
                          {dayLabel}
                        </h4>
                        <span className="text-[10px] font-bold text-text-muted">
                          {format(dayDate, 'd MMM', { locale: pl })}
                        </span>
                      </div>
                      <div className="flex-1 flex items-center justify-center py-6">
                        <span className="text-[9px] text-text-muted/40 font-bold uppercase tracking-wider">Brak planów</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div 
                    key={i} 
                    className={`min-w-[260px] max-w-[280px] shrink-0 flex flex-col rounded-[24px] border bg-surface p-4 shadow-sm transition-all duration-300 snap-align-start ${
                      isToday ? 'border-primary/50 shadow-md shadow-primary/5 bg-surface-solid' : 'border-border-custom'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-border-custom/40 pb-2 mb-3 shrink-0">
                      <div className="flex items-center gap-3">
                        <h4 className={`text-[12px] font-black uppercase tracking-wide ${isToday ? 'text-primary' : 'text-text-primary'}`}>
                          {dayLabel}
                        </h4>
                        <span className="text-[10px] font-bold text-text-muted">
                          {format(dayDate, 'd MMM', { locale: pl })}
                        </span>
                      </div>
                      {isToday && (
                        <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-primary">
                          Dzisiaj
                        </span>
                      )}
                    </div>

                    <div className="space-y-4 flex-1 flex flex-col justify-start">
                      
                      {/* Calendar (only if has events) */}
                      {dayEvents.length > 0 && (
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Calendar size={11} className="text-primary shrink-0" />
                            <span className="text-[8px] font-black uppercase tracking-wider text-text-muted">Harmonogram</span>
                          </div>
                          <div className="space-y-1.5 pl-3 border-l border-border-custom/50">
                            {dayEvents.map((ev, idx) => (
                              <div key={idx} className="flex items-baseline gap-1.5 text-[10px] font-semibold text-text-secondary font-display">
                                <span className="text-primary font-black shrink-0 text-[8.5px] mr-1">
                                  {new Date(ev.start_time!).toLocaleTimeString('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="truncate">{ev.summary}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Daily plan (only if has plan) */}
                      {hasWins && (
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Target size={11} className="text-emerald-500 shrink-0" />
                            <span className="text-[8px] font-black uppercase tracking-wider text-text-muted font-display">Plan dnia</span>
                          </div>
                          <div className="space-y-2 pl-3 border-l border-border-custom/50">
                            {[0, 1, 2, 3, 4].map((slotIdx) => {
                              const dayWinAny = dayWin as any;
                              const task = dayWinAny[`task_${slotIdx + 1}`];
                              const done = dayWinAny[`done_${slotIdx + 1}`];
                              if (!task) return null;
                              const isInteractive = isToday;
                              return (
                                <div 
                                  key={slotIdx} 
                                  onClick={() => isInteractive && togglePowerListTask(dayWin!, slotIdx)}
                                  className={`flex items-center gap-2 text-[11px] font-medium transition-all duration-200 ${isInteractive ? 'cursor-pointer active:scale-[0.98]' : ''}`}
                                >
                                  <div className={`h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center transition-all duration-300 ${
                                    done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border-custom bg-surface'
                                  }`}>
                                    {done && <Check size={8} strokeWidth={3} className="text-white" />}
                                  </div>
                                  <span className={`truncate ${done ? 'line-through text-text-muted opacity-70' : 'text-text-primary'}`}>
                                    {task}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}
              </div>
            </div>

            {/* 4. Fokus tygodnia — tylko jeśli zatwierdzony */}
            {focusTasks.length > 0 && (
              <div className="rounded-[24px] border border-border-custom bg-surface p-4 shadow-sm">
                <p className="mb-3 text-[8px] font-black uppercase tracking-widest text-text-muted font-display">Fokus tygodnia</p>
                <div className="space-y-3.5">
                  {[
                    { key: 'goal_cialo', label: 'Ciało', color: 'text-emerald-500' },
                    { key: 'goal_duch', label: 'Duch', color: 'text-indigo-400' },
                    { key: 'goal_konto', label: 'Konto', color: 'text-amber-400' },
                    { key: 'other', label: 'Inne', color: 'text-text-muted' },
                  ].map((category) => {
                    const tasksInCategory = focusTasks.filter(
                      (todo) => (focusGoalMappings[todo.id] || 'other') === category.key
                    );
                    if (tasksInCategory.length === 0) return null;
                    return (
                      <div key={category.key} className="space-y-1.5">
                        <p className={`text-[9px] font-black uppercase tracking-wider ${category.color} font-display`}>{category.label}</p>
                        <div className="space-y-1.5 pl-2 border-l border-border-custom/60">
                          {tasksInCategory.map((todo) => {
                            const done = todo.status === 'done';
                            return (
                              <div key={todo.id} className="flex items-center gap-2.5">
                                <div className={`h-4 w-4 shrink-0 rounded-full border flex items-center justify-center ${done ? 'border-emerald-500 bg-emerald-500' : 'border-border-custom'}`}>
                                  {done && <Check size={9} className="text-white" />}
                                </div>
                                <span className={`flex-1 truncate text-[12px] font-semibold ${done ? 'line-through text-text-muted' : 'text-text-primary'}`}>{todo.title}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. Sentyment + Cele */}
            <div className="space-y-3">
              {currentReview?.week_sentiment && (
                <div className="rounded-[24px] border border-border-custom bg-surface px-4 py-3.5 shadow-sm flex items-center justify-between">
                  <span className="text-[8px] font-black uppercase tracking-widest text-text-muted font-display">Sentyment tygodnia</span>
                  <span className={`text-[9px] font-black uppercase tracking-wide rounded-full px-2.5 py-0.5 ${
                    currentReview.week_sentiment === 'excellent' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : currentReview.week_sentiment === 'good' ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                    : currentReview.week_sentiment === 'ok' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  }`}>
                    {SENTIMENTS.find((s) => s.value === currentReview.week_sentiment)?.label}
                  </span>
                </div>
              )}
              {weekGoals && GOAL_DEFS.some((g) => (weekGoals as any)[g.key]) && (
                <div className="rounded-[24px] border border-border-custom bg-surface p-4 shadow-sm">
                  <p className="mb-3 text-[8px] font-black uppercase tracking-widest text-text-muted font-display">Cele kierunkowe</p>
                  <div className="space-y-2.5">
                    {GOAL_DEFS.filter((g) => (weekGoals as any)[g.key]).map(({ key, dateKey, Icon, color }) => {
                      const weekGoalsAny = weekGoals as any;
                      const days = weekGoalsAny[dateKey] ? differenceInDays(parseISO(weekGoalsAny[dateKey]), new Date()) : null;
                      return (
                        <div key={key} className="flex items-center gap-2.5">
                          <Icon size={13} className={`${color} shrink-0`} />
                          <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-text-primary">{weekGoalsAny[key]}</span>
                          {days !== null && (
                            <span className={`shrink-0 text-[9px] font-bold ${days <= 0 ? 'text-rose-500 font-black' : days <= 14 ? 'text-amber-500' : 'text-text-muted'}`}>
                              {days <= 0 ? `${Math.abs(days)}d po` : `za ${days}d`}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </section>

    </div>
  );
}
