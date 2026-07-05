import { useEffect, useMemo, useState } from 'react';
import { X, CheckCircle2, Send, ChevronRight, ChevronLeft, AlertTriangle, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCalendarWrite } from '../../hooks/useCalendarWrite';
import { getTodayWarsaw } from '../../lib/date';
import { getWeekStartWarsaw, shiftWeekStart } from '../../lib/growth';
import { updateDailyWin, insertDailyWin } from '../../lib/goalSpine.mutations';
import { notify } from '../../lib/notify';
import DayTimeline, { type TimelineBlock } from '../shared/DayTimeline';

interface Props {
  session: any;
  onClose: () => void;
  /** Date being planned (YYYY-MM-DD). Defaults to today; pass tomorrow's date
   * to chain this straight out of the evening shutdown ritual. */
  targetDate?: string;
}

interface TodoSlot {
  id: string;
  title: string;
  priority: string;
  duration_minutes: number | null;
  due_date: string | null;
  scheduled_time: string | null;
  status: string;
}

interface CalEvent {
  start_time: string;
  end_time: string;
  summary: string | null;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-rose-500',
  high: 'text-orange-400',
  normal: 'text-primary',
  low: 'text-text-muted',
};

const CAPACITY_HOURS = 8;

function warsawIso(date: string, timeStr: string) {
  return `${date}T${timeStr}:00+02:00`;
}

function addMinutes(timeStr: string, minutes: number) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Shifts a YYYY-MM-DD date string by N days, anchored at UTC noon to sidestep DST edges. */
function shiftDateStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The date part of a stored calendar/scheduled ISO string (Warsaw wall-clock, per warsawIso). */
function isoDateStr(iso: string): string {
  return iso.split('T')[0];
}

/** Minutes since midnight, read directly off the Warsaw wall-clock digits (no browser-tz conversion). */
function isoMinutesOfDay(iso: string): number {
  const t = iso.split('T')[1] || '00:00:00';
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Duration in minutes — a plain instant delta, safe regardless of how either Date parses tz. */
function isoDurationMin(startIso: string, endIso: string): number {
  const diff = (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000;
  return diff > 0 ? diff : 0;
}

export default function MorningPlanModal({ session, onClose, targetDate }: Props) {
  const userId = session?.user?.id as string | undefined;
  const accessToken = session?.access_token as string | undefined;
  const actualToday = getTodayWarsaw();
  const planningDate = targetDate ?? actualToday;
  const isPlanningTomorrow = planningDate !== actualToday;
  const dayWord = isPlanningTomorrow ? 'jutro' : 'dziś';
  const dayWordCap = isPlanningTomorrow ? 'Jutro' : 'Dziś';
  const dayWordGen = isPlanningTomorrow ? 'jutrzejszego' : 'dzisiejszego';
  const dayWordAcc = isPlanningTomorrow ? 'jutrzejszą' : 'dzisiejszą';

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Data states
  const [yesterdayTasks, setYesterdayTasks] = useState<TodoSlot[]>([]);
  const [todayTasks, setTodayTasks] = useState<TodoSlot[]>([]);
  const [inboxTasks, setInboxTasks] = useState<TodoSlot[]>([]);

  // Power List slots (1-5)
  const [powerList, setPowerList] = useState<(TodoSlot | null)[]>([null, null, null, null, null]);
  const [todayWinId, setTodayWinId] = useState<string | null>(null);

  // Time-boxing states
  const [times, setTimes] = useState<Record<string, string>>({}); // taskId -> "HH:MM"
  const [durations, setDurations] = useState<Record<string, number>>({}); // taskId -> minutes

  // Week context — fetched once for the whole week so the header strip and the
  // day timeline in Step 3 share the same data instead of two separate queries.
  const [weekCalendarEvents, setWeekCalendarEvents] = useState<CalEvent[]>([]);
  const [weekTaskCounts, setWeekTaskCounts] = useState<Record<string, number>>({});

  const { createEvent } = useCalendarWrite({ userId, accessToken });

  const weekStart = useMemo(() => getWeekStartWarsaw(planningDate), [planningDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftDateStr(weekStart, i)), [weekStart]);

  // Initial load
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    (async () => {
      try {
        // 1. Fetch open tasks due before the planning date (yesterday-and-older
        // when planning today; today's own leftovers too when planning tomorrow)
        const { data: pastData } = await supabase
          .from('todo_items')
          .select('id, title, priority, duration_minutes, due_date, scheduled_time, status')
          .eq('user_id', userId)
          .eq('status', 'open')
          .lt('due_date', planningDate)
          .order('priority', { ascending: true });

        // 2. Fetch the planning date's open tasks
        const orFilter = isPlanningTomorrow
          ? `due_date.eq.${planningDate}`
          : `due_date.eq.${planningDate},ai_bucket.eq.today`;
        const { data: currentData } = await supabase
          .from('todo_items')
          .select('id, title, priority, duration_minutes, due_date, scheduled_time, status')
          .eq('user_id', userId)
          .eq('status', 'open')
          .or(orFilter)
          .order('priority', { ascending: true });

        // 3. Fetch general inbox open tasks (no due date)
        const { data: inboxData } = await supabase
          .from('todo_items')
          .select('id, title, priority, duration_minutes, due_date, scheduled_time, status')
          .eq('user_id', userId)
          .eq('status', 'open')
          .is('due_date', null)
          .order('created_at', { ascending: false });

        setYesterdayTasks((pastData as TodoSlot[]) || []);
        setTodayTasks((currentData as TodoSlot[]) || []);
        setInboxTasks((inboxData as TodoSlot[]) || []);

        // Pre-fill durations and times
        const timesPreset: Record<string, string> = {};
        const durationsPreset: Record<string, number> = {};
        const allTasks = [...(pastData || []), ...(currentData || []), ...(inboxData || [])] as TodoSlot[];
        allTasks.forEach((t) => {
          durationsPreset[t.id] = t.duration_minutes || 30;
          if (t.scheduled_time) {
            timesPreset[t.id] = t.scheduled_time.split('T')[1]?.slice(0, 5) || '';
          }
        });
        setTimes(timesPreset);
        setDurations(durationsPreset);

        // 4. Fetch the planning date's daily win row (Power List)
        const { data: winData } = await supabase
          .from('daily_wins')
          .select('*, daily_win_tasks(*)')
          .eq('user_id', userId)
          .eq('date', planningDate)
          .maybeSingle();

        if (winData) {
          setTodayWinId(winData.id);
          // Match existing power list items if any
          const presetList: (TodoSlot | null)[] = [null, null, null, null, null];
          const tasks = (winData as any).daily_win_tasks || [];
          for (const t of tasks) {
            const i = t.slot; // 1-indexed slot
            if (i >= 1 && i <= 5 && t.todo_id) {
              const found = allTasks.find((item) => item.id === t.todo_id);
              presetList[i - 1] = found || {
                id: t.todo_id,
                title: t.title || 'Zadanie',
                priority: 'normal',
                duration_minutes: 30,
                due_date: planningDate,
                scheduled_time: null,
                status: t.done ? 'done' : 'open',
              };
            }
          }
          setPowerList(presetList);
        } else {
          setTodayWinId(null);
          setPowerList([null, null, null, null, null]);
        }

        // 5. Fetch the whole week's calendar + task-due counts (header strip + Step 3 timeline)
        const weekStartLocal = getWeekStartWarsaw(planningDate);
        const weekEndExclusive = shiftWeekStart(weekStartLocal, 1);

        const { data: weekCalData } = await supabase
          .from('vanguard_calendar')
          .select('start_time, end_time, summary')
          .eq('user_id', userId)
          .gte('start_time', weekStartLocal + 'T00:00:00')
          .lt('start_time', weekEndExclusive + 'T00:00:00');
        setWeekCalendarEvents((weekCalData as CalEvent[]) || []);

        const { data: weekTaskData } = await supabase
          .from('todo_items')
          .select('due_date')
          .eq('user_id', userId)
          .eq('status', 'open')
          .not('due_date', 'is', null)
          .gte('due_date', weekStartLocal)
          .lt('due_date', weekEndExclusive);
        const counts: Record<string, number> = {};
        (weekTaskData || []).forEach((t) => {
          if (t.due_date) counts[t.due_date] = (counts[t.due_date] || 0) + 1;
        });
        setWeekTaskCounts(counts);
      } catch (err) {
        console.error('Failed to load morning planning data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, planningDate, isPlanningTomorrow]);

  // Yesterday reviews actions
  const handleYesterdayAction = async (taskId: string, action: 'today' | 'later' | 'backlog' | 'drop' | 'done') => {
    const target = yesterdayTasks.find((t) => t.id === taskId);
    if (!target) return;

    // Optimistic update
    setYesterdayTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (action === 'today') setTodayTasks((prev) => [...prev, { ...target, due_date: planningDate }]);
    if (action === 'backlog') setInboxTasks((prev) => [...prev, { ...target, due_date: null }]);

    const revert = () => {
      setYesterdayTasks((prev) => [...prev, target]);
      if (action === 'today') setTodayTasks((prev) => prev.filter((t) => t.id !== taskId));
      if (action === 'backlog') setInboxTasks((prev) => prev.filter((t) => t.id !== taskId));
    };

    try {
      let error;
      if (action === 'today') {
        ({ error } = await supabase.from('todo_items').update({ due_date: planningDate }).eq('id', taskId));
      } else if (action === 'later') {
        const laterDate = shiftDateStr(planningDate, 1);
        ({ error } = await supabase.from('todo_items').update({ due_date: laterDate }).eq('id', taskId));
      } else if (action === 'backlog') {
        ({ error } = await supabase.from('todo_items').update({ due_date: null }).eq('id', taskId));
      } else if (action === 'drop') {
        ({ error } = await supabase.from('todo_items').update({ status: 'dropped' }).eq('id', taskId));
      } else if (action === 'done') {
        ({ error } = await supabase.from('todo_items').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', taskId));
      }
      if (error) throw error;
    } catch (e) {
      console.error('Error handling yesterday task action:', e);
      notify('Nie udało się zaktualizować zadania', 'error');
      revert();
    }
  };

  // Power List slot selection
  const [activeSlotIdx, setActiveSlotIdx] = useState<number | null>(null);

  const handleAssignToSlot = (task: TodoSlot) => {
    if (activeSlotIdx === null) return;

    // Check if task is already in another slot, if so clear it
    setPowerList((prev) => {
      const next = prev.map((s, idx) => {
        if (idx === activeSlotIdx) return task;
        if (s?.id === task.id) return null;
        return s;
      });
      return next;
    });
    setActiveSlotIdx(null);
  };

  const handleClearSlot = (idx: number) => {
    setPowerList((prev) => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
  };

  // The planning date's own calendar events, sliced out of the week fetch
  const dayCalendarEvents = useMemo(
    () => weekCalendarEvents.filter((e) => e.start_time && isoDateStr(e.start_time) === planningDate),
    [weekCalendarEvents, planningDate],
  );

  const calendarMeetingMinutes = useMemo(
    () => dayCalendarEvents.reduce((sum, e) => sum + (e.end_time ? isoDurationMin(e.start_time, e.end_time) : 0), 0),
    [dayCalendarEvents],
  );

  // Calculations for Step 3
  const totalMinutesPlanned = useMemo(() => {
    let sum = calendarMeetingMinutes;
    // Add durations of today's tasks that have a scheduled time
    const todayTaskIds = new Set(todayTasks.map((t) => t.id));
    const powerListTaskIds = new Set(powerList.filter(Boolean).map((t) => t!.id));

    // Sum scheduled times
    Object.keys(times).forEach((taskId) => {
      if (times[taskId] && (todayTaskIds.has(taskId) || powerListTaskIds.has(taskId))) {
        sum += durations[taskId] || 30;
      }
    });
    return sum;
  }, [todayTasks, powerList, times, durations, calendarMeetingMinutes]);

  const capacityPct = Math.min(100, Math.round((totalMinutesPlanned / (CAPACITY_HOURS * 60)) * 100));
  const capacityHoursPlanned = Math.round((totalMinutesPlanned / 60) * 10) / 10;
  const isOverloaded = capacityHoursPlanned > CAPACITY_HOURS;

  // Existing events + live task-time overlay, for the Step 3 timeline
  const timelineBlocks: TimelineBlock[] = useMemo(() => {
    const existing: TimelineBlock[] = dayCalendarEvents.map((e, i) => ({
      id: `existing-${i}`,
      startMin: isoMinutesOfDay(e.start_time),
      durationMin: e.end_time ? isoDurationMin(e.start_time, e.end_time) : 30,
      label: e.summary || 'Wydarzenie',
      variant: 'existing',
    }));
    const uniqueTasks = [...powerList.filter(Boolean), ...todayTasks].filter(
      (t, idx, self): t is TodoSlot => !!t && self.findIndex((x) => x?.id === t?.id) === idx,
    );
    const planned: TimelineBlock[] = uniqueTasks
      .filter((t) => times[t.id])
      .map((t) => {
        const [h, m] = times[t.id].split(':').map(Number);
        return {
          id: t.id,
          startMin: (h || 0) * 60 + (m || 0),
          durationMin: durations[t.id] || 30,
          label: t.title,
          variant: 'planned' as const,
        };
      });
    return [...existing, ...planned];
  }, [dayCalendarEvents, powerList, todayTasks, times, durations]);

  // Submit all
  const handleSubmitPlan = async () => {
    if (!userId) return;
    setSending(true);
    try {
      // 1. Save Power List (daily_wins + daily_win_tasks)
      let currentWinId = todayWinId;
      if (!currentWinId) {
        const parentWin = await insertDailyWin(userId, {
          user_id: userId,
          date: planningDate,
          result: null,
        });
        currentWinId = parentWin.id;
      }

      // Delete existing tasks for this daily win in the tasks table to rebuild
      const { error: deleteErr } = await supabase
        .from('daily_win_tasks')
        .delete()
        .eq('day_win_id', currentWinId);
      if (deleteErr) throw deleteErr;

      // Insert new tasks dynamically
      const taskEntries = [];
      for (let idx = 0; idx < powerList.length; idx++) {
        const task = powerList[idx];
        if (task) {
          taskEntries.push({
            day_win_id: currentWinId,
            slot: idx + 1,
            user_id: userId,
            title: task.title,
            category: idx === 0 ? 'cialo' : idx === 1 ? 'duch' : idx === 2 ? 'konto' : 'general',
            todo_id: task.id,
            done: false,
          });
        }
      }

      if (taskEntries.length > 0) {
        const { error: tasksErr } = await supabase
          .from('daily_win_tasks')
          .insert(taskEntries);
        if (tasksErr) throw tasksErr;
      }

      // 2. Schedule events in Calendar & Update Todo items
      const allSchedulable = [...todayTasks, ...powerList.filter(Boolean)] as TodoSlot[];

      // Filter uniques
      const uniqueTasksMap = new Map<string, TodoSlot>();
      allSchedulable.forEach((t) => uniqueTasksMap.set(t.id, t));

      for (const [taskId, task] of uniqueTasksMap.entries()) {
        const startTime = times[taskId];
        if (startTime) {
          const dur = durations[taskId] || 30;
          const endTime = addMinutes(startTime, dur);

          // Add to calendar
          await createEvent({
            summary: task.title,
            start: warsawIso(planningDate, startTime),
            end: warsawIso(planningDate, endTime),
            category: 'praca',
          });

          // Update DB task duration & scheduled time
          await supabase
            .from('todo_items')
            .update({
              scheduled_time: warsawIso(planningDate, startTime),
              duration_minutes: dur,
            })
            .eq('id', taskId);
        }
      }

      onClose();
    } catch (err) {
      console.error('Failed to submit daily plan:', err);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="rounded-2xl bg-background border border-border-custom/50 p-6 flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          <span className="text-[12px] font-bold text-text-muted">Wczytywanie rytuału planowania...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end sm:justify-center items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onClose} />

      {/* Sheet / Dialog */}
      <div className="relative w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-background border border-border-custom/60 shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[750px] overflow-hidden">

        {/* Header */}
        <div className="p-4 border-b border-border-custom/20 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-[15px] font-black text-text-primary uppercase tracking-wider">
              {isPlanningTomorrow ? 'Zaplanuj Jutro' : 'Planowanie Poranne'}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-semibold text-text-muted">{planningDate}</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">Krok {step} z 3</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Week-at-a-glance strip — visible across all steps for context */}
        <div className="flex items-stretch gap-0.5 px-3 pt-2.5 pb-1.5 border-b border-border-custom/10 shrink-0">
          {weekDays.map((d) => {
            const isTarget = d === planningDate;
            const isRealToday = d === actualToday;
            const hours = weekCalendarEvents
              .filter((e) => e.start_time && isoDateStr(e.start_time) === d)
              .reduce((sum, e) => sum + (e.end_time ? isoDurationMin(e.start_time, e.end_time) : 0), 0) / 60;
            const taskCount = weekTaskCounts[d] || 0;
            const loadPct = Math.min(100, (hours / CAPACITY_HOURS) * 100);
            const weekdayLabel = new Date(`${d}T12:00:00Z`).toLocaleDateString('pl-PL', { weekday: 'short' }).replace('.', '');
            const dayNum = Number(d.slice(8, 10));
            return (
              <div
                key={d}
                className={`flex-1 flex flex-col items-center gap-1 rounded-xl py-1.5 transition-colors ${isTarget ? 'bg-primary/10' : ''}`}
              >
                <span className={`text-[8px] font-black uppercase tracking-wide ${isTarget ? 'text-primary' : 'text-text-muted/70'}`}>
                  {weekdayLabel}
                </span>
                <span
                  className={`text-[11px] font-black ${
                    isTarget ? 'text-primary' : isRealToday ? 'text-text-primary' : 'text-text-secondary'
                  }`}
                >
                  {dayNum}
                </span>
                <div className="w-4 h-1 rounded-full bg-border-custom/30 overflow-hidden">
                  <div className="h-full bg-primary/50" style={{ width: `${loadPct}%` }} />
                </div>
                <span className="text-[7px] font-bold text-text-muted/60 h-2.5">{taskCount > 0 ? `${taskCount}z` : ''}</span>
              </div>
            );
          })}
        </div>

        {/* Wizard Progress Line */}
        <div className="grid grid-cols-3 h-1 bg-border-custom/20 shrink-0">
          <div className={`h-full transition-all duration-300 ${step >= 1 ? 'bg-primary' : 'bg-transparent'}`} />
          <div className={`h-full transition-all duration-300 ${step >= 2 ? 'bg-primary' : 'bg-transparent'}`} />
          <div className={`h-full transition-all duration-300 ${step >= 3 ? 'bg-primary' : 'bg-transparent'}`} />
        </div>

        {/* Content Box */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* STEP 1: Leftover Review */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-[13px] font-black text-text-primary">
                  {isPlanningTomorrow ? 'Co zostało z dzisiaj?' : 'Co zostało z wczoraj?'}
                </h3>
                <p className="text-[10px] text-text-muted mt-0.5">Zweryfikuj zaległe zadania, aby utrzymać czysty Inbox.</p>
              </div>

              {yesterdayTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border-custom/60 rounded-2xl bg-surface/20">
                  <CheckCircle2 size={32} className="text-emerald-400 mb-2" />
                  <span className="text-[12px] font-bold text-text-primary">Wszystko czyste!</span>
                  <span className="text-[10px] text-text-muted mt-0.5">Brak zaległych zadań.</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {yesterdayTasks.map((task) => (
                    <div key={task.id} className="p-3 bg-slate-50 dark:bg-white/[0.01] border border-border-custom/40 rounded-xl space-y-2.5">
                      <div className="flex items-start gap-2">
                        <span className={`text-[9px] font-black mt-0.5 ${PRIORITY_COLORS[task.priority] || 'text-text-muted'}`}>
                          {task.priority === 'urgent' ? '!!' : task.priority === 'high' ? '!' : '·'}
                        </span>
                        <span className="text-[12px] font-semibold text-text-primary flex-1 break-words">{task.title}</span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => handleYesterdayAction(task.id, 'today')}
                          className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary/20 transition-colors"
                        >
                          Na {dayWord}
                        </button>
                        <button
                          onClick={() => handleYesterdayAction(task.id, 'later')}
                          className="px-2 py-1 rounded-lg bg-surface border border-border-custom/80 text-text-primary text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-white/[0.03] transition-colors"
                        >
                          Później
                        </button>
                        <button
                          onClick={() => handleYesterdayAction(task.id, 'backlog')}
                          className="px-2 py-1 rounded-lg bg-surface border border-border-custom/80 text-text-muted text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-white/[0.03] transition-colors"
                        >
                          Backlog
                        </button>
                        <button
                          onClick={() => handleYesterdayAction(task.id, 'done')}
                          className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-[10px] font-bold hover:bg-emerald-500/20 transition-colors ml-auto"
                        >
                          Zrobione
                        </button>
                        <button
                          onClick={() => handleYesterdayAction(task.id, 'drop')}
                          className="p-1.5 rounded-lg text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Power List (Priorities Selection) */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-[13px] font-black text-text-primary">Twoja {dayWordAcc} Power List</h3>
                <p className="text-[10px] text-text-muted mt-0.5">Wybierz 3-5 najważniejszych zadań (Zwycięstw) na {dayWord}.</p>
              </div>

              {/* Power List slots */}
              <div className="space-y-2 bg-slate-50 dark:bg-white/[0.015] border border-border-custom/50 p-3 rounded-2xl">
                <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block mb-1">Sloty Power List</span>
                {powerList.map((slot, idx) => (
                  <div
                    key={idx}
                    onClick={() => setActiveSlotIdx(idx)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      activeSlotIdx === idx
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : slot
                        ? 'border-border-custom/40 bg-surface'
                        : 'border-dashed border-border-custom/60 bg-transparent hover:bg-surface/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-border-custom/30 flex items-center justify-center text-[10px] font-bold text-text-muted">
                        {idx + 1}
                      </div>
                      <span className={`text-[12px] font-semibold ${slot ? 'text-text-primary' : 'text-text-muted/50 italic'}`}>
                        {slot ? slot.title : 'Wybierz zadanie do tego slotu...'}
                      </span>
                    </div>
                    {slot && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearSlot(idx);
                        }}
                        className="p-1 text-text-muted hover:text-rose-500 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Selection list */}
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">Dostępne zadania na {dayWord} i Inbox</span>
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {[...todayTasks, ...inboxTasks].length === 0 ? (
                    <p className="text-[11px] text-text-muted italic py-4 text-center">Brak wolnych zadań</p>
                  ) : (
                    [...todayTasks, ...inboxTasks].map((task) => {
                      const isUsed = powerList.some((s) => s?.id === task.id);
                      return (
                        <button
                          key={task.id}
                          disabled={isUsed || activeSlotIdx === null}
                          onClick={() => handleAssignToSlot(task)}
                          className={`w-full text-left p-2 rounded-xl border transition-all flex items-center justify-between ${
                            isUsed
                              ? 'opacity-40 border-border-custom/20 bg-surface-solid/10'
                              : activeSlotIdx !== null
                              ? 'border-primary/40 hover:border-primary bg-surface hover:bg-primary/[0.02]'
                              : 'border-border-custom/30 bg-surface'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-[9px] font-black ${PRIORITY_COLORS[task.priority] || 'text-text-muted'}`}>
                              {task.priority === 'urgent' ? '!!' : task.priority === 'high' ? '!' : '·'}
                            </span>
                            <span className="text-[12px] font-semibold text-text-primary truncate">{task.title}</span>
                          </div>
                          {task.duration_minutes && (
                            <span className="text-[9px] font-bold text-text-muted bg-border-custom/20 px-1.5 py-0.5 rounded shrink-0">
                              {task.duration_minutes}m
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Time-boxing & Capacity Guardrail */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-[13px] font-black text-text-primary">Time-boxing w kalendarzu</h3>
                <p className="text-[10px] text-text-muted mt-0.5">Zaplanuj dokładny czas na wykonanie zadań ({dayWord}).</p>
              </div>

              {/* Workload Capacity indicator */}
              <div className="p-3.5 bg-slate-50 dark:bg-white/[0.015] border border-border-custom/50 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Zapełnienie {dayWordGen} dnia</span>
                  <span className={`text-[11px] font-black ${isOverloaded ? 'text-rose-500' : 'text-primary'}`}>
                    {capacityHoursPlanned}h / {CAPACITY_HOURS}h
                  </span>
                </div>
                <div className="h-2 rounded-full bg-border-custom/30 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${isOverloaded ? 'bg-rose-500' : capacityPct > 75 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                    style={{ width: `${capacityPct}%` }}
                  />
                </div>
                {isOverloaded && (
                  <div className="flex items-start gap-1.5 p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-[10px] font-semibold">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                    <span>Ostrzeżenie przed przeładowaniem! Zaplanowany czas przekracza 8h. Rozważ odłożenie części zadań na inny dzień, by zapobiec wypaleniu.</span>
                  </div>
                )}
                <div className="text-[9px] text-text-muted/60 font-semibold flex items-center justify-between">
                  <span>Czas spotkań w kalendarzu: {Math.round(calendarMeetingMinutes / 60 * 10) / 10}h</span>
                  <span>Czas zaplanowanych zadań: {Math.round((totalMinutesPlanned - calendarMeetingMinutes) / 60 * 10) / 10}h</span>
                </div>
              </div>

              {/* Visual day timeline — existing calendar events vs. task times being assigned below */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">Podgląd kalendarza {dayWordGen} dnia</span>
                <DayTimeline blocks={timelineBlocks} />
              </div>

              {/* Today's Tasks scheduling list */}
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">Zaplanuj godziny dla zadań</span>
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {[...powerList.filter(Boolean), ...todayTasks].filter((t, idx, self) => self.findIndex((x) => x?.id === t?.id) === idx).map((task) => (
                    <div
                      key={task!.id}
                      className="p-3 bg-slate-50 dark:bg-white/[0.01] border border-border-custom/30 rounded-xl flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-[12px] font-semibold text-text-primary block truncate">{task!.title}</span>
                        {/* Check if power list */}
                        {powerList.some((s) => s?.id === task!.id) && (
                          <span className="inline-block mt-0.5 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 tracking-wider">
                            Power List
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <input
                          type="time"
                          value={times[task!.id] || ''}
                          onChange={(e) => setTimes((prev) => ({ ...prev, [task!.id]: e.target.value }))}
                          className="rounded-xl border border-border-custom/60 bg-surface-solid/50 px-2 py-1.5 text-[11px] font-bold text-text-primary outline-none focus:border-primary/40 cursor-pointer"
                          style={{ width: 85 }}
                        />
                        <div className="flex items-center gap-1 bg-surface-solid/40 border border-border-custom/40 rounded-xl px-2 py-1">
                          <input
                            type="number"
                            min="5"
                            step="5"
                            value={durations[task!.id] || 30}
                            onChange={(e) => setDurations((prev) => ({ ...prev, [task!.id]: Math.max(5, Number(e.target.value)) }))}
                            className="bg-transparent text-[11px] font-bold text-text-primary w-8 text-center outline-none"
                          />
                          <span className="text-[9px] text-text-muted font-bold">m</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border-custom/20 flex items-center justify-between shrink-0">
          {step > 1 ? (
            <button
              onClick={() => setStep((prev) => (prev - 1) as 1 | 2 | 3)}
              className="px-4 py-3 rounded-xl border border-border-custom/80 text-text-primary text-[12px] font-black hover:bg-slate-100 dark:hover:bg-white/[0.03] transition-all flex items-center gap-1.5"
            >
              <ChevronLeft size={16} />
              Wróć
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep((prev) => (prev + 1) as 1 | 2 | 3)}
              className="px-5 py-3 rounded-xl bg-primary text-white text-[12px] font-black hover:bg-primary/95 transition-all flex items-center gap-1.5 ml-auto"
            >
              Dalej
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmitPlan}
              disabled={sending}
              className="px-5 py-3 rounded-xl bg-primary text-white text-[12px] font-black hover:bg-primary/95 transition-all flex items-center gap-1.5 ml-auto shadow-lg shadow-primary/10 disabled:opacity-40"
            >
              <Send size={14} />
              {sending ? 'Zapisuję plan...' : `Zatwierdź Plan${dayWordCap === 'Jutro' ? ' na Jutro' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
