import { CheckCircle2, Trash2 } from 'lucide-react';
import { TodoSlot } from './types';
import { PRIORITY_COLORS } from './useMorningPlanData';

interface Props {
  yesterdayTasks: TodoSlot[];
  dayWord: string;
  onAction: (taskId: string, action: 'today' | 'later' | 'backlog' | 'drop' | 'done') => void;
}

export default function MorningPlanStep1Review({ yesterdayTasks, dayWord, onAction }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[13px] font-black text-text-primary">
          Co zostało z {dayWord}?
        </h3>
        <p className="text-[10px] text-text-muted mt-0.5">Zweryfikuj zaległe zadania, aby utrzymać czysty Inbox.</p>
      </div>

      {yesterdayTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border-custom/60 rounded-2xl bg-surface/20">
          <CheckCircle2 size={32} className="text-emerald-400 mb-2" />
          <span className="text-[12px] font-bold text-text-primary">Wszystko czyste!</span>
          <span className="text-[10px] text-text-muted mt-0.5">Brak zaległych zadań.</span>
        </div>
      ) : (
        <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
          {yesterdayTasks.map((task) => (
            <div key={task.id} className="p-3 bg-slate-50 dark:bg-white/[0.01] border border-border-custom/40 rounded-xl space-y-2.5">
              <div className="flex items-start gap-2">
                <span className={`text-[9px] font-black mt-0.5 ${PRIORITY_COLORS[task.priority] || 'text-text-muted'}`}>
                  {task.priority === 'urgent' ? '!!' : task.priority === 'high' ? '!' : '·'}
                </span>
                <span className="text-[12px] font-semibold text-text-primary flex-1 break-words">{task.title}</span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => onAction(task.id, 'today')}
                  className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary/20 transition-colors"
                >
                  Na {dayWord}
                </button>
                <button
                  onClick={() => onAction(task.id, 'later')}
                  className="px-2 py-1 rounded-lg bg-surface border border-border-custom/80 text-text-primary text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-white/[0.03] transition-colors"
                >
                  Później
                </button>
                <button
                  onClick={() => onAction(task.id, 'backlog')}
                  className="px-2 py-1 rounded-lg bg-surface border border-border-custom/80 text-text-muted text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-white/[0.03] transition-colors"
                >
                  Backlog
                </button>
                <button
                  onClick={() => onAction(task.id, 'done')}
                  className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-[10px] font-bold hover:bg-emerald-500/20 transition-colors ml-auto"
                >
                  Zrobione
                </button>
                <button
                  onClick={() => onAction(task.id, 'drop')}
                  className="p-1.5 rounded-lg text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
