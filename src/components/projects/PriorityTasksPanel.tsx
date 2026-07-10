import { Zap } from 'lucide-react';
import { getTodayWarsaw } from '../../lib/date';
import { TodoItemRow } from '../../lib/todo/todo';

interface Props {
  items: TodoItemRow[];
  onToggleDone: (task: TodoItemRow) => void;
}

export function PriorityTasksPanel({ items, onToggleDone }: Props) {
  const todayStr = getTodayWarsaw();
  const importantTasks = items.filter((item) => {
    if (item.status !== 'open') return false;
    const isUrgentOrHigh = item.priority === 'high' || item.priority === 'urgent';
    const isDueToday = item.due_date === todayStr;
    return isUrgentOrHigh || isDueToday;
  });

  if (importantTasks.length === 0) return null;

  return (
    <div className="rounded-[24px] border border-border-custom bg-surface p-5 shadow-sm space-y-3">
      <h3 className="flex items-center gap-2 font-display text-[10px] font-black uppercase tracking-wider text-text-muted">
        <Zap size={12} className="text-amber-500" /> Priorytetowe Zadania
      </h3>
      <div className="space-y-2">
        {importantTasks.slice(0, 3).map((task) => (
          <div
            key={task.id}
            onClick={() => void onToggleDone(task)}
            className="flex items-center gap-2.5 rounded-xl border border-border-custom bg-background/30 px-3.5 py-2.5 cursor-pointer hover:bg-slate-100 transition-colors"
            title="Kliknij, aby oznaczyć jako wykonane"
          >
            <span className={`h-2 w-2 rounded-full ${task.priority === 'urgent' ? 'bg-rose-500' : 'bg-indigo-500'}`} />
            <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-text-primary hover:line-through">
              {task.title}
            </span>
            {task.due_date && (
              <span className="shrink-0 text-[9px] font-bold text-text-muted">{task.due_date}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
