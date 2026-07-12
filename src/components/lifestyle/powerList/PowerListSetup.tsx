import { Sparkles, Link2, X, Upload } from 'lucide-react';
import PlanningCheckpointsStrip from '../../shared/PlanningCheckpointsStrip';
import TodoPicker from './TodoPicker';
import { SPHERE_SLOTS, PRIORITY_DOT } from './powerListConstants';
import { type TaskSlot, type DailyWinWithTasks } from '../usePowerListData';
import type { Tables } from '../../../lib/database.types';
import type { DirectionContextData } from '../../../lib/dailyPlanProposal';
import type { TodoItemRow } from '../../../lib/todo/todo';

interface YesterdayRecapProps {
  yesterdayWin: DailyWinWithTasks | null;
  yesterdayNote: string;
  setYesterdayNote: (v: string) => void;
  yesterdayNoteRequired: boolean;
}

function YesterdayRecap({
  yesterdayWin,
  yesterdayNote,
  setYesterdayNote,
  yesterdayNoteRequired,
}: YesterdayRecapProps) {
  if (!yesterdayWin) return null;
  return (
    <div className="space-y-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3.5">
      <p className="text-[8px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
        Zanim zaczniesz dziś — wczoraj ({yesterdayWin.date})
      </p>
      <ul className="space-y-1">
        {(yesterdayWin.daily_win_tasks || []).map((t: Tables<'daily_win_tasks'>) => (
          <li key={t.id} className="flex items-center gap-2 text-[11px] font-medium">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${t.done ? 'bg-dayC' : 'bg-text-muted/30'}`} />
            <span className={t.done ? 'text-text-secondary line-through opacity-70' : 'text-text-primary'}>
              {t.title}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-text-muted leading-relaxed">
        Dlaczego zrealizowałeś / nie zrealizowałeś te zadania?{' '}
        {yesterdayNoteRequired && (
          <span className="font-bold text-amber-600 dark:text-amber-400">(wymagane)</span>
        )}
      </p>
      <textarea
        value={yesterdayNote}
        onChange={(e) => setYesterdayNote(e.target.value)}
        placeholder="Napisz szczerze…"
        rows={3}
        className="w-full bg-surface-solid border border-border-custom rounded-xl px-3 py-2 text-sm
          text-text-primary placeholder-text-muted resize-y min-h-[64px]
          focus:outline-none focus:border-primary/50 transition-colors"
      />
    </div>
  );
}

interface AiHelperProps {
  aiLoading: boolean;
  aiQuestions: string | null;
  generateQuestions: () => void;
}

function AiHelper({ aiLoading, aiQuestions, generateQuestions }: AiHelperProps) {
  return (
    <div className="rounded-xl border border-primary/10 bg-primary/[0.02] p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-primary">
          <Sparkles size={12} className="animate-pulse" /> Asystent AI
        </span>
        <button
          type="button"
          onClick={generateQuestions}
          disabled={aiLoading}
          className="rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-primary transition-all hover:bg-primary/10 active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {aiLoading ? 'Analizowanie...' : aiQuestions ? '🔄 Zadaj inne pytania' : '❓ Pomoc AI (Zadaj pytania)'}
        </button>
      </div>

      {aiQuestions && (
        <div className="rounded-lg border border-border-custom bg-surface p-3 text-left animate-in fade-in duration-300">
          <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-1.5 font-display">Pytania do przemyślenia:</p>
          <div className="text-[11px] font-semibold text-text-primary leading-relaxed whitespace-pre-line">
            {aiQuestions}
          </div>
        </div>
      )}
    </div>
  );
}

interface PowerListSetupProps {
  yesterdayWin: DailyWinWithTasks | null;
  yesterdayNote: string;
  setYesterdayNote: (v: string) => void;
  yesterdayNoteRequired: boolean;
  direction: DirectionContextData | null;
  fillSlotFromCheckpoint: (checkpoint: { title: string; checkpointId: string; projectId: string }) => void;
  occupiedSlots: boolean[];
  aiQuestions: string | null;
  aiLoading: boolean;
  generateQuestions: () => void;
  newTaskForm: TaskSlot[];
  updateSlot: (i: number, u: Partial<TaskSlot>) => void;
  todoItems: TodoItemRow[];
  pickerSlot: number;
  setPickerSlot: (v: number) => void;
  pickerRef: React.RefObject<HTMLDivElement | null>;
  startNewDay: () => void;
  submitting: boolean;
}

export default function PowerListSetup({
  yesterdayWin,
  yesterdayNote,
  setYesterdayNote,
  yesterdayNoteRequired,
  direction,
  fillSlotFromCheckpoint,
  occupiedSlots,
  aiQuestions,
  aiLoading,
  generateQuestions,
  newTaskForm,
  updateSlot,
  todoItems,
  pickerSlot,
  setPickerSlot,
  pickerRef,
  startNewDay,
  submitting,
}: PowerListSetupProps) {
  const filledCount = newTaskForm.filter((t) => t.task.trim()).length;
  const allFilled = filledCount === 5;

  return (
    <div className="space-y-5 rounded-[24px] border border-border-custom bg-surface p-5 shadow-sm">
      <YesterdayRecap
        yesterdayWin={yesterdayWin}
        yesterdayNote={yesterdayNote}
        setYesterdayNote={setYesterdayNote}
        yesterdayNoteRequired={yesterdayNoteRequired}
      />

      <PlanningCheckpointsStrip
        checkpoints={[...direction.checkpoints.overdue, ...direction.checkpoints.upcoming]}
        loading={direction.loading}
        onFillSlot={fillSlotFromCheckpoint}
        occupiedSlots={occupiedSlots}
      />

      <div>
        <h3 className="font-display text-[14px] font-black tracking-tight text-text-primary">
          Zdefiniuj 5 zwycięstw
        </h3>
        <p className="mt-1 text-[11px] font-medium leading-relaxed text-text-secondary">
          Wpisz ręcznie lub wybierz z{' '}
          <span className="inline-flex items-center gap-1 font-bold text-primary">
            Zadań <Link2 size={10} />
          </span>
          .
        </p>
      </div>

      <AiHelper
        aiLoading={aiLoading}
        aiQuestions={aiQuestions}
        generateQuestions={generateQuestions}
      />

      <div className="space-y-2.5" ref={pickerRef}>
        {newTaskForm.map((slot: TaskSlot, i: number) => {
          const sphere = i < 3 ? SPHERE_SLOTS[i] : null;
          const SphereIcon = sphere?.icon;
          return (
            <div key={i}>
              <div
                className={`flex items-center gap-2 rounded-xl border bg-surface transition-colors ${
                  pickerSlot === i ? 'border-primary/40 bg-surface-solid' : 'border-border-custom'
                }`}
              >
                {/* Sphere badge for slots 0-2 */}
                {sphere && SphereIcon && (
                  <span className={`ml-3 flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest ${sphere.bg} ${sphere.text}`}>
                    <SphereIcon size={8} /> {sphere.label}
                  </span>
                )}

                {slot.todoId ? (
                  <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-3">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[todoItems.find((x) => x.id === slot.todoId)?.priority ?? ''] || 'bg-blue-500'}`} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text-primary">{slot.task}</span>
                  </div>
                ) : (
                  <input
                    placeholder={sphere?.placeholder ?? `Zadanie ${i + 1}`}
                    value={slot.task}
                    onChange={(e) => updateSlot(i, { task: e.target.value })}
                    className={`min-w-0 flex-1 bg-transparent py-3 text-[13px] font-medium text-text-primary outline-none placeholder:text-text-muted/40 ${sphere ? 'px-2' : 'px-3.5'}`}
                  />
                )}

                {slot.todoId ? (
                  <button
                    onClick={() => updateSlot(i, { task: '', todoId: null })}
                    className="mr-3 shrink-0 rounded-full p-1.5 text-primary transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                    title="Usuń powiązanie"
                  >
                    <X size={14} />
                  </button>
                ) : (
                  <button
                    onClick={() => setPickerSlot(pickerSlot === i ? -1 : i)}
                    className={`mr-3 shrink-0 rounded-full p-1.5 transition-colors ${
                      pickerSlot === i ? 'bg-primary/15 text-primary' : 'text-text-muted hover:bg-primary/10 hover:text-primary'
                    }`}
                    title="Wybierz z zadań"
                  >
                    <Link2 size={14} />
                  </button>
                )}
              </div>

              {pickerSlot === i && (
                <TodoPicker
                  items={todoItems.filter((item: TodoItemRow) => !newTaskForm.some((s: TaskSlot, idx: number) => idx !== i && s.todoId === item.id))}
                  onSelect={(item) => updateSlot(i, { task: item.title, todoId: item.id, checkpointId: null, pinId: null })}
                  onClose={() => setPickerSlot(-1)}
                />
              )}
            </div>
          );
        })}
      </div>

      {!allFilled && (
        <p className="text-center text-[10px] font-bold text-text-muted">
          Wypełnione {filledCount}/5 — uzupełnij wszystkie, żeby zacząć dzień
        </p>
      )}
      <button
        onClick={startNewDay}
        disabled={submitting || !allFilled || (yesterdayNoteRequired && !yesterdayNote.trim())}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-display text-[12px] font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Upload size={14} /> {submitting ? 'Zapisywanie…' : 'Zacznij dzień'}
      </button>
    </div>
  );
}
