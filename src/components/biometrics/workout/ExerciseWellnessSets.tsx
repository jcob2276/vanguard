import { Trash2 } from 'lucide-react';
import { WorkoutExercise, numInput } from './workoutUtils';

interface ExerciseWellnessSetsProps {
  exercise: WorkoutExercise;
  haptics: { light: () => void };
  updateSet: (id: number, field: string, value: string | boolean) => void;
  removeSet: (id: number) => void;
}

export default function ExerciseWellnessSets({ exercise, haptics, updateSet, removeSet }: ExerciseWellnessSetsProps) {
  return (
    <>
      <div className="grid grid-cols-[20px_1fr_1fr_56px] gap-2 px-0.5">
        <span />
        <span className="text-2xs font-black uppercase tracking-widest text-text-muted text-center">
          Min
        </span>
        <span className="text-2xs font-black uppercase tracking-widest text-text-muted text-center">
          °C
        </span>
        <span />
      </div>
      {exercise.sets.map((set, idx) => {
        const adjustWellness = (field: 'reps' | 'kg', step: number) => {
          haptics.light();
          const cur = parseFloat(set[field]);
          if (isNaN(cur)) {
            updateSet(set.id, field, field === 'reps' ? '15' : '80');
          } else {
            const next = cur + step;
            if (next >= 0) updateSet(set.id, field, Math.round(next).toString());
          }
        };
        return (
          <div key={set.id} className="grid grid-cols-[20px_1fr_1fr_56px] gap-1.5 items-center rounded-xl">
            <span className="text-xs font-black text-text-secondary text-center">{idx + 1}</span>
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
                  className="text-xs font-bold bg-surface active:bg-surface-solid active:scale-90 text-text-secondary border border-border-custom hover:text-text-primary w-9 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                >
                  -5
                </button>
                <button
                  onClick={() => adjustWellness('reps', 5)}
                  className="text-xs font-bold bg-surface active:bg-surface-solid active:scale-90 text-text-secondary border border-border-custom hover:text-text-primary w-9 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer"
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
                  className="text-xs font-bold bg-surface active:bg-surface-solid active:scale-90 text-text-secondary border border-border-custom hover:text-text-primary w-9 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                >
                  -5
                </button>
                <button
                  onClick={() => adjustWellness('kg', 5)}
                  className="text-xs font-bold bg-surface active:bg-surface-solid active:scale-90 text-text-secondary border border-border-custom hover:text-text-primary w-9 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                >
                  +5
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
