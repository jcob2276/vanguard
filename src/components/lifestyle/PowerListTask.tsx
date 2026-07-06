import { Check, Link2 } from 'lucide-react';
import { TIME_SLOT_LABELS } from './usePowerListData';

const COLOR_DOT: Record<string, string> = {
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  sky: 'bg-sky-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
};

export interface PowerListTaskProps {
  index: number;
  task: string;
  done: boolean;
  completedAt: string | null;
  linkedTodoId: string | null;
  linkedProjectId: string | null;
  projectMap: Record<string, { name: string; color: string | null }>;
  toggleTask: (index: number) => void;
  sphere: { category: string; label: string; icon: React.ComponentType<any>; text: string; bg: string } | null;
  targetValue: string | null;
  timeSlot: 'morning' | 'noon' | 'afternoon' | 'evening' | null;
}

export default function PowerListTask({
  index,
  task,
  done,
  completedAt,
  linkedTodoId,
  linkedProjectId,
  projectMap,
  toggleTask,
  sphere,
  targetValue,
  timeSlot,
}: PowerListTaskProps) {
  const SphereIcon = sphere?.icon;
  const targetValueLabel = targetValue ? (/^\d+$/.test(targetValue.trim()) ? `${targetValue.trim()}×` : targetValue.trim()) : null;

  return (
    <button
      onClick={() => toggleTask(index)}
      className={`group flex w-full cursor-pointer items-center justify-between rounded-[24px] border p-4 transition-all duration-200 active:scale-[0.98] ${
        done
          ? 'border-border-custom bg-surface/30 opacity-60 shadow-none'
          : 'border-border-custom bg-surface shadow-sm hover:-translate-y-0.5 hover:border-primary/25 hover:bg-surface-solid hover:shadow-md'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div
          className={`flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
            done
              ? 'border-dayC bg-dayC text-white shadow-[0_2px_8px_rgba(16,185,129,0.3)] scale-100'
              : 'border-border-custom bg-surface-solid text-transparent scale-95 group-hover:border-primary/40 group-active:scale-90'
          }`}
        >
          <Check size={11} strokeWidth={3} className={`transition-transform duration-300 ${done ? 'scale-100' : 'scale-0'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {sphere && SphereIcon && (
              <span className={`flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[7px] font-black uppercase tracking-widest ${sphere.bg} ${sphere.text}`}>
                <SphereIcon size={7} /> {sphere.label}
              </span>
            )}
            <p className={`text-[13px] font-semibold tracking-normal transition-all duration-300 ${done ? 'text-text-muted line-through opacity-70' : 'text-text-primary'}`}>
              {task}
            </p>
          </div>
          {done && completedAt && (
            <p className="mt-0.5 text-[9px] font-semibold text-dayC/80">
              Zrobione o {new Date(completedAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>

      {linkedTodoId && (() => {
        const proj = projectMap[linkedTodoId];
        return proj ? (
          <span className="ml-2 flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[8px] font-black text-primary">
            <span className={`h-1.5 w-1.5 rounded-full ${COLOR_DOT[proj.color || ''] || 'bg-primary'}`} />
            {proj.name}
          </span>
        ) : !done ? (
          <span className="ml-2 flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[8px] font-black text-primary">
            <Link2 size={8} /> Zadanie
          </span>
        ) : null;
      })()}
      {!linkedTodoId && linkedProjectId && projectMap[`task_project_${index + 1}`] && (
        <span className="ml-2 flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[8px] font-black text-primary">
          <span className={`h-1.5 w-1.5 rounded-full ${COLOR_DOT[projectMap[`task_project_${index + 1}`].color || ''] || 'bg-primary'}`} />
          {projectMap[`task_project_${index + 1}`].name}
        </span>
      )}
    </button>
  );
}
