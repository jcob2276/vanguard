import { ControlInput } from '../../ui/ControlPrimitives';
import { Award, Smile, Flame } from 'lucide-react';

interface Props {
  dayScore: number;
  setDayScore: (v: number) => void;
  moodScore: number;
  setMoodScore: (v: number) => void;
  rpeScore: number;
  setRpeScore: (v: number) => void;
}

export default function ShutdownScoreSliders({ dayScore, setDayScore, moodScore, setMoodScore, rpeScore, setRpeScore }: Props) {
  return (
    <div className="space-y-3.5 bg-surface-2 dark:bg-on-accent/[0.015] border border-border-custom/50 p-4 rounded-2xl">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="flex items-center gap-1 text-text-primary">
            <Award size={14} className="text-primary" />
            Wynik Dnia (1-10)
          </span>
          <span className="text-primary font-extrabold">{dayScore}/10</span>
        </div>
        <ControlInput
          type="range"
          min="1"
          max="10"
          value={dayScore}
          onChange={(e) => setDayScore(Number(e.target.value))}
          className="w-full accent-primary cursor-pointer h-1.5 rounded bg-border-custom/40"
        />
      </div>

      <div className="space-y-1.5 border-t border-border-custom/30 pt-3">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="flex items-center gap-1 text-text-primary">
            <Smile size={14} className="text-success" />
            Samopoczucie (1-5)
          </span>
          <span className="text-success font-extrabold">
            {moodScore === 5 ? '🔥 Świetnie' : moodScore === 4 ? '😊 Dobrze' : moodScore === 3 ? '😐 Neutralnie' : moodScore === 2 ? '🥱 Słabo' : '😫 Źle'}
          </span>
        </div>
        <ControlInput
          type="range"
          min="1"
          max="5"
          value={moodScore}
          onChange={(e) => setMoodScore(Number(e.target.value))}
          className="w-full accent-success cursor-pointer h-1.5 rounded bg-border-custom/40"
        />
      </div>

      <div className="space-y-1.5 border-t border-border-custom/30 pt-3">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="flex items-center gap-1 text-text-primary">
            <Flame size={14} className="text-warning" />
            Odczuwalny wysiłek RPE (1-10)
          </span>
          <span className="text-warning font-extrabold">RPE {rpeScore}/10</span>
        </div>
        <ControlInput
          type="range"
          min="1"
          max="10"
          value={rpeScore}
          onChange={(e) => setRpeScore(Number(e.target.value))}
          className="w-full accent-warning cursor-pointer h-1.5 rounded bg-border-custom/40"
        />
      </div>
    </div>
  );
}
