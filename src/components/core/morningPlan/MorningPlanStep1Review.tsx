import { CheckCircle2, Trash2 } from 'lucide-react';
import { TodoSlot } from './types';
import { PRIORITY_COLORS } from './useMorningPlanData';
import Button from '../../ui/Button';

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
          <CheckCircle2 size={32} className="text-success mb-2" />
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
                <Button
                  variant="tonal"
                  size="sm"
                  onClick={() => onAction(task.id, 'today')}
                >
                  Na {dayWord}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onAction(task.id, 'later')}
                >
                  Później
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAction(task.id, 'backlog')}
                >
                  Backlog
                </Button>
                <Button
                  variant="tonal"
                  size="sm"
                  onClick={() => onAction(task.id, 'done')}
                  className="ml-auto !bg-success/10 !text-success hover:!bg-success/20"
                >
                  Zrobione
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAction(task.id, 'drop')}
                  icon={<Trash2 size={13} />}
                  className="hover:!text-danger hover:!bg-danger/10"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
