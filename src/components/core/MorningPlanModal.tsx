import { useMemo, useState } from 'react';
import { X, ChevronRight, ChevronLeft, Send } from 'lucide-react';
import { getTodayWarsaw, shiftDateStr } from '../../lib/date';
import { getWeekStartWarsaw } from '../../lib/growth/growth';
import Spinner from '../ui/Spinner';
import { Session } from '@supabase/supabase-js';
import { useMorningPlanData } from './morningPlan/useMorningPlanData';
import { useMorningPlanActions } from './morningPlan/useMorningPlanActions';
import { isoDateStr, isoDurationMin } from './morningPlan/morningPlanHelpers';
import { CAPACITY_HOURS } from './morningPlan/useMorningPlanData';
import MorningPlanStep1Review from './morningPlan/MorningPlanStep1Review';
import MorningPlanStep2PowerList from './morningPlan/MorningPlanStep2PowerList';
import MorningPlanStep3TimeBox from './morningPlan/MorningPlanStep3TimeBox';

interface Props {
  session: Session;
  onClose: () => void;
  /** Date being planned (YYYY-MM-DD). Defaults to today; pass tomorrow's date
   * to chain this straight out of the evening shutdown ritual. */
  targetDate?: string;
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

  const data = useMorningPlanData({ userId, planningDate, isPlanningTomorrow });

  const actions = useMorningPlanActions({
    userId,
    accessToken,
    planningDate,
    onClose,
    yesterdayTasks: data.yesterdayTasks,
    setYesterdayTasks: data.setYesterdayTasks,
    todayTasks: data.todayTasks,
    setTodayTasks: data.setTodayTasks,
    setInboxTasks: data.setInboxTasks,
    powerList: data.powerList,
    setPowerList: data.setPowerList,
    todayWinId: data.todayWinId,
    times: data.times,
    durations: data.durations,
    weekCalendarEvents: data.weekCalendarEvents,
  });

  const weekStart = useMemo(() => getWeekStartWarsaw(planningDate), [planningDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftDateStr(weekStart, i)), [weekStart]);

  if (data.loading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="rounded-2xl bg-background border border-border-custom/50 p-6 flex flex-col items-center gap-3">
          <Spinner size="md" />
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

        {/* Week-at-a-glance strip */}
        <div className="flex items-stretch gap-0.5 px-3 pt-2.5 pb-1.5 border-b border-border-custom/10 shrink-0">
          {weekDays.map((d) => {
            const isTarget = d === planningDate;
            const isRealToday = d === actualToday;
            const hours = data.weekCalendarEvents
              .filter((e) => e.start_time && isoDateStr(e.start_time) === d)
              .reduce((sum, e) => sum + (e.end_time ? isoDurationMin(e.start_time, e.end_time) : 0), 0) / 60;
            const taskCount = data.weekTaskCounts[d] || 0;
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
          {step === 1 && (
            <MorningPlanStep1Review
              yesterdayTasks={data.yesterdayTasks}
              dayWord={dayWord}
              onAction={actions.handleYesterdayAction}
            />
          )}

          {step === 2 && (
            <MorningPlanStep2PowerList
              powerList={data.powerList}
              todayTasks={data.todayTasks}
              inboxTasks={data.inboxTasks}
              nutritionTarget={data.nutritionTarget}
              dayWord={dayWord}
              dayWordAcc={dayWordAcc}
              activeSlotIdx={actions.activeSlotIdx}
              setActiveSlotIdx={actions.setActiveSlotIdx}
              onAssign={actions.handleAssignToSlot}
              onClear={actions.handleClearSlot}
            />
          )}

          {step === 3 && (
            <MorningPlanStep3TimeBox
              powerList={data.powerList}
              todayTasks={data.todayTasks}
              times={data.times}
              durations={data.durations}
              setTimes={data.setTimes}
              setDurations={data.setDurations}
              capacityHoursPlanned={actions.capacityHoursPlanned}
              capacityPct={actions.capacityPct}
              isOverloaded={actions.isOverloaded}
              calendarMeetingMinutes={actions.calendarMeetingMinutes}
              totalMinutesPlanned={actions.totalMinutesPlanned}
              timelineBlocks={actions.timelineBlocks}
              dayWord={dayWord}
              dayWordGen={dayWordGen}
            />
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
              onClick={actions.handleSubmitPlan}
              disabled={actions.sending}
              className="px-5 py-3 rounded-xl bg-primary text-white text-[12px] font-black hover:bg-primary/95 transition-all flex items-center gap-1.5 ml-auto shadow-lg shadow-primary/10 disabled:opacity-40"
            >
              <Send size={14} />
              {actions.sending ? 'Zapisuję plan...' : `Zatwierdź Plan${dayWordCap === 'Jutro' ? ' na Jutro' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
