import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { getTodayWarsaw, shiftDateStr } from '../../lib/date';
import { getWeekStartWarsaw } from '../../lib/growth/growth';
import Spinner from '../ui/Spinner';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useUserId } from '../../store/useStore';
import { useMorningPlanData } from './morningPlan/useMorningPlanData';
import { useMorningPlanActions } from './morningPlan/useMorningPlanActions';
import MorningPlanWeekStrip from './morningPlan/MorningPlanWeekStrip';
import MorningPlanFooterActions from './morningPlan/MorningPlanFooterActions';
import MorningPlanStep1Review from './morningPlan/MorningPlanStep1Review';
import MorningPlanStep2PowerList from './morningPlan/MorningPlanStep2PowerList';
import MorningPlanStep3TimeBox from './morningPlan/MorningPlanStep3TimeBox';

interface Props {
  onClose: () => void;
  /** Date being planned (YYYY-MM-DD). Defaults to today; pass tomorrow's date
   * to chain this straight out of the evening shutdown ritual. */
  targetDate?: string;
}

export default function MorningPlanModal({ onClose, targetDate }: Props) {
  const userId = useUserId();
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
      <Modal isOpen={true} onClose={onClose} showCloseButton={false} padding="p-6" size="xs" overlayClassName="z-[60]" closeOnBackdropClick={false}>
        <div className="flex flex-col items-center gap-3">
          <Spinner size="md" />
          <span className="text-sm font-bold text-text-muted">Wczytywanie rytuału planowania...</span>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      showCloseButton={false}
      padding="p-0"
      overflowY={false}
      size="lg"
      overlayClassName="z-[60]"
    >
      {/* Sheet / Dialog */}
      <div className="relative w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-background border border-border-custom/60 shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[750px] overflow-hidden">

        {/* Header */}
        <div className="p-4 border-b border-border-custom/20 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-black text-text-primary uppercase tracking-wider">
              {isPlanningTomorrow ? 'Zaplanuj Jutro' : 'Planowanie Poranne'}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-semibold text-text-muted">{planningDate}</span>
              <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">Krok {step} z 3</span>
            </div>
          </div>
          <Button onClick={onClose} variant="ghost" icon={<X size={18} />} className="p-1.5" />
        </div>

        {/* Week-at-a-glance strip */}
        <MorningPlanWeekStrip
          weekDays={weekDays}
          planningDate={planningDate}
          actualToday={actualToday}
          weekCalendarEvents={data.weekCalendarEvents}
          weekTaskCounts={data.weekTaskCounts}
        />

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

        <MorningPlanFooterActions
          step={step}
          setStep={setStep}
          dayWordCap={dayWordCap}
          sending={actions.sending}
          onSubmit={actions.handleSubmitPlan}
        />
      </div>
    </Modal>
  );
}
