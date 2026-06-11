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
      <h2 className="text-[16px] font-black uppercase tracking-tight text-white">Historia treningów</h2>
      <div className="overflow-hidden rounded-lg border border-white/[0.07] bg-neutral-950/60">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/[0.03] text-[8px] font-black uppercase tracking-widest text-white/30">
              <th className="p-3">Data</th>
              <th className="p-3 text-center">Dzień</th>
              <th className="p-3 text-right">Akcja</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05] text-[10px] font-bold text-white">
            {recentSessions.slice(0, showAllSessions ? 12 : 4).map(s => (
              <tr key={s.id} className="transition-colors hover:bg-white/[0.03]">
                <td className="p-3">
                  {editingSession === s.id ? (
                    <input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className="bg-neutral-950 border border-neutral-800 rounded p-1 text-[10px] text-white" />
                  ) : (
                    format(parseISO(s.date), 'dd.MM')
                  )}
                </td>
                <td className="p-3 text-center text-white/45">
                  {editingSession === s.id ? (
                    <div className="space-y-2 text-left">
                      {editForm.logs.map((log, idx) => (
                        <div key={log.id} className="flex items-center gap-2 bg-neutral-950 p-2 rounded border border-neutral-800">
                          <span className="text-[8px] w-12 truncate">{log.exercise_name}</span>
                          <input type="number" step="0.5" value={log.weight} onChange={e => {
                            const newLogs = [...editForm.logs];
                            newLogs[idx].weight = e.target.value;
                            setEditForm({...editForm, logs: newLogs});
                          }} className="w-12 bg-neutral-900 border border-neutral-800 rounded p-1 text-[10px]" />
                          <span className="text-[8px]">kg x</span>
                          <input type="number" value={log.reps} onChange={e => {
                            const newLogs = [...editForm.logs];
                            newLogs[idx].reps = e.target.value;
                            setEditForm({...editForm, logs: newLogs});
                          }} className="w-10 bg-neutral-900 border border-neutral-800 rounded p-1 text-[10px]" />
                          <button onClick={() => deleteLog(log.id)} className="text-red-900 hover:text-red-500 ml-auto"><Trash2 size={10} /></button>
                        </div>
                      ))}
                      <button onClick={updateSession} className="w-full bg-primary text-white py-2 rounded text-[8px] font-black uppercase">Zapisz Zmiany</button>
                      <button onClick={() => setEditingSession(null)} className="w-full text-neutral-500 py-1 text-[8px] font-black uppercase">Anuluj</button>
                    </div>
                  ) : (
                    s.workout_day
                  )}
                </td>
                <td className="p-3 text-right">
                  {editingSession !== s.id && (
                    <div className="flex justify-end gap-1">
                      <button onClick={() => startEditing(s)} className="text-neutral-700 hover:text-primary p-2"><Zap size={12} /></button>
                      <button onClick={() => deleteSession(s.id)} className="text-neutral-700 hover:text-red-500 p-2"><Trash2 size={12} /></button>
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
            className="w-full py-2.5 text-[9px] font-black uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors border-t border-white/[0.05]"
          >
            {showAllSessions ? 'Zwiń ↑' : `Pokaż więcej (${recentSessions.length - 4}) ↓`}
          </button>
        )}
      </div>
    </section>
  );
}
