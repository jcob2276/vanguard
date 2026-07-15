import { Zap } from 'lucide-react';
import { getTodayWarsaw } from '../../lib/date';
import { TodoItemRow } from '../../lib/todo/todo';
import { Card } from '../ui/Card';

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
    <Card variant="surface" padding="1.25rem" className="space-y-3">
      <h3 className="flex items-center gap-2 font-display text-xs font-black uppercase tracking-wider text-text-muted">
        <Zap size={12} className="text-warning" /> Priorytetowe Zadania
      </h3>
      <div className="space-y-2">
        {importantTasks.slice(0, 3).map((task) => (
          <div
            key={task.id}
            onClick={() => void onToggleDone(task)}
            className="flex items-center gap-2.5 rounded-xl border border-border-custom bg-background/30 px-3.5 py-2.5 cursor-pointer hover:bg-surface-2 transition-colors"
            title="Kliknij, aby oznaczyć jako wykonane"
          >
            <span className={`h-2 w-2 rounded-full ${task.priority === 'urgent' ? 'bg-danger' : 'bg-primary'}`} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary hover:line-through">
              {task.title}
            </span>
            {task.due_date && (
              <span className="shrink-0 text-2xs font-bold text-text-muted">{task.due_date}</span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
