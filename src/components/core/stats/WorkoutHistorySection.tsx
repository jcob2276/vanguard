import { format, parseISO } from 'date-fns';
import { Trash2, Zap } from 'lucide-react';

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
  recentSessions: any[];
  showAllSessions: boolean;
  setShowAllSessions: React.Dispatch<React.SetStateAction<boolean>>;
  editingSession: string | null;
  editForm: any;
  setEditForm: React.Dispatch<React.SetStateAction<any>>;
  startEditing: (session: any) => void;
  updateSession: () => void;
  deleteSession: (id: any) => void;
  deleteLog: (id: any) => void;
  setEditingSession: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  return (
    <section className="space-y-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted font-display">Siłownia</p>
      <h2 className="mt-0.5 font-display text-[18px] font-black tracking-tight text-text-primary">Historia treningów</h2>
      <div className="overflow-hidden card !p-0">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-text-primary/[0.02] text-[8px] font-black uppercase tracking-widest text-text-secondary">
              <th className="p-3">Data</th>
              <th className="p-3 text-center">Dzień</th>
              <th className="p-3 text-right">Akcja</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-custom text-[10px] font-semibold text-text-primary">
            {recentSessions.slice(0, showAllSessions ? 12 : 4).map((s: any) => (
              <tr key={s.id} className="transition-colors hover:bg-primary/[0.02] dark:hover:bg-white/[0.02]">
                <td className="p-3">
                  {editingSession === s.id ? (
                    <input 
                      type="date" 
                      value={editForm.date} 
                      onChange={e => setEditForm({...editForm, date: e.target.value})} 
                      className="bg-surface border border-border-custom rounded-lg p-1.5 text-[10px] text-text-primary outline-none focus:border-primary/50" 
                    />
                  ) : (
                    format(parseISO(s.date), 'dd.MM')
                  )}
                </td>
                <td className="p-3 text-center text-text-secondary">
                  {editingSession === s.id ? (
                    <div className="space-y-2 text-left">
                      <input
                        type="text"
                        value={editForm.workout_day ?? ''}
                        onChange={e => setEditForm({...editForm, workout_day: e.target.value})}
                        placeholder="Nazwa treningu..."
                        className="w-full bg-surface border border-border-custom rounded-lg p-1.5 text-[10px] font-bold text-text-primary outline-none focus:border-primary/50"
                      />
                      {editForm.logs.map((log: any, idx: number) => {
                        const isWellness = log.muscle_tags?.includes('wellness') ||
                          ['sauna', 'lodowata', 'zimny prysznic', 'stretching', 'foam rolling'].some(
                            w => (log.exercise_name || '').toLowerCase().startsWith(w)
                          );
                        const updateLog = (field: string, value: any) => {
                          const newLogs = [...editForm.logs];
                          newLogs[idx] = { ...newLogs[idx], [field]: value };
                          setEditForm({...editForm, logs: newLogs});
                        };
                        return (
                        <div key={log.id} className="flex items-center gap-2 bg-surface/50 p-2 rounded-lg border border-border-custom">
                          <span className="text-[8px] w-12 truncate text-text-secondary">{log.exercise_name}</span>
                          {isWellness ? (
                            <>
                              <input
                                type="number"
                                value={log.reps}
                                onChange={e => updateLog('reps', e.target.value)}
                                className="w-12 bg-surface border border-border-custom rounded p-1 text-[10px] text-text-primary outline-none focus:border-primary/50"
                              />
                              <span className="text-[8px] text-text-muted">min</span>
                              <input
                                type="number"
                                value={log.weight}
                                onChange={e => updateLog('weight', e.target.value)}
                                className="w-10 bg-surface border border-border-custom rounded p-1 text-[10px] text-text-primary outline-none focus:border-primary/50"
                              />
                              <span className="text-[8px] text-text-muted">°C</span>
                            </>
                          ) : (
                            <>
                              <input
                                type="number"
                                step="0.5"
                                value={log.weight}
                                onChange={e => updateLog('weight', e.target.value)}
                                className="w-12 bg-surface border border-border-custom rounded p-1 text-[10px] text-text-primary outline-none focus:border-primary/50"
                              />
                              <span className="text-[8px] text-text-muted">kg x</span>
                              <input
                                type="number"
                                value={log.reps}
                                onChange={e => updateLog('reps', e.target.value)}
                                className="w-10 bg-surface border border-border-custom rounded p-1 text-[10px] text-text-primary outline-none focus:border-primary/50"
                              />
                            </>
                          )}
                          <button
                            onClick={() => deleteLog(log.id)}
                            className="text-rose-500/70 hover:text-rose-500 ml-auto p-1 transition-colors"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                        );
                      })}
                      <button 
                        onClick={updateSession} 
                        className="w-full bg-primary text-white py-2 rounded-lg text-[8px] font-black uppercase tracking-wider shadow-sm hover:bg-primary-hover active:scale-[0.98] transition-all"
                      >
                        Zapisz Zmiany
                      </button>
                      <button 
                        onClick={() => setEditingSession(null)} 
                        className="w-full text-text-muted hover:text-text-primary py-1 text-[8px] font-black uppercase transition-colors"
                      >
                        Anuluj
                      </button>
                    </div>
                  ) : (
                    s.workout_day
                  )}
                </td>
                <td className="p-3 text-right">
                  {editingSession !== s.id && (
                    <div className="flex justify-end gap-1">
                      <button 
                        onClick={() => startEditing(s)} 
                        className="text-text-secondary hover:text-primary p-2 transition-colors rounded-full hover:bg-primary/5"
                      >
                        <Zap size={12} />
                      </button>
                      <button 
                        onClick={() => deleteSession(s.id)} 
                        className="text-text-secondary hover:text-rose-500 p-2 transition-colors rounded-full hover:bg-rose-500/5"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {recentSessions.length > 4 && (
          <button
            onClick={() => setShowAllSessions(v => !v)}
            className="w-full py-3 text-[9px] font-black uppercase tracking-widest text-text-muted hover:text-text-primary transition-colors border-t border-border-custom bg-text-primary/[0.01]"
          >
            {showAllSessions ? 'Zwiń ↑' : `Pokaż więcej (${recentSessions.length - 4}) ↓`}
          </button>
        )}
      </div>
    </section>
  );
}
