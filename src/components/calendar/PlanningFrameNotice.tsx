import { Clock3, ShieldAlert } from 'lucide-react';
import type { TimeBudget } from './hooks/useTimeBudgets';
import { evaluatePlanningFrame } from '../../lib/calendarFrames';

export default function PlanningFrameNotice({
  frame,
  date,
  startMinutes,
}: {
  frame: TimeBudget | undefined;
  date: string;
  startMinutes: number;
}) {
  const evaluation = evaluatePlanningFrame(frame, date, startMinutes);
  if (evaluation.matches || !evaluation.reason) return null;
  const strict = evaluation.strength === 'only';
  const Icon = strict ? ShieldAlert : Clock3;
  return (
    <div className={`flex gap-2.5 rounded-xl border px-3 py-2.5 ${strict ? 'border-warning/35 bg-warning/10 text-warning' : 'border-primary/20 bg-primary/5 text-text-secondary'}`}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div>
        <p className="text-xs font-bold">{strict ? 'Poza twardym Frame' : 'Poza preferowanym rytmem'}</p>
        <p className="mt-0.5 text-xs text-text-muted">{evaluation.reason} Możesz mimo to zapisać.</p>
      </div>
    </div>
  );
}
