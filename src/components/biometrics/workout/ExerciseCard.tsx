import { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2, Plus } from 'lucide-react';
import { Card } from '../../ui/Card';
import {
  WorkoutExercise,
  useExerciseHistory,
  newSet,
  epley,
  formatLastSession,
  getSuggestion,
} from './workoutUtils';
import ExerciseNameInput from './ExerciseNameInput';
import ExerciseWellnessSets from './ExerciseWellnessSets';
import ExerciseStrengthSets from './ExerciseStrengthSets';
import { useHaptics } from '../../../hooks/useHaptics';
import { getTodayWarsaw } from '../../../lib/date';
import { confirmDialog } from '../../../lib/notify';

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
  const haptics = useHaptics();
  const sets = exercise.sets ?? [];
  const tags = exercise.tags ?? [];
  const isSaunaMode = tags.includes('wellness');
  const { lastSession, lastSessionDate, allTimeBest1RM } = useExerciseHistory(exercise.name ?? '', userId);
  const daysAgo = lastSessionDate
    ? Math.round((new Date(`${getTodayWarsaw()}T12:00:00Z`).getTime() - new Date(`${lastSessionDate}T12:00:00Z`).getTime()) / 86400000)
    : null;

  function addSet() {
    haptics.light();
    const last = sets[sets.length - 1];
    onChange({
      ...exercise,
      sets: [
        ...exercise.sets,
        { ...newSet(), kg: last ? last.kg : '', reps: last ? last.reps : '', rir: last ? last.rir : '' },
      ],
    });
  }

  async function removeSet(id: number) {
    if (sets.length <= 1) return;
    const set = sets.find((s) => s.id === id);
    const hasData = !!(set?.kg || set?.reps);
    if (hasData && !(await confirmDialog('Usunąć tę serię?'))) return;
    haptics.light();
    onChange({ ...exercise, sets: sets.filter((s) => s.id !== id) });
  }

  async function removeExercise() {
    const hasData = sets.some((s) => s.kg || s.reps);
    if (hasData && !(await confirmDialog(`Usunąć ćwiczenie "${exercise.name || 'bez nazwy'}" wraz z seriami?`))) return;
    onRemove();
  }

  function updateSet(id: number, field: string, value: string | boolean) {
    onChange({ ...exercise, sets: sets.map((s) => (s.id === id ? { ...s, [field]: value } : s)) });
  }

  const current1RM = sets.reduce((best, s) => {
    const e = epley(s.kg, s.reps);
    return e && e > best ? e : best;
  }, 0);

  return (
    <Card variant="glass" className="border border-border-custom" padding="0">
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
          onClick={removeExercise}
          className="p-1 text-text-muted hover:text-danger transition-colors cursor-pointer"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Ostatnio + sugestia */}
      {lastSession && !isSaunaMode && (
        <div className="px-4 py-1.5 border-t border-border-custom bg-text-primary/[0.01] flex items-center gap-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">Ostatnio</span>
          <span className="text-[10px] font-bold text-text-secondary">{formatLastSession(lastSession)}</span>
          {daysAgo != null && (
            <span className="text-[8px] font-bold text-text-muted/50">
              {daysAgo === 0 ? '(dziś)' : daysAgo === 1 ? '(1d temu)' : `(${daysAgo}d temu)`}
            </span>
          )}
          {(() => {
            const s = getSuggestion(lastSession);
            const lastW = Math.max(...lastSession.map((x) => Number(x.weight ?? 0)));
            const progressed = s !== null && s > lastW;
            return s ? (
              <span
                className={`ml-auto text-[10px] font-black ${
                  progressed ? 'text-success' : 'text-text-secondary'
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
            <ExerciseWellnessSets exercise={exercise} haptics={haptics} updateSet={updateSet} removeSet={removeSet} />
          ) : (
            <ExerciseStrengthSets exercise={exercise} haptics={haptics} allTimeBest1RM={allTimeBest1RM} updateSet={updateSet} removeSet={removeSet} />
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
    </Card>
  );
}
