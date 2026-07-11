import React, { useState } from 'react';
import { Check } from 'lucide-react';

interface TodoCardSubtasksProps {
  childTasks: any[];
  onAddChildTask?: (title: string) => void;
  onToggleChildTask?: (child: any) => void;
}

export default function TodoCardSubtasks({ childTasks, onAddChildTask, onToggleChildTask }: TodoCardSubtasksProps) {
  const [newChildTask, setNewChildTask] = useState('');

  if (!onAddChildTask) return null;

  return (
    <div className="border-t border-border-custom/20 pt-2.5 flex flex-col gap-2">
      {childTasks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {childTasks.map((child) => (
            <div
              key={child.id}
              className="flex items-center gap-2 rounded-xl border border-border-custom/30 bg-surface-solid/25 px-2.5 py-1"
            >
              <button onClick={() => onToggleChildTask?.(child)} className="shrink-0 btn-press">
                <div
                  className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center transition-all ${
                    child.status === 'done' ? 'bg-emerald-500 border-emerald-500 todo-checkbox-pop' : 'border-border-custom'
                  }`}
                >
                  {child.status === 'done' && <Check size={8} className="text-white" strokeWidth={3} />}
                </div>
              </button>
              <span
                className={`min-w-0 flex-1 text-[11px] font-medium truncate ${
                  child.status === 'done' ? 'line-through text-text-muted' : 'text-text-primary'
                }`}
              >
                {child.title}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          placeholder="Nowe podzadanie…"
          value={newChildTask}
          onChange={e => setNewChildTask(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && newChildTask.trim()) {
              onAddChildTask(newChildTask);
              setNewChildTask('');
            }
          }}
          className="min-w-0 flex-1 rounded-xl border border-border-custom/50 bg-surface-solid/40 px-2.5 py-1 text-[11px] text-text-primary outline-none placeholder:text-text-muted/30 focus:border-primary/30"
        />
        <button
          onClick={() => {
            if (newChildTask.trim()) {
              onAddChildTask(newChildTask);
              setNewChildTask('');
            }
          }}
          disabled={!newChildTask.trim()}
          className="rounded-xl bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary disabled:opacity-30 hover:bg-primary/20 transition-colors btn-press"
        >
          +
        </button>
      </div>
    </div>
  );
}
