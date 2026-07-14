import Button from '../../ui/Button';
import { ControlInput } from '../../ui/ControlPrimitives';
import { format, parseISO } from 'date-fns';
import { Trash2, Zap } from 'lucide-react';
import type { WorkoutSessionRow, EditFormState, EditableExerciseLog } from '../hooks/useStatsData';

export function WorkoutHistorySection({
  recentSessions,
  showAllSessions,
  setShowAllSessions,
  editingSession,
  editForm,
  setEditForm,
  startEditing,
  updateSession,
  deleteSession,
  deleteLog,
  setEditingSession,
}: {
  recentSessions: WorkoutSessionRow[];
  showAllSessions: boolean;
  setShowAllSessions: React.Dispatch<React.SetStateAction<boolean>>;
  editingSession: string | null;
  editForm: EditFormState;
  setEditForm: React.Dispatch<React.SetStateAction<EditFormState>>;
  startEditing: (session: WorkoutSessionRow) => void;
  updateSession: () => void;
  deleteSession: (id: string) => void;
  deleteLog: (id: string) => void;
  setEditingSession: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  return (
    <section className="space-y-3">
      <p className="text-2xs font-bold uppercase tracking-[var(--legacy-arbitrary-004)] text-text-muted font-display">Siłownia</p>
      <h2 className="mt-0.5 font-display text-lg font-black tracking-tight text-text-primary">Historia treningów</h2>
      <div className="overflow-hidden card !p-0">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-text-primary/[0.02] text-2xs font-black uppercase tracking-widest text-text-secondary">
              <th className="p-3">Data</th>
              <th className="p-3 text-center">Dzień</th>
              <th className="p-3 text-right">Akcja</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-custom text-xs font-semibold text-text-primary">
            {recentSessions.slice(0, showAllSessions ? 12 : 4).map((s) => (
              <tr key={s.id} className="transition-colors hover:bg-primary/[0.02] dark:hover:bg-on-accent/[0.02]">
                <td className="p-3">
                  {editingSession === s.id ? (
                    <ControlInput
                      type="date"
                      value={editForm.date ?? ""}
                      onChange={e => setEditForm({...editForm, date: e.target.value})}
                      className="bg-surface border border-border-custom rounded-lg p-1.5 text-xs text-text-primary outline-none focus:border-primary/50"
                    />
                  ) : (
                    format(parseISO(s.date ?? ""), 'dd.MM')
                  )}
                </td>
                <td className="p-3 text-center text-text-secondary">
                  {editingSession === s.id ? (
                    <div className="space-y-2 text-left">
                      <ControlInput
                        type="text"
                        value={editForm.workout_day ?? ''}
                        onChange={e => setEditForm({...editForm, workout_day: e.target.value})}
                        placeholder="Nazwa treningu..."
                        className="w-full bg-surface border border-border-custom rounded-lg p-1.5 text-xs font-bold text-text-primary outline-none focus:border-primary/50"
                      />
                      {editForm.logs.map((log, idx) => {
                        const isWellness = log.muscle_tags?.includes('wellness') ||
                          ['sauna', 'lodowata', 'zimny prysznic', 'stretching', 'foam rolling'].some(
                            w => (log.exercise_name || '').toLowerCase().startsWith(w)
                          );
                        const updateLog = (field: keyof EditableExerciseLog, value: string) => {
                          const newLogs = [...editForm.logs];
                          newLogs[idx] = { ...newLogs[idx], [field]: value };
                          setEditForm({...editForm, logs: newLogs});
                        };
                        return (
                        <div key={log.id} className="flex items-center gap-2 bg-surface/50 p-2 rounded-lg border border-border-custom">
                          <span className="text-2xs w-12 truncate text-text-secondary">{log.exercise_name}</span>
                          {isWellness ? (
                            <>
                              <ControlInput
                                type="number"
                                value={log.reps ?? ""}
                                onChange={e => updateLog('reps', e.target.value)}
                                className="w-12 bg-surface border border-border-custom rounded p-1 text-xs text-text-primary outline-none focus:border-primary/50"
                              />
                              <span className="text-2xs text-text-muted">min</span>
                              <ControlInput
                                type="number"
                                value={log.weight ?? ""}
                                onChange={e => updateLog('weight', e.target.value)}
                                className="w-10 bg-surface border border-border-custom rounded p-1 text-xs text-text-primary outline-none focus:border-primary/50"
                              />
                              <span className="text-2xs text-text-muted">°C</span>
                            </>
                          ) : (
                            <>
                              <ControlInput
                                type="number"
                                step="0.5"
                                value={log.weight ?? ""}
                                onChange={e => updateLog('weight', e.target.value)}
                                className="w-12 bg-surface border border-border-custom rounded p-1 text-xs text-text-primary outline-none focus:border-primary/50"
                              />
                              <span className="text-2xs text-text-muted">kg x</span>
                              <ControlInput
                                type="number"
                                value={log.reps ?? ""}
                                onChange={e => updateLog('reps', e.target.value)}
                                className="w-10 bg-surface border border-border-custom rounded p-1 text-xs text-text-primary outline-none focus:border-primary/50"
                              />
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteLog(log.id)}
                            className="ml-auto p-1 text-danger/70 hover:text-danger hover:bg-danger/10"
                          >
                            <Trash2 size={10} />
                          </Button>
                        </div>
                        );
                      })}
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={updateSession}
                        className="w-full"
                      >
                        Zapisz Zmiany
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingSession(null)}
                        className="w-full"
                      >
                        Anuluj
                      </Button>
                    </div>
                  ) : (
                    s.workout_day
                  )}
                </td>
                <td className="p-3 text-right">
                  {editingSession !== s.id && (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditing(s)}
                        className="p-2 rounded-full"
                      >
                        <Zap size={12} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSession(s.id)}
                        className="p-2 rounded-full text-danger/70 hover:text-danger hover:bg-danger/5"
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {recentSessions.length > 4 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAllSessions(v => !v)}
            className="w-full py-3 rounded-none border-t border-border-custom text-2xs"
          >
            {showAllSessions ? 'Zwiń ↑' : `Pokaż więcej (${recentSessions.length - 4}) ↓`}
          </Button>
        )}
      </div>
    </section>
  );
}
