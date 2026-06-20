import { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2, Plus, Trophy } from 'lucide-react';
import {
  WorkoutExercise,
  useExerciseHistory,
  newSet,
  epley,
  formatLastSession,
  getSuggestion,
  numInput,
} from './workoutUtils';
import ExerciseNameInput from './ExerciseNameInput';
import TagRow from './TagRow';

interface ExerciseCardProps {
  exercise: WorkoutExercise;
  onChange: (ex: WorkoutExercise) => void;
  onRemove: () => void;
  userId: string | undefined;
}

export default function ExerciseCard({
  exercise,
  onChange,
  onRemove,
  userId,
}: ExerciseCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const sets = exercise.sets ?? [];
  const tags = exercise.tags ?? [];
  const isSaunaMode = tags.includes('wellness');
  const { lastSession, allTimeBest1RM } = useExerciseHistory(exercise.name ?? '', userId);

  function addSet() {
    const last = sets[sets.length - 1];
    onChange({
      ...exercise,
      sets: [
        ...exercise.sets,
        { ...newSet(), kg: last ? last.kg : '', reps: last ? last.reps : '', rir: last ? last.rir : '' },
      ],
    });
  }

  function removeSet(id: number) {
    if (sets.length <= 1) return;
    onChange({ ...exercise, sets: sets.filter((s) => s.id !== id) });
  }

  function updateSet(id: number, field: string, value: any) {
    onChange({ ...exercise, sets: sets.map((s) => (s.id === id ? { ...s, [field]: value } : s)) });
  }

  const current1RM = sets.reduce((best, s) => {
    const e = epley(s.kg, s.reps);
    return e && e > best ? e : best;
  }, 0);

  return (
    <div className="rounded-2xl border border-border-custom bg-surface overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-custom bg-text-primary/[0.01]">
        <ExerciseNameInput
          value={exercise.name}
          tags={exercise.tags}
          onChange={(name, t) => onChange({ ...exercise, name, tags: t })}
        />
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="p-1 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        <button
          onClick={onRemove}
          className="p-1 text-text-muted hover:text-rose-500 transition-colors cursor-pointer"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Tags */}
      {(tags.length > 0 || (exercise.name ?? '').trim().length > 0) && (
        <TagRow tags={tags} onChange={(t) => onChange({ ...exercise, tags: t })} />
      )}

      {/* Ostatnio + sugestia */}
      {lastSession && !isSaunaMode && (
        <div className="px-4 py-1.5 border-t border-border-custom bg-text-primary/[0.01] flex items-center gap-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">Ostatnio</span>
          <span className="text-[10px] font-bold text-text-secondary">{formatLastSession(lastSession)}</span>
          {(() => {
            const s = getSuggestion(lastSession);
            const lastW = Math.max(...lastSession.map((x) => Number(x.weight ?? 0)));
            const progressed = s !== null && s > lastW;
            return s ? (
              <span
                className={`ml-auto text-[10px] font-black ${
                  progressed ? 'text-emerald-500' : 'text-text-secondary'
                }`}
              >
                → {s}kg{progressed ? ' ↑' : ''}
              </span>
            ) : null;
          })()}
        </div>
      )}

      {/* Sets */}
      {!collapsed && (
        <div className="px-4 pb-3 pt-2 space-y-2">
          {isSaunaMode ? (
            <>
              <div className="grid grid-cols-[20px_1fr_1fr_24px] gap-2 px-0.5">
                <span />
                <span className="text-[9px] font-black uppercase tracking-widest text-text-muted text-center">
                  Min
                </span>
                <span className="text-[9px] font-black uppercase tracking-widest text-text-muted text-center">
                  °C
                </span>
                <span />
              </div>
              {exercise.sets.map((set, idx) => {
                const adjustWellness = (field: 'reps' | 'kg', step: number) => {
                  const cur = parseFloat(set[field]);
                  if (isNaN(cur)) {
                    updateSet(set.id, field, field === 'reps' ? '15' : '80');
                  } else {
                    const next = cur + step;
                    if (next >= 0) updateSet(set.id, field, Math.round(next).toString());
                  }
                };
                return (
                  <div key={set.id} className="grid grid-cols-[20px_1fr_1fr_24px] gap-1.5 items-center">
                    <span className="text-[10px] font-black text-text-secondary text-center">{idx + 1}</span>
                    {/* Minuty */}
                    <div className="flex flex-col gap-1">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={set.reps}
                        onChange={(e) => updateSet(set.id, 'reps', e.target.value)}
                        placeholder="—"
                        className={numInput}
                      />
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => adjustWellness('reps', -5)}
                          className="text-[9px] font-bold bg-surface active:bg-surface-solid text-text-secondary border border-border-custom hover:text-text-primary w-7 h-5 rounded flex items-center justify-center transition-colors cursor-pointer"
                        >
                          -5
                        </button>
                        <button
                          onClick={() => adjustWellness('reps', 5)}
                          className="text-[9px] font-bold bg-surface active:bg-surface-solid text-text-secondary border border-border-custom hover:text-text-primary w-7 h-5 rounded flex items-center justify-center transition-colors cursor-pointer"
                        >
                          +5
                        </button>
                      </div>
                    </div>
                    {/* Stopnie */}
                    <div className="flex flex-col gap-1">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={set.kg}
                        onChange={(e) => updateSet(set.id, 'kg', e.target.value)}
                        placeholder="—"
                        className={numInput}
                      />
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => adjustWellness('kg', -5)}
                          className="text-[9px] font-bold bg-surface active:bg-surface-solid text-text-secondary border border-border-custom hover:text-text-primary w-7 h-5 rounded flex items-center justify-center transition-colors cursor-pointer"
                        >
                          -5
                        </button>
                        <button
                          onClick={() => adjustWellness('kg', 5)}
                          className="text-[9px] font-bold bg-surface active:bg-surface-solid text-text-secondary border border-border-custom hover:text-text-primary w-7 h-5 rounded flex items-center justify-center transition-colors cursor-pointer"
                        >
                          +5
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => removeSet(set.id)}
                      className="flex items-center justify-center text-text-muted/60 hover:text-rose-500 active:scale-[0.9] transition-all cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <div className="grid grid-cols-[28px_1fr_1fr_1fr_28px] gap-2 px-0.5">
                <span />
                <span className="text-[9px] font-black uppercase tracking-widest text-text-muted text-center">
                  KG
                </span>
                <span className="text-[9px] font-black uppercase tracking-widest text-text-muted text-center">
                  Pow.
                </span>
                <span className="text-[9px] font-black uppercase tracking-widest text-text-muted text-center">
                  RIR
                </span>
                <span />
              </div>
              {exercise.sets.map((set, idx) => {
                const set1RM = epley(set.kg, set.reps);
                const isPR = set1RM && allTimeBest1RM && set1RM > allTimeBest1RM;

                const adjustValue = (field: 'kg' | 'reps' | 'rir', step: number, isInt = false) => {
                  const currentVal = parseFloat(set[field]);
                  if (isNaN(currentVal)) {
                    if (field === 'kg') updateSet(set.id, field, '40');
                    else if (field === 'reps') updateSet(set.id, field, '8');
                    else if (field === 'rir') updateSet(set.id, field, '2');
                  } else {
                    const nextVal = currentVal + step;
                    if (nextVal >= 0) {
                      updateSet(set.id, field, isInt ? Math.round(nextVal).toString() : nextVal.toString());
                    }
                  }
                };

                return (
                  <div key={set.id} className="grid grid-cols-[20px_1fr_1fr_1fr_24px] gap-1.5 items-center">
                    <button
                      onClick={() => updateSet(set.id, 'msp', !set.msp)}
                      title="Oznacz jako MSP (kluczowy set)"
                      className={`text-[10px] font-black text-center w-5 h-5 rounded-full transition-colors cursor-pointer ${
                        set.msp ? 'text-amber-500' : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {set.msp ? '★' : idx + 1}
                    </button>

                    {/* KG Column */}
                    <div className="flex flex-col gap-1">
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={set.kg}
                        onChange={(e) => updateSet(set.id, 'kg', e.target.value)}
                        placeholder="—"
                        className={numInput}
                      />
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => adjustValue('kg', -2.5)}
                          className="text-[9px] font-bold bg-surface active:bg-surface-solid text-text-secondary border border-border-custom hover:text-text-primary w-7 h-5 rounded flex items-center justify-center transition-colors cursor-pointer"
                        >
                          -
                        </button>
                        <button
                          onClick={() => adjustValue('kg', 2.5)}
                          className="text-[9px] font-bold bg-surface active:bg-surface-solid text-text-secondary border border-border-custom hover:text-text-primary w-7 h-5 rounded flex items-center justify-center transition-colors cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Reps Column */}
                    <div className="flex flex-col gap-1">
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={set.reps}
                          onChange={(e) => updateSet(set.id, 'reps', e.target.value)}
                          placeholder="—"
                          className={numInput}
                        />
                        {isPR && (
                          <div className="absolute -top-1.5 -right-1.5 bg-yellow-400 rounded-full p-0.5 pointer-events-none">
                            <Trophy size={8} className="text-black" />
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => adjustValue('reps', -1, true)}
                          className="text-[9px] font-bold bg-surface active:bg-surface-solid text-text-secondary border border-border-custom hover:text-text-primary w-7 h-5 rounded flex items-center justify-center transition-colors cursor-pointer"
                        >
                          -
                        </button>
                        <button
                          onClick={() => adjustValue('reps', 1, true)}
                          className="text-[9px] font-bold bg-surface active:bg-surface-solid text-text-secondary border border-border-custom hover:text-text-primary w-7 h-5 rounded flex items-center justify-center transition-colors cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* RIR Column */}
                    <div className="flex flex-col gap-1">
                      <input
                        type="number"
                        min={0}
                        max={5}
                        step={0.5}
                        value={set.rir}
                        onChange={(e) => updateSet(set.id, 'rir', e.target.value)}
                        placeholder="—"
                        className={numInput}
                      />
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => adjustValue('rir', -0.5)}
                          className="text-[9px] font-bold bg-surface active:bg-surface-solid text-text-secondary border border-border-custom hover:text-text-primary w-7 h-5 rounded flex items-center justify-center transition-colors cursor-pointer"
                        >
                          -
                        </button>
                        <button
                          onClick={() => adjustValue('rir', 0.5)}
                          className="text-[9px] font-bold bg-surface active:bg-surface-solid text-text-secondary border border-border-custom hover:text-text-primary w-7 h-5 rounded flex items-center justify-center transition-colors cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => removeSet(set.id)}
                      className="flex items-center justify-center text-text-muted/60 hover:text-rose-500 active:scale-[0.9] transition-all cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </>
          )}

          <button
            onClick={addSet}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-custom bg-surface/30 py-2 text-[10px] font-black uppercase tracking-widest text-text-muted hover:border-primary/40 hover:text-primary transition-colors cursor-pointer"
          >
            <Plus size={11} /> Dodaj serię
          </button>

          {!isSaunaMode && current1RM > 0 && (
            <div className="flex justify-between items-center pt-1.5 border-t border-border-custom mt-2">
              <span className="text-[9px] font-black text-text-secondary uppercase tracking-wider">
                Objętość:{' '}
                {sets
                  .reduce((sum, s) => sum + (parseFloat(s.kg) || 0) * (parseInt(s.reps) || 0), 0)
                  .toLocaleString()}{' '}
                kg
              </span>
              <span className="text-[9px] font-black text-text-muted tabular-nums">
                ~{current1RM.toFixed(1)} kg 1RM
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
