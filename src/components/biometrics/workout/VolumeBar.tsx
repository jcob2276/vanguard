import { tagClass } from '../../../data/exercises';
import { WorkoutExercise } from './workoutUtils';

interface VolumeBarProps {
  exercises: WorkoutExercise[];
}

export default function VolumeBar({ exercises }: VolumeBarProps) {
  const vol: Record<string, number> = {};
  exercises.forEach((ex) => {
    const exVol = (ex.sets ?? []).reduce((sum, s) => {
      const kg = parseFloat(s.kg) || 0;
      const reps = parseInt(s.reps) || 0;
      return sum + kg * reps;
    }, 0);
    if (exVol > 0) {
      (ex.tags ?? []).forEach((tag) => {
        vol[tag] = (vol[tag] || 0) + exVol;
      });
    }
  });
  const entries = Object.entries(vol).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;

  return (
    <div className="rounded-2xl border border-border-custom bg-surface px-4 py-3 shadow-sm">
      <span className="text-[9px] font-black uppercase tracking-[0.18em] text-text-muted block mb-2">
        Objętość sesji
      </span>
      <div className="flex flex-wrap gap-2">
        {entries.map(([tag, v]) => (
          <div key={tag} className="flex items-center gap-1.5">
            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${tagClass(tag)}`}>
              {tag}
            </span>
            <span className="text-[10px] font-bold text-text-secondary">{Math.round(v).toLocaleString()}kg</span>
          </div>
        ))}
      </div>
    </div>
  );
}
