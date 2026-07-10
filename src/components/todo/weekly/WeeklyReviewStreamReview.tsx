import React from 'react';
import { useWeeklyReview } from './context/WeeklyReviewContext';
import { Mic, Trash2, Pencil } from 'lucide-react';
import { isVoiceEntry, type StreamEntry } from '../../../lib/behavior/streamReview';
import { formatStreamEntryDate } from './weeklyHelpers';

export default function WeeklyReviewStreamReview() {
  const {
    streamEntries,
    editingStreamId,
    editingStreamText,
    setEditingStreamText,
    setEditingStreamId,
    saveEditStream,
    handleDeleteStream,
    startEditStream,
  } = useWeeklyReview();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[13px] font-black text-text-primary flex items-center gap-1.5 uppercase tracking-wider">
          <Mic size={15} className="text-indigo-500" />
          Krok 3: Kontrola Wpisów Strumienia
        </h3>
        <p className="text-[10px] text-text-muted mt-0.5">
          Popraw literówki z transkrypcji, dopowiedz kontekst albo usuń wpisy, które trafiły do strumienia przez przypadek. To jest dokładnie to, co przeczyta tygodniowa synteza AI.
        </p>
      </div>

      {streamEntries.length === 0 ? (
        <div className="py-12 text-center text-text-muted/60 italic text-[12px] bg-slate-50 dark:bg-white/[0.01] rounded-2xl border border-dashed border-border-custom/40">
          Brak wpisów z Telegrama w ostatnich 7 dniach.
        </div>
      ) : (
        <div className="space-y-2.5">
          {streamEntries.map((entry: StreamEntry) => {
            const isEditing = editingStreamId === entry.id;
            const voice = isVoiceEntry(entry);
            return (
              <div
                key={entry.id}
                className="p-3 rounded-xl border border-border-custom/50 bg-surface-solid/30 space-y-2"
              >
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-text-muted uppercase tracking-wider">
                  {voice && <Mic size={10} className="text-indigo-500 shrink-0" />}
                  <span>{formatStreamEntryDate(entry.created_at)}</span>
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      value={editingStreamText}
                      onChange={(e) => setEditingStreamText(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-50 dark:bg-white/[0.02] border border-indigo-500/40 rounded-lg px-2.5 py-2 text-[12px] font-medium text-text-primary outline-none resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditingStreamId(null)}
                        className="text-[10px] font-bold text-text-muted px-2 py-1"
                      >
                        Anuluj
                      </button>
                      <button
                        onClick={saveEditStream}
                        className="text-[10px] font-black text-white bg-indigo-600 rounded-lg px-3 py-1"
                      >
                        Zapisz
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-medium text-text-primary break-words flex-1">
                      {entry.content || '(pusty wpis)'}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEditStream(entry)}
                        className="p-1 rounded-lg border border-border-custom/50 text-text-muted hover:text-indigo-500 hover:border-indigo-500/30 transition-colors btn-press"
                        title="Edytuj"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteStream(entry.id)}
                        className="p-1 rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10 transition-colors btn-press"
                        title="Usuń"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
