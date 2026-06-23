import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';

interface TaskItem {
  id: string;
  text: string;
  done?: boolean;
  priority?: 'high' | 'medium' | 'low';
}

interface TaskCardData {
  title?: string;
  tasks: TaskItem[];
  completedCount?: number;
}

const PRIORITY_COLOR = { high: '#F43F5E', medium: '#F59E0B', low: '#99A1AF' };

export function TaskCard({ data }: { data: TaskCardData }) {
  const total = data.tasks.length;
  const done = data.tasks.filter(t => t.done).length;
  return (
    <div className="space-y-2">
      {data.title && (
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{data.title}</p>
          <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>{done}/{total}</span>
        </div>
      )}
      <div className="space-y-1.5">
        {data.tasks.map(task => (
          <div key={task.id} className="flex items-start gap-2.5">
            {task.done
              ? <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
              : task.priority === 'high'
                ? <AlertCircle size={14} className="mt-0.5 flex-shrink-0" style={{ color: PRIORITY_COLOR.high }} />
                : <Circle size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
            }
            <span
              className="text-[12px] leading-snug"
              style={{ color: task.done ? 'var(--color-text-tertiary)' : 'var(--text-secondary)', textDecoration: task.done ? 'line-through' : 'none' }}
            >
              {task.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
