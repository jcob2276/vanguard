import { useMemo, useState } from 'react';
import {
  updateTodoDueDate,
  deleteDailyWinTasks,
  insertDailyWinTasks,
  updateTodoScheduledTime,
} from '../../../lib/morningPlanApi';
import { useCalendarWrite } from '../../calendar/hooks/useCalendarWrite';
import { combineDateTimeWarsawISO } from '../../../lib/date';
import { insertDailyWin } from '../../../lib/goal/goalSpine.mutations';
import { notify } from '../../../lib/notify';
import { addMinutes, isoDateStr, isoDurationMin, isoMinutesOfDay } from './morningPlanHelpers';
import { TodoSlot, CalEvent } from './types';
import { CAPACITY_HOURS } from './useMorningPlanData';
import { TimelineBlock } from '../../shared/DayTimeline';

interface UseMorningPlanActionsArgs {
  userId: string | undefined;
  planningDate: string;
  onClose: () => void;
  yesterdayTasks: TodoSlot[];
  setYesterdayTasks: React.Dispatch<React.SetStateAction<TodoSlot[]>>;
  todayTasks: TodoSlot[];
  setTodayTasks: React.Dispatch<React.SetStateAction<TodoSlot[]>>;
  setInboxTasks: React.Dispatch<React.SetStateAction<TodoSlot[]>>;
  powerList: (TodoSlot | null)[];
  setPowerList: React.Dispatch<React.SetStateAction<(TodoSlot | null)[]>>;
  todayWinId: string | null;
  times: Record<string, string>;
  durations: Record<string, number>;
  weekCalendarEvents: CalEvent[];
}

export function useMorningPlanActions({
  userId,
  planningDate,
  onClose,
  yesterdayTasks,
  setYesterdayTasks,
  todayTasks,
  setTodayTasks,
  setInboxTasks,
  powerList,
  setPowerList,
  todayWinId,
  times,
  durations,
  weekCalendarEvents,
}: UseMorningPlanActionsArgs) {
  const [activeSlotIdx, setActiveSlotIdx] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  const { createEvent } = useCalendarWrite({ userId });

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
      await updateTodoDueDate(taskId, action, planningDate);
    } catch (e: unknown) {
      console.error('Error handling yesterday task action:', e);
      notify('Nie udało się zaktualizować zadania', 'error');
      revert();
    }
  };

  const handleAssignToSlot = (task: TodoSlot) => {
    if (activeSlotIdx === null) return;

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

  const dayCalendarEvents = useMemo(
    () => weekCalendarEvents.filter((e) => e.start_time && isoDateStr(e.start_time) === planningDate),
    [weekCalendarEvents, planningDate],
  );

  const calendarMeetingMinutes = useMemo(
    () => dayCalendarEvents.reduce((sum, e) => sum + (e.end_time ? isoDurationMin(e.start_time, e.end_time) : 0), 0),
    [dayCalendarEvents],
  );

  const totalMinutesPlanned = useMemo(() => {
    let sum = calendarMeetingMinutes;
    const todayTaskIds = new Set(todayTasks.map((t) => t.id));
    const powerListTaskIds = new Set(powerList.filter(Boolean).map((t) => t!.id));

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

  const handleSubmitPlan = async () => {
    if (!userId) return;
    setSending(true);
    try {
      let currentWinId = todayWinId;
      if (!currentWinId) {
        const parentWin = await insertDailyWin(userId, {
          user_id: userId,
          date: planningDate,
          result: null,
        });
        currentWinId = parentWin.id;
      }

      await deleteDailyWinTasks(currentWinId);
 
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
        await insertDailyWinTasks(taskEntries);
      }

      const allSchedulable = [...todayTasks, ...powerList.filter(Boolean)] as TodoSlot[];
      const uniqueTasksMap = new Map<string, TodoSlot>();
      allSchedulable.forEach((t) => uniqueTasksMap.set(t.id, t));

      for (const [taskId, task] of uniqueTasksMap.entries()) {
        const startTime = times[taskId];
        if (startTime) {
          const dur = durations[taskId] || 30;
          const endTime = addMinutes(startTime, dur);

          await createEvent({
            summary: task.title,
            start: combineDateTimeWarsawISO(planningDate, startTime),
            end: combineDateTimeWarsawISO(planningDate, endTime),
            category: 'praca',
          });

          await updateTodoScheduledTime(
            taskId,
            combineDateTimeWarsawISO(planningDate, startTime),
            dur
          );
        }
      }

      onClose();
    } catch (err: unknown) {
      console.error('[Action Error]', err);
      notify(err instanceof Error ? err.message : 'Wystąpił błąd', 'error');
    } finally {
      setSending(false);
    }
  };

  return {
    sending,
    activeSlotIdx,
    setActiveSlotIdx,
    handleYesterdayAction,
    handleAssignToSlot,
    handleClearSlot,
    dayCalendarEvents,
    calendarMeetingMinutes,
    totalMinutesPlanned,
    capacityPct,
    capacityHoursPlanned,
    isOverloaded,
    timelineBlocks,
    handleSubmitPlan,
  };
}
