import { useState, useRef, useEffect } from 'react';
import { BookOpen, Link2, Search, Shield, Sparkles, Target, Upload, Wallet, Wand2, X } from 'lucide-react';
import PlanningCheckpointsStrip from '../shared/PlanningCheckpointsStrip';
import { usePowerListData, type TaskSlot } from './usePowerListData';
import PowerListTask from './PowerListTask';
import PowerListKpi from './PowerListKpi';

const SPHERE_SLOTS = [
  { category: 'cialo', label: 'Ciało', icon: Shield, text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', placeholder: 'Priorytet Ciało — co dziś?' },
  { category: 'duch',  label: 'Duch',  icon: ZapWrapper, text: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  placeholder: 'Priorytet Duch — co dziś?'  },
  { category: 'konto', label: 'Konto', icon: Wallet, text: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   placeholder: 'Priorytet Konto — co dziś?' },
];

function ZapWrapper(props: any) {
  // lucide-react Zap icon
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-emerald-500',
  normal: 'bg-blue-500',
  high: 'bg-indigo-500',
  urgent: 'bg-rose-500',
};

interface TodoPickerProps {
  items: any[];
  onSelect: (item: any) => void;
  onClose: () => void;
}

function TodoPicker({ items, onSelect, onClose }: TodoPickerProps) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div className="mt-1.5 overflow-hidden rounded-xl border border-primary/20 bg-surface shadow-lg">
      <div className="flex items-center gap-2 border-b border-border-custom px-3 py-2">
        <Search size={11} className="shrink-0 text-text-muted" />
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          placeholder="Szukaj zadania..."
          className="min-w-0 flex-1 bg-transparent text-[12px] font-medium text-text-primary outline-none placeholder:text-text-muted/40"
        />
      </div>
      <div className="max-h-[188px] overflow-y-auto p-1.5 space-y-0.5">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-[10px] font-medium text-text-muted">Brak otwartych zadań</p>
        ) : (
          filtered.slice(0, 20).map((item) => (
            <button
              key={item.key}
              onClick={() => { onSelect(item); onClose(); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-solid active:scale-[0.98]"
            >
              {item.badge ? (
                <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-primary">
                  <BookOpen size={8} /> {item.badge}
                </span>
              ) : (
                <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[item.priority] || 'bg-blue-500'}`} />
              )}
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-text-primary">{item.title}</span>
              {item.due_date && (
                <span className="shrink-0 text-[9px] font-bold text-text-muted">{item.due_date}</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export interface PowerListProps {
  session: any;
  todayWin: any;
  onUpdate?: (data: any) => void;
  planDaySignal?: number;
}

export default function PowerList({
  session,
  todayWin,
  onUpdate,
  planDaySignal,
}: PowerListProps) {
  const {
    userId,
    today,
    direction,
    projectMap,
    checkpointPrompt, setCheckpointPrompt,
    markingCheckpoint,
    yesterdayWin,
    yesterdayNote, setYesterdayNote,
    yesterdayNoteRequired,
    newTaskForm,
    todoItems,
    pickerSlot, setPickerSlot,
    submitting,
    eveningNote, setEveningNote,
    savingEvening,
    pickerRef,
    aiQuestions,
    aiLoading,
    occupiedSlots,
    fillSlotFromCheckpoint,
    applyProposal,
    confirmCheckpointDone,
    generateQuestions,
    updateSlot,
    projectOptionsForSlot,
    kpiHintForSlot,
    kpisForProject,
    eveningCloseDue,
    saveEveningClose,
    toggleTask,
    startNewDay,
    yesterdayStr
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
      <div className="flex items-end justify-between">
        <h3 className="flex items-center gap-2 font-display text-[11px] font-bold uppercase tracking-wider text-text-muted">
          <Target size={13} className="text-primary" /> 5 zwycięstw
        </h3>
        {todayWin?.result === 'Z' ? (
          <div className="rounded-full border border-dayC/15 bg-dayC/10 px-2.5 py-0.5 font-display text-[9px] font-bold text-dayC">
            Dzień wygrany
          </div>
        ) : todayWin && (() => {
          const total = [1, 2, 3, 4, 5].filter((i) => todayWin[`task_${i}`]).length;
          const doneCount = [1, 2, 3, 4, 5].filter((i) => todayWin[`task_${i}`] && todayWin[`done_${i}`]).length;
          return total > 0 ? (
            <div className="flex items-center gap-1.5">
              <div className="flex gap-1">
                {Array.from({ length: total }).map((_, i) => (
                  <span key={i} className={`h-1.5 w-1.5 rounded-full transition-colors ${i < doneCount ? 'bg-dayC' : 'bg-border-custom'}`} />
                ))}
              </div>
              <span className="font-display text-[9px] font-bold text-text-muted">{doneCount}/{total}</span>
            </div>
          ) : null;
        })()}
      </div>

      {!todayWin ? (
        <div className="space-y-5 rounded-[24px] border border-border-custom bg-surface p-5 shadow-sm">
          {yesterdayWin && (
            <div className="space-y-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3.5">
              <p className="text-[8px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                Zanim zaczniesz dziś — wczoraj ({yesterdayWin.date})
              </p>
              <ul className="space-y-1">
                {[1, 2, 3, 4, 5].map((i) => yesterdayWin[`task_${i}`] && (
                  <li key={i} className="flex items-center gap-2 text-[11px] font-medium">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${yesterdayWin[`done_${i}`] ? 'bg-dayC' : 'bg-text-muted/30'}`} />
                    <span className={yesterdayWin[`done_${i}`] ? 'text-text-secondary line-through opacity-70' : 'text-text-primary'}>
                      {yesterdayWin[`task_${i}`]}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-text-muted leading-relaxed">
                Dlaczego zrealizowałeś / nie zrealizowałeś te zadania? {yesterdayNoteRequired && <span className="font-bold text-amber-600 dark:text-amber-400">(wymagane)</span>}
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
          )}

          <PlanningCheckpointsStrip
            checkpoints={[...direction.checkpoints.overdue, ...direction.checkpoints.upcoming]}
            loading={direction.loading}
            onFillSlot={fillSlotFromCheckpoint}
            occupiedSlots={occupiedSlots}
          />

          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-display text-[14px] font-black tracking-tight text-text-primary">
                Zdefiniuj 5 zwycięstw
              </h3>
              <button
                type="button"
                onClick={applyProposal}
                disabled={direction.loading}
                className="flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-[9px] font-black uppercase text-primary hover:bg-primary/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Wand2 size={11} /> Wypełnij propozycją
              </button>
            </div>
            <p className="mt-1 text-[11px] font-medium leading-relaxed text-text-secondary">
              Wpisz ręcznie lub wybierz z{' '}
              <span className="inline-flex items-center gap-1 font-bold text-primary">
                Zadań <Link2 size={10} />
              </span>
              .
            </p>
          </div>

          {/* AI Helper Section */}
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

            {/* Display Questions */}
            {aiQuestions && (
              <div className="rounded-lg border border-border-custom bg-surface p-3 text-left animate-in fade-in duration-300">
                <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-1.5 font-display">Pytania do przemyślenia:</p>
                <div className="text-[11px] font-semibold text-text-primary leading-relaxed whitespace-pre-line">
                  {aiQuestions}
                </div>
              </div>
            )}
          </div>

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
                        <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[todoItems.find((x: any) => x.id === slot.todoId)?.priority] || 'bg-blue-500'}`} />
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
                      <button onClick={() => updateSlot(i, { task: '', todoId: null })}
                        className="mr-3 shrink-0 rounded-full p-1.5 text-primary transition-colors hover:bg-rose-500/10 hover:text-rose-500" title="Usuń powiązanie">
                        <X size={14} />
                      </button>
                    ) : (
                      <button onClick={() => setPickerSlot(pickerSlot === i ? -1 : i)}
                        className={`mr-3 shrink-0 rounded-full p-1.5 transition-colors ${pickerSlot === i ? 'bg-primary/15 text-primary' : 'text-text-muted hover:bg-primary/10 hover:text-primary'}`}
                        title="Wybierz z zadań">
                        <Link2 size={14} />
                      </button>
                    )}
                  </div>

                  {pickerSlot === i && (
                    <TodoPicker
                      items={todoItems.filter((item: any) => !newTaskForm.some((slot: TaskSlot, idx: number) => idx !== i && slot.todoId === item.id))}
                      onSelect={(item) => updateSlot(i, { task: item.title, todoId: item.id, checkpointId: null, pinId: null })}
                      onClose={() => setPickerSlot(-1)}
                    />
                  )}

                  <PowerListKpi
                    index={i}
                    slot={slot}
                    updateSlot={updateSlot}
                    pillarProjects={direction.activeProjects ?? []}
                    projectOptions={projectOptionsForSlot(i)}
                    kpisForProject={kpisForProject}
                    kpiHintForSlot={kpiHintForSlot}
                    sphereSlots={SPHERE_SLOTS}
                  />
                </div>
              );
            })}
          </div>

          {(() => {
            const filledCount = newTaskForm.filter((t: TaskSlot) => t.task.trim()).length;
            const allFilled = filledCount === 5;
            return (
              <>
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
              </>
            );
          })()}
        </div>
      ) : (
        <div className="space-y-2.5">
          {checkpointPrompt && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3.5 py-2.5 animate-fadeIn">
              <p className="text-[11px] font-semibold text-text-primary leading-snug min-w-0">
                Checkpoint: <span className="font-bold">{checkpointPrompt.title}</span> — oznaczyć jako done?
              </p>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => void confirmCheckpointDone()}
                  disabled={markingCheckpoint}
                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[9px] font-black uppercase text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  Tak
                </button>
                <button
                  type="button"
                  onClick={() => setCheckpointPrompt(null)}
                  className="rounded-lg border border-border-custom px-2.5 py-1 text-[9px] font-black uppercase text-text-muted hover:text-text-primary cursor-pointer"
                >
                  Nie
                </button>
              </div>
            </div>
          )}

          {[0, 1, 2, 3, 4].map((i) => {
            const task = todayWin[`task_${i + 1}`];
            const done = todayWin[`done_${i + 1}`];
            const completedAt = todayWin[`completed_at_${i + 1}`];
            const linkedTodoId = todayWin[`task_${i + 1}_todo_id`];
            const linkedProjectId = todayWin[`task_${i + 1}_project_id`] as string | null;
            if (!task) return null;

            const sphere = i < 3 ? SPHERE_SLOTS[i] : null;
            const targetValue = todayWin[`task_${i + 1}_target_value`] as string | null;
            const timeSlot = todayWin[`task_${i + 1}_time_slot`] as any;

            return (
              <PowerListTask
                key={i}
                index={i}
                task={task}
                done={done}
                completedAt={completedAt}
                linkedTodoId={linkedTodoId}
                linkedProjectId={linkedProjectId}
                projectMap={projectMap}
                toggleTask={toggleTask}
                sphere={sphere}
                targetValue={targetValue}
                timeSlot={timeSlot}
              />
            );
          })}

          {eveningCloseDue && (
            <div className="space-y-2 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] p-3.5 animate-fadeIn">
              <p className="text-[8px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                Domknięcie dnia
              </p>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                Co jedno poszło inaczej niż plan — i dlaczego? (30 sek., trafia do podsumowania tygodnia)
              </p>
              <textarea
                value={eveningNote}
                onChange={(e) => setEveningNote(e.target.value)}
                placeholder="Np. „Odhaczyłem outreach, ale unikałem cold calli — strach przed odmową.”"
                rows={2}
                className="w-full bg-surface-solid border border-border-custom rounded-xl px-3 py-2 text-sm
                  text-text-primary placeholder-text-muted resize-y min-h-[56px]
                  focus:outline-none focus:border-primary/50 transition-colors"
              />
              <button
                type="button"
                onClick={() => void saveEveningClose()}
                disabled={!eveningNote.trim() || savingEvening}
                className="w-full rounded-lg border border-indigo-500/30 bg-indigo-500/10 py-2 text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 disabled:opacity-40"
              >
                {savingEvening ? 'Zapisuję…' : 'Zapisz domknięcie'}
              </button>
            </div>
          )}

          {todayWin?.day_note?.trim() && !eveningCloseDue && (
            <p className="text-[10px] text-text-muted px-1">
              Domknięcie: „{todayWin.day_note.trim().slice(0, 80)}{todayWin.day_note.trim().length > 80 ? '…' : ''}"
            </p>
          )}
        </div>
      )}
    </section>
  );
}
