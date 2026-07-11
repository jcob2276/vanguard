import { SPHERE_SLOTS } from './powerListConstants';
import PowerListTask from '../PowerListTask';

interface PowerListActiveProps {
  checkpointPrompt: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  setCheckpointPrompt: (v: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  markingCheckpoint: boolean;
  confirmCheckpointDone: () => Promise<void>;
  todayWin: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  projectMap: any; // eslint-disable-line @typescript-eslint/no-explicit-any
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
        .sort((a: any, b: any) => a.slot - b.slot) // eslint-disable-line @typescript-eslint/no-explicit-any
        .map((t: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          const sphere = t.slot <= 3 ? SPHERE_SLOTS[t.slot - 1] : null;
          return (
            <PowerListTask
              key={t.id}
              index={t.slot - 1}
              task={t.title}
              done={t.done}
              completedAt={t.completed_at}
              linkedTodoId={t.todo_id}
              linkedProjectId={t.project_id}
              projectMap={projectMap}
              toggleTask={toggleTask}
              sphere={sphere}
              targetValue={t.target_value}
              timeSlot={t.time_slot}
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
