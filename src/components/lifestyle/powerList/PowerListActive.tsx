import { SPHERE_SLOTS } from './powerListConstants';
import PowerListTask from '../PowerListTask';

import { type DailyWinWithTasks } from '../usePowerListData';
import type { Tables } from '../../../lib/database.types';

interface PowerListActiveProps {
  checkpointPrompt: { index: number; checkpointId: string; title: string } | null;
  setCheckpointPrompt: (v: { index: number; checkpointId: string; title: string } | null) => void;
  markingCheckpoint: boolean;
  confirmCheckpointDone: () => Promise<void>;
  todayWin: DailyWinWithTasks;
  projectMap: Record<string, { name: string; color: string | null }>;
  toggleTask: (index: number) => void;
  eveningCloseDue: boolean;
}

export default function PowerListActive({
  checkpointPrompt,
  setCheckpointPrompt,
  markingCheckpoint,
  confirmCheckpointDone,
  todayWin,
  projectMap,
  toggleTask,
  eveningCloseDue,
}: PowerListActiveProps) {
  return (
    <div className="space-y-2.5">
      {checkpointPrompt && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3.5 py-2.5 animate-fadeIn">
          <p className="text-[11px] font-semibold text-text-primary leading-snug min-w-0">
            Checkpoint: <span className="font-bold">{checkpointPrompt.title}</span> — oznaczyć jako done?
          </p>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => void confirmCheckpointDone()}
              disabled={markingCheckpoint}
              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[9px] font-black uppercase text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            >
              Tak
            </button>
            <button
              type="button"
              onClick={() => setCheckpointPrompt(null)}
              className="rounded-lg border border-border-custom px-2.5 py-1 text-[9px] font-black uppercase text-text-muted hover:text-text-primary cursor-pointer"
            >
              Nie
            </button>
          </div>
        </div>
      )}

      {(todayWin.daily_win_tasks || [])
        .sort((a: Tables<'daily_win_tasks'>, b: Tables<'daily_win_tasks'>) => a.slot - b.slot)
        .map((t: Tables<'daily_win_tasks'>) => {
          const sphere = t.slot <= 3 ? SPHERE_SLOTS[t.slot - 1] : null;
          return (
            <PowerListTask
              key={t.id}
              index={t.slot - 1}
              task={t.title}
              done={t.done ?? false}
              completedAt={t.completed_at}
              linkedTodoId={t.todo_id}
              linkedProjectId={t.project_id}
              projectMap={projectMap}
              toggleTask={toggleTask}
              sphere={sphere}
              targetValue={t.target_value}
              timeSlot={t.time_slot as 'morning' | 'noon' | 'afternoon' | 'evening' | null}
            />
          );
        })}

      {todayWin?.day_note?.trim() && !eveningCloseDue && (
        <p className="text-[10px] text-text-muted px-1">
          Domknięcie: „{todayWin.day_note.trim().slice(0, 80)}
          {todayWin.day_note.trim().length > 80 ? '…' : ''}”
        </p>
      )}
    </div>
  );
}
