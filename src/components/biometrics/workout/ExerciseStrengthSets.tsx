import { Trash2, Trophy } from 'lucide-react';
import { WorkoutExercise, epley, numInput } from './workoutUtils';

interface ExerciseStrengthSetsProps {
  exercise: WorkoutExercise;
  haptics: { light: () => void };
  allTimeBest1RM: number | null | undefined;
  updateSet: (id: number, field: string, value: string | boolean) => void;
  removeSet: (id: number) => void;
}

export default function ExerciseStrengthSets({ exercise, haptics, allTimeBest1RM, updateSet, removeSet }: ExerciseStrengthSetsProps) {
  return (
    <>
      <div className="grid grid-cols-[28px_1fr_1fr_1fr_60px] gap-2 px-0.5">
        <span />
        <span className="text-2xs font-black uppercase tracking-widest text-text-muted text-center">
          KG
        </span>
        <span className="text-2xs font-black uppercase tracking-widest text-text-muted text-center">
          Pow.
        </span>
        <span className="text-2xs font-black uppercase tracking-widest text-text-muted text-center">
          RIR
        </span>
        <span />
      </div>
      {exercise.sets.map((set, idx) => {
        const set1RM = epley(set.kg, set.reps);
        const isPR = set1RM && allTimeBest1RM && set1RM > allTimeBest1RM;

        const adjustValue = (field: 'kg' | 'reps' | 'rir', step: number, isInt = false) => {
          haptics.light();
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
          <div key={set.id} className="grid grid-cols-[20px_1fr_1fr_1fr_60px] gap-1.5 items-center rounded-xl">
            <button
              onClick={() => { haptics.light(); updateSet(set.id, 'msp', !set.msp); }}
              title="Oznacz jako MSP (kluczowy set)"
              className={`text-xs font-black text-center w-5 h-5 rounded-full transition-colors cursor-pointer ${
                set.msp ? 'text-warning' : 'text-text-secondary hover:text-text-primary'
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
                  className="text-xs font-bold bg-surface active:bg-surface-solid active:scale-90 text-text-secondary border border-border-custom hover:text-text-primary w-9 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                >
                  -
                </button>
                <button
                  onClick={() => adjustValue('kg', 2.5)}
                  className="text-xs font-bold bg-surface active:bg-surface-solid active:scale-90 text-text-secondary border border-border-custom hover:text-text-primary w-9 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer"
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
                  <div className="absolute -top-1.5 -right-1.5 bg-warning rounded-full p-0.5 pointer-events-none">
                    <Trophy size={8} className="text-black" />
                  </div>
                )}
              </div>
              <div className="flex gap-1 justify-center">
                <button
                  onClick={() => adjustValue('reps', -1, true)}
                  className="text-xs font-bold bg-surface active:bg-surface-solid active:scale-90 text-text-secondary border border-border-custom hover:text-text-primary w-9 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                >
                  -
                </button>
                <button
                  onClick={() => adjustValue('reps', 1, true)}
                  className="text-xs font-bold bg-surface active:bg-surface-solid active:scale-90 text-text-secondary border border-border-custom hover:text-text-primary w-9 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer"
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
                  className="text-xs font-bold bg-surface active:bg-surface-solid active:scale-90 text-text-secondary border border-border-custom hover:text-text-primary w-9 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                >
                  -
                </button>
                <button
                  onClick={() => adjustValue('rir', 0.5)}
                  className="text-xs font-bold bg-surface active:bg-surface-solid active:scale-90 text-text-secondary border border-border-custom hover:text-text-primary w-9 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <button
              onClick={() => removeSet(set.id)}
              className="flex items-center justify-center text-text-muted/60 hover:text-danger active:scale-[0.9] transition-all cursor-pointer"
            >
              <Trash2 size={12} />
            </button>
          </div>
        );
      })}
    </>
  );
}
