import { Trash2, Clock } from 'lucide-react';
import { WorkoutActivity } from './workoutUtils';
import { useHaptics } from '../../../hooks/useHaptics';

interface ActivityCardProps {
  activity: WorkoutActivity;
  onChange: (act: WorkoutActivity) => void;
  onRemove: () => void;
}

export default function ActivityCard({
  activity,
  onChange,
  onRemove,
}: ActivityCardProps) {
  const haptics = useHaptics();
  return (
    <div className="rounded-2xl border border-border-custom bg-surface px-4 py-3 space-y-3 shadow-sm">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={activity.name}
          onChange={(e) => onChange({ ...activity, name: e.target.value })}
          placeholder="np. Sauna, Rower, Spacer..."
          className="flex-1 bg-transparent text-sm font-bold text-text-primary outline-none placeholder:text-text-muted/40 min-w-0"
        />
        <button
          onClick={() => { haptics.light(); onRemove(); }}
          className="p-1 text-text-muted hover:text-rose-500 transition-colors cursor-pointer"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <Clock size={11} className="text-text-muted" />
          <input
            type="number"
            min={0}
            value={activity.min}
            onChange={(e) => onChange({ ...activity, min: e.target.value })}
            placeholder="0"
            className="w-16 h-9 bg-surface-solid border border-border-custom rounded-xl text-sm font-black text-text-primary text-center outline-none focus:border-primary/50 transition-all placeholder:text-text-muted/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-[11px] font-bold text-text-secondary">min</span>
        </div>
        <input
          type="text"
          value={activity.note}
          onChange={(e) => onChange({ ...activity, note: e.target.value })}
          placeholder="notatka (opcjonalnie)..."
          className="flex-1 h-9 bg-surface-solid border border-border-custom rounded-xl px-3 text-xs text-text-primary outline-none focus:border-primary/50 transition-all placeholder:text-text-muted/40"
        />
      </div>
    </div>
  );
}
