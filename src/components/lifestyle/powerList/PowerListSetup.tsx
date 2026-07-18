import { ArrowRight, Link2, LockKeyhole, X } from 'lucide-react';
import { Card } from '../../ui/Card';
import Badge from '../../ui/Badge';
import { ControlInput, Pressable } from '../../ui/ControlPrimitives';
import PlanningCheckpointsStrip from '../../shared/PlanningCheckpointsStrip';
import type { TodoItemRow } from '../../../lib/todo/todo';
import type { useDirectionContext } from '../direction/hooks/useDirectionContext';
import type { DailyWinWithTasks, TaskSlot } from '../usePowerListData';
import { AiHelper, YesterdayRecap } from './PowerListSetupCards';
import PowerListSetupHeader from './PowerListSetupHeader';
import { PRIORITY_DOT, SPHERE_SLOTS } from './powerListConstants';
import TodoPicker from './TodoPicker';

interface Props {
  yesterdayWin: DailyWinWithTasks | null;
  yesterdayNote: string;
  setYesterdayNote: (value: string) => void;
  yesterdayNoteRequired: boolean;
  direction: ReturnType<typeof useDirectionContext>;
  fillSlotFromCheckpoint: (checkpoint: { title: string; checkpointId: string; projectId: string }) => void;
  occupiedSlots: boolean[];
  aiQuestions: string | null;
  aiLoading: boolean;
  generateQuestions: () => void;
  newTaskForm: TaskSlot[];
  updateSlot: (index: number, update: Partial<TaskSlot>) => void;
  todoItems: TodoItemRow[];
  pickerSlot: number;
  setPickerSlot: (value: number) => void;
  pickerRef: React.RefObject<HTMLDivElement | null>;
  startNewDay: () => void;
  submitting: boolean;
}

export default function PowerListSetup({
  yesterdayWin, yesterdayNote, setYesterdayNote, yesterdayNoteRequired,
  direction, fillSlotFromCheckpoint, occupiedSlots, aiQuestions, aiLoading,
  generateQuestions, newTaskForm, updateSlot, todoItems, pickerSlot,
  setPickerSlot, pickerRef, startNewDay, submitting,
}: Props) {
  const filledCount = newTaskForm.filter((slot) => slot.task.trim()).length;
  const reflectionReady = !yesterdayNoteRequired || Boolean(yesterdayNote.trim());
  const ready = reflectionReady && filledCount === 5;
  const missingTasks = 5 - filledCount;

  return (
    <Card variant="glass" padding="0.75rem" className="space-y-3">
      <PowerListSetupHeader reflectionRequired={yesterdayNoteRequired} reflectionReady={reflectionReady} filledCount={filledCount} />
      <YesterdayRecap yesterdayWin={yesterdayWin} yesterdayNote={yesterdayNote} setYesterdayNote={setYesterdayNote} yesterdayNoteRequired={yesterdayNoteRequired} />
      <PlanningCheckpointsStrip checkpoints={[...direction.checkpoints.overdue, ...direction.checkpoints.upcoming]} loading={direction.loading} onFillSlot={fillSlotFromCheckpoint} occupiedSlots={occupiedSlots} />

      <div className="px-1 pt-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-2xs font-black uppercase tracking-widest text-primary">Plan dnia</p>
            <h3 className="mt-1 font-display text-base font-black tracking-tight text-text-primary">Pięć dzisiejszych zwycięstw</h3>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-2xs font-black ${filledCount === 5 ? 'bg-success/10 text-success' : 'bg-surface-tonal text-text-secondary'}`} aria-live="polite">{filledCount} / 5</span>
        </div>
        <p className="mt-1.5 text-xs font-medium leading-relaxed text-text-secondary">
          Wpisz własne zadania lub wybierz je z <span className="inline-flex items-center gap-1 font-bold text-primary">To-do <Link2 size={10} /></span>.
        </p>
      </div>

      <AiHelper aiLoading={aiLoading} aiQuestions={aiQuestions} generateQuestions={generateQuestions} />

      <div className="space-y-2" ref={pickerRef}>
        {newTaskForm.map((slot, index) => {
          const sphere = index < 3 ? SPHERE_SLOTS[index] : null;
          const SphereIcon = sphere?.icon;
          return (
            <div key={index}>
              <div className={`group flex items-center gap-2 rounded-xl border bg-surface-solid shadow-[var(--shadow-inner)] transition-[transform,border-color,background-color,box-shadow] ease-[var(--spring)] ${pickerSlot === index ? 'border-primary/40 bg-primary/[0.03] shadow-[var(--shadow-card)]' : 'border-border-custom'}`}>
                <span className="ml-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-tonal text-2xs font-black text-text-muted">{index + 1}</span>
                {sphere && SphereIcon ? <Badge variant="tag" className="shrink-0"><SphereIcon size={8} /> {sphere.label}</Badge> : <Badge variant="tag" className="shrink-0">Własne</Badge>}
                {slot.todoId ? (
                  <div className="flex min-w-0 flex-1 items-center gap-2 py-3.5 pr-1">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[todoItems.find((item) => item.id === slot.todoId)?.priority ?? ''] || 'bg-info'}`} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">{slot.task}</span>
                  </div>
                ) : (
                  <ControlInput placeholder={sphere?.placeholder ?? `Zadanie ${index + 1}`} value={slot.task} onChange={(event) => updateSlot(index, { task: event.target.value })} className="min-w-0 flex-1 bg-transparent py-3.5 pr-1 text-sm font-medium text-text-primary placeholder:text-text-muted/50" />
                )}
                <Pressable onClick={() => slot.todoId ? updateSlot(index, { task: '', todoId: null }) : setPickerSlot(pickerSlot === index ? -1 : index)} className={`mr-3 shrink-0 rounded-full p-1.5 ${pickerSlot === index ? 'bg-primary/15 text-primary' : 'text-text-muted hover:bg-primary/10 hover:text-primary'}`} title={slot.todoId ? 'Usuń powiązanie' : 'Wybierz z To-do'}>
                  {slot.todoId ? <X size={14} /> : <Link2 size={14} />}
                </Pressable>
              </div>
              {pickerSlot === index ? (
                <TodoPicker items={todoItems.filter((item) => !newTaskForm.some((candidate, candidateIndex) => candidateIndex !== index && candidate.todoId === item.id))} onSelect={(item) => updateSlot(index, { task: item.title, todoId: item.id, checkpointId: null, pinId: null })} onClose={() => setPickerSlot(-1)} />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="rounded-[var(--radius-lg)] border border-border-custom bg-surface-solid p-3 shadow-[var(--shadow-card)]">
        <p className="mb-2.5 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-text-secondary" aria-live="polite">
          {ready ? 'Wszystko gotowe. Możesz zacząć dzień.' : !reflectionReady ? <><LockKeyhole size={12} /> Najpierw zapisz krótką refleksję.</> : <><LockKeyhole size={12} /> {missingTasks === 1 ? 'Brakuje jednego zadania.' : `Brakuje ${missingTasks} zadań.`}</>}
        </p>
        <Pressable onClick={startNewDay} disabled={submitting || !ready} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-display text-sm font-bold text-on-accent shadow-[var(--shadow-glow-primary)] hover:bg-primary-hover disabled:bg-surface-tonal disabled:text-text-muted disabled:shadow-none">
          {ready ? <ArrowRight size={15} /> : <LockKeyhole size={14} />}
          {submitting ? 'Zapisywanie…' : ready ? 'Zacznij dzień' : 'Dokończ rytuał'}
        </Pressable>
      </div>
    </Card>
  );
}
