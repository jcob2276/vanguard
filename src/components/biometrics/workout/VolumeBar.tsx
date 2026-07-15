import { tagClass, stimulusForExercise } from '../../../data/exercises';
import { WorkoutExercise } from './workoutUtils';
import { Card } from '../../ui/Card';

interface VolumeBarProps {
  exercises: WorkoutExercise[];
}

export default function VolumeBar({ exercises }: VolumeBarProps) {
  const vol: Record<string, number> = {};
  exercises.forEach((ex) => {
    if ((ex.tags ?? []).includes('wellness')) return;
    const exVol = (ex.sets ?? []).reduce((sum, s) => {
      const kg = parseFloat(s.kg) || 0;
      const reps = parseInt(s.reps) || 0;
      return sum + kg * reps;
    }, 0);
    if (exVol > 0) {
      const stimulus = stimulusForExercise(ex.name, ex.tags ?? []);
      Object.entries(stimulus).forEach(([tag, weight]) => {
        const factor = Number(weight.direct || 0) || Number(weight.indirect || 0);
        if (factor <= 0) return;
        vol[tag] = (vol[tag] || 0) + exVol * factor;
      });
    }
  });
  const entries = Object.entries(vol).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;

  return (
    <Card variant="surface" className="border border-border-custom">
      <span className="text-2xs font-black uppercase tracking-[var(--legacy-arbitrary-005)] text-text-muted block mb-2">
        Objętość sesji
      </span>
      <div className="flex flex-wrap gap-2">
        {entries.map(([tag, v]) => (
          <div key={tag} className="flex items-center gap-1.5">
            <span className={`text-2xs font-black uppercase px-2 py-0.5 rounded-full border ${tagClass(tag)}`}>
              {tag}
            </span>
            <span className="text-xs font-bold text-text-secondary">{Math.round(v).toLocaleString()}kg</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
