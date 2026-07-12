import { useEffect } from 'react';
import { Target } from 'lucide-react';
import { usePowerListData } from './usePowerListData';
import { Session } from '@supabase/supabase-js';

import PowerListHeader from './powerList/PowerListHeader';
import PowerListSetup from './powerList/PowerListSetup';
import PowerListActive from './powerList/PowerListActive';

export interface PowerListProps {
  session: Session;
  todayWin: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  onUpdate?: (data: Record<string, unknown>) => void;
  planDaySignal?: number;
}

export default function PowerList({
  session,
  todayWin,
  onUpdate,
  planDaySignal,
}: PowerListProps) {
  const {
    today,
    direction,
    projectMap,
    checkpointPrompt,
    setCheckpointPrompt,
    markingCheckpoint,
    yesterdayWin,
    yesterdayNote,
    setYesterdayNote,
    yesterdayNoteRequired,
    newTaskForm,
    todoItems,
    pickerSlot,
    setPickerSlot,
    submitting,
    pickerRef,
    aiQuestions,
    aiLoading,
    occupiedSlots,
    fillSlotFromCheckpoint,
    confirmCheckpointDone,
    generateQuestions,
    updateSlot,
    eveningCloseDue,
    toggleTask,
    startNewDay,
  } = usePowerListData({ session, todayWin, onUpdate, planDaySignal });

  // Escape key for picker slot
  useEffect(() => {
    if (pickerSlot < 0) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerSlot(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerSlot, pickerRef, setPickerSlot]);

  return (
    <section className="space-y-4">
      {/* Calendar Card showing today's date */}
      <PowerListHeader today={today} />

      <div className="flex items-end justify-between">
        <h3 className="flex items-center gap-2 font-display text-[11px] font-bold uppercase tracking-wider text-text-muted">
          <Target size={13} className="text-primary" /> 5 zwycięstw
        </h3>
        {todayWin?.result === 'Z' ? (
          <div className="rounded-full border border-dayC/15 bg-dayC/10 px-2.5 py-0.5 font-display text-[9px] font-bold text-dayC">
            Dzień wygrany
          </div>
        ) : todayWin && (() => {
          const tasks = todayWin.daily_win_tasks || [];
          const total = tasks.length;
          const doneCount = tasks.filter((t: any) => t.done).length; // eslint-disable-line @typescript-eslint/no-explicit-any
          return total > 0 ? (
            <div className="flex items-center gap-1.5">
              <div className="flex gap-1">
                {Array.from({ length: total }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${
                      i < doneCount ? 'bg-dayC' : 'bg-border-custom'
                    }`}
                  />
                ))}
              </div>
              <span className="font-display text-[9px] font-bold text-text-muted">
                {doneCount}/{total}
              </span>
            </div>
          ) : null;
        })()}
      </div>

      {!todayWin ? (
        <PowerListSetup
          yesterdayWin={yesterdayWin}
          yesterdayNote={yesterdayNote}
          setYesterdayNote={setYesterdayNote}
          yesterdayNoteRequired={yesterdayNoteRequired}
          direction={direction}
          fillSlotFromCheckpoint={fillSlotFromCheckpoint}
          occupiedSlots={occupiedSlots}
          aiQuestions={aiQuestions}
          aiLoading={aiLoading}
          generateQuestions={generateQuestions}
          newTaskForm={newTaskForm}
          updateSlot={updateSlot}
          todoItems={todoItems}
          pickerSlot={pickerSlot}
          setPickerSlot={setPickerSlot}
          pickerRef={pickerRef}
          startNewDay={startNewDay}
          submitting={submitting}
        />
      ) : (
        <PowerListActive
          checkpointPrompt={checkpointPrompt}
          setCheckpointPrompt={setCheckpointPrompt}
          markingCheckpoint={markingCheckpoint}
          confirmCheckpointDone={confirmCheckpointDone}
          todayWin={todayWin}
          projectMap={projectMap}
          toggleTask={toggleTask}
          eveningCloseDue={eveningCloseDue}
        />
      )}
    </section>
  );
}
