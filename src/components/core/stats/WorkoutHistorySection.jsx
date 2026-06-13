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
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-[16px] font-display font-black uppercase tracking-tight text-text-primary">Historia treningów</h2>
      <div className="overflow-hidden rounded-[24px] border border-border-custom bg-surface/50 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.02)]">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-text-primary/[0.02] text-[8px] font-black uppercase tracking-widest text-text-secondary">
              <th className="p-3">Data</th>
              <th className="p-3 text-center">Dzień</th>
              <th className="p-3 text-right">Akcja</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-custom text-[10px] font-semibold text-text-primary">
            {recentSessions.slice(0, showAllSessions ? 12 : 4).map(s => (
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
                      {editForm.logs.map((log, idx) => (
                        <div key={log.id} className="flex items-center gap-2 bg-surface/50 p-2 rounded-lg border border-border-custom">
                          <span className="text-[8px] w-12 truncate text-text-secondary">{log.exercise_name}</span>
                          <input 
                            type="number" 
                            step="0.5" 
                            value={log.weight} 
                            onChange={e => {
                              const newLogs = [...editForm.logs];
                              newLogs[idx].weight = e.target.value;
                              setEditForm({...editForm, logs: newLogs});
                            }} 
                            className="w-12 bg-surface border border-border-custom rounded p-1 text-[10px] text-text-primary outline-none focus:border-primary/50" 
                          />
                          <span className="text-[8px] text-text-muted">kg x</span>
                          <input 
                            type="number" 
                            value={log.reps} 
                            onChange={e => {
                              const newLogs = [...editForm.logs];
                              newLogs[idx].reps = e.target.value;
                              setEditForm({...editForm, logs: newLogs});
                            }} 
                            className="w-10 bg-surface border border-border-custom rounded p-1 text-[10px] text-text-primary outline-none focus:border-primary/50" 
                          />
                          <button 
                            onClick={() => deleteLog(log.id)} 
                            className="text-rose-500/70 hover:text-rose-500 ml-auto p-1 transition-colors"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
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
