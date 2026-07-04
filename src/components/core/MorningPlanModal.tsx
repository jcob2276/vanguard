import { useEffect, useMemo, useState } from 'react';
import { X, CheckCircle2, Send, ChevronRight, ChevronLeft, AlertTriangle, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCalendarWrite } from '../../hooks/useCalendarWrite';
import { getTodayWarsaw, formatWarsawDate } from '../../lib/date';
import { updateDailyWin, insertDailyWin } from '../../lib/goalSpine.mutations';

interface Props {
  session: any;
  onClose: () => void;
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

export default function MorningPlanModal({ session, onClose }: Props) {
  const userId = session?.user?.id as string | undefined;
  const accessToken = session?.access_token as string | undefined;
  const today = getTodayWarsaw();

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
  const [calendarMeetingMinutes, setCalendarMeetingMinutes] = useState(0);

  const { createEvent } = useCalendarWrite({ userId, accessToken });

  // Initial load
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    (async () => {
      try {
        // 1. Fetch yesterday's (and older) open tasks
        const { data: pastData } = await supabase
          .from('todo_items')
          .select('id, title, priority, duration_minutes, due_date, scheduled_time, status')
          .eq('user_id', userId)
          .eq('status', 'open')
          .lt('due_date', today)
          .order('priority', { ascending: true });

        // 2. Fetch today's open tasks
        const { data: currentData } = await supabase
          .from('todo_items')
          .select('id, title, priority, duration_minutes, due_date, scheduled_time, status')
          .eq('user_id', userId)
          .eq('status', 'open')
          .or(`due_date.eq.${today},ai_bucket.eq.today`)
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

        // 4. Fetch today's daily win row (Power List)
        const { data: winData } = await supabase
          .from('daily_wins')
          .select('*')
          .eq('user_id', userId)
          .eq('date', today)
          .maybeSingle();

        if (winData) {
          setTodayWinId(winData.id);
          // Match existing power list items if any
          const presetList: (TodoSlot | null)[] = [null, null, null, null, null];
          for (let i = 1; i <= 5; i++) {
            const taskId = winData[`task_${i}_todo_id`];
            const taskTitle = winData[`task_${i}`];
            if (taskId) {
              // Try to find the task in today's list or create a stub
              const found = allTasks.find((t) => t.id === taskId);
              presetList[i - 1] = found || {
                id: taskId,
                title: taskTitle || 'Zadanie',
                priority: 'normal',
                duration_minutes: 30,
                due_date: today,
                scheduled_time: null,
                status: 'open',
              };
            }
          }
          setPowerList(presetList);
        }

        // 5. Fetch calendar meetings duration for today
        const { data: calData } = await supabase
          .from('vanguard_calendar')
          .select('start_time, end_time')
          .eq('user_id', userId)
          .gte('start_time', today + 'T00:00:00')
          .lte('start_time', today + 'T23:59:59');

        let meetingMins = 0;
        calData?.forEach((evt) => {
          if (evt.start_time && evt.end_time) {
            const diff = (new Date(evt.end_time).getTime() - new Date(evt.start_time).getTime()) / 60000;
            if (diff > 0) meetingMins += diff;
          }
        });
        setCalendarMeetingMinutes(meetingMins);

      } catch (err) {
        console.error('Failed to load morning planning data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, today]);

  // Yesterday reviews actions
  const handleYesterdayAction = async (taskId: string, action: 'today' | 'tomorrow' | 'backlog' | 'drop' | 'done') => {
    try {
      // Optimistic update
      const target = yesterdayTasks.find((t) => t.id === taskId);
      if (!target) return;

      setYesterdayTasks((prev) => prev.filter((t) => t.id !== taskId));

      if (action === 'today') {
        setTodayTasks((prev) => [...prev, { ...target, due_date: today }]);
        await supabase.from('todo_items').update({ due_date: today }).eq('id', taskId);
      } else if (action === 'tomorrow') {
        const tomorrowDate = new Date();
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomStr = formatWarsawDate(tomorrowDate);
        await supabase.from('todo_items').update({ due_date: tomStr }).eq('id', taskId);
      } else if (action === 'backlog') {
        setInboxTasks((prev) => [...prev, { ...target, due_date: null }]);
        await supabase.from('todo_items').update({ due_date: null }).eq('id', taskId);
      } else if (action === 'drop') {
        await supabase.from('todo_items').update({ status: 'dropped' }).eq('id', taskId);
      } else if (action === 'done') {
        await supabase.from('todo_items').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', taskId);
      }
    } catch (e) {
      console.error('Error handling yesterday task action:', e);
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

  // Submit all
  const handleSubmitPlan = async () => {
    if (!userId) return;
    setSending(true);
    try {
      // 1. Save Power List (daily_wins)
      const patch: any = {
        date: today,
        user_id: userId,
      };
      powerList.forEach((task, idx) => {
        const num = idx + 1;
        patch[`task_${num}`] = task ? task.title : null;
        patch[`task_${num}_todo_id`] = task ? task.id : null;
        patch[`done_${num}`] = false;
      });

      if (todayWinId) {
        await updateDailyWin(userId, todayWinId, patch);
      } else {
        await insertDailyWin(userId, patch);
      }

      // 2. Schedule events in Calendar & Update Todo items
      const todayTaskIds = new Set(todayTasks.map((t) => t.id));
      const powerListTaskIds = new Set(powerList.filter(Boolean).map((t) => t!.id));
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
            start: warsawIso(today, startTime),
            end: warsawIso(today, endTime),
            category: 'work',
          });

          // Update DB task duration & scheduled time
          await supabase
            .from('todo_items')
            .update({
              scheduled_time: warsawIso(today, startTime),
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
            <h2 className="text-[15px] font-black text-text-primary uppercase tracking-wider">Planowanie Poranne</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-semibold text-text-muted">{today}</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">Krok {step} z 3</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Wizard Progress Line */}
        <div className="grid grid-cols-3 h-1 bg-border-custom/20 shrink-0">
          <div className={`h-full transition-all duration-300 ${step >= 1 ? 'bg-primary' : 'bg-transparent'}`} />
          <div className={`h-full transition-all duration-300 ${step >= 2 ? 'bg-primary' : 'bg-transparent'}`} />
          <div className={`h-full transition-all duration-300 ${step >= 3 ? 'bg-primary' : 'bg-transparent'}`} />
        </div>

        {/* Content Box */}
        <div className="flex-1 overflow-y-auto p-5">
          
          {/* STEP 1: Yesterday's Review */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-[13px] font-black text-text-primary">Co zostało z wczoraj?</h3>
                <p className="text-[10px] text-text-muted mt-0.5">Zweryfikuj zaległe zadania, aby utrzymać czysty Inbox.</p>
              </div>

              {yesterdayTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border-custom/60 rounded-2xl bg-surface/20">
                  <CheckCircle2 size={32} className="text-emerald-400 mb-2" />
                  <span className="text-[12px] font-bold text-text-primary">Wszystko czyste!</span>
                  <span className="text-[10px] text-text-muted mt-0.5">Brak zaległych zadań z wczoraj.</span>
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
                          Na dziś
                        </button>
                        <button
                          onClick={() => handleYesterdayAction(task.id, 'tomorrow')}
                          className="px-2 py-1 rounded-lg bg-surface border border-border-custom/80 text-text-primary text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-white/[0.03] transition-colors"
                        >
                          Jutro
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
                <h3 className="text-[13px] font-black text-text-primary">Twoja dzisiejsza Power List</h3>
                <p className="text-[10px] text-text-muted mt-0.5">Wybierz 3-5 najważniejszych zadań (Zwycięstw) na dzisiejszy dzień.</p>
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
                <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">Dostępne zadania na dziś i Inbox</span>
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
                <p className="text-[10px] text-text-muted mt-0.5">Zaplanuj dokładny czas na wykonanie dzisiejszych zadań.</p>
              </div>

              {/* Workload Capacity indicator */}
              <div className="p-3.5 bg-slate-50 dark:bg-white/[0.015] border border-border-custom/50 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Zapełnienie dzisiejszego dnia</span>
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
              {sending ? 'Zapisuję plan...' : 'Zatwierdź Plan'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
