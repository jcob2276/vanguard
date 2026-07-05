import { useEffect, useState } from 'react';
import { X, Check, Trash2, ChevronRight, ChevronLeft, Calendar, Folder, Sparkles, Inbox, Mic, Pencil } from 'lucide-react';
import { getTodayWarsaw } from '../../lib/date';
import { listTodoSections, listTodoItems, updateTodoItem, logTaskReviewCompleted } from '../../lib/todo';
import { listRecentStreamEntries, updateStreamEntryContent, deleteStreamEntry, isVoiceEntry, type StreamEntry } from '../../lib/streamReview';

interface Props {
  session: any;
  onClose: () => void;
  onFinished?: () => void;
}

export default function WeeklyReviewModal({ session, onClose, onFinished }: Props) {
  const userId = session?.user?.id as string | undefined;
  const today = getTodayWarsaw();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1); // 1: Inbox Triage, 2: Section Audit, 3: Stream Review, 4: Synthesis, 5: Success

  const [sections, setSections] = useState<any[]>([]);
  const [inboxItems, setInboxItems] = useState<any[]>([]);
  const [sectionItems, setSectionItems] = useState<any[]>([]);

  // Stream review (Krok 3) — corrections to the raw Telegram/voice log the weekly AI synthesis reads
  const [streamEntries, setStreamEntries] = useState<StreamEntry[]>([]);
  const [editingStreamId, setEditingStreamId] = useState<string | null>(null);
  const [editingStreamText, setEditingStreamText] = useState('');

  // Track pending updates locally: itemId -> patch
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, any>>({});
  
  // Section audit state
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);

  // Reflection
  const [weeklyNote, setWeeklyNote] = useState('');

  // Fetch all tasks and sections
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    (async () => {
      try {
        // 1. Fetch active sections
        const secData = await listTodoSections(userId);
        setSections(secData);

        // 2. Fetch all active todo items
        const allItems = (await listTodoItems(userId)).filter((item) => item.status === 'open');
        setInboxItems(allItems.filter((item) => !item.section_id));
        setSectionItems(allItems.filter((item) => !!item.section_id));

        // 3. Fetch this week's raw Telegram/voice log for the correction pass
        setStreamEntries(await listRecentStreamEntries(userId));
      } catch (err) {
        console.error('Error fetching review data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // Handle stage item modifications locally
  const stageUpdate = (itemId: string, patch: any) => {
    setPendingUpdates((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], ...patch },
    }));
  };

  const getStagedItem = (item: any) => {
    const patch = pendingUpdates[item.id] || {};
    return { ...item, ...patch };
  };

  // Sections with tasks
  const activeSections = sections.filter((sec) => {
    const items = sectionItems.filter((item) => getStagedItem(item).section_id === sec.id);
    return items.some((item) => getStagedItem(item).status === 'open');
  });

  const startEditStream = (entry: StreamEntry) => {
    setEditingStreamId(entry.id);
    setEditingStreamText(entry.content || '');
  };

  const saveEditStream = async () => {
    if (!editingStreamId) return;
    const id = editingStreamId;
    const content = editingStreamText.trim();
    setEditingStreamId(null);
    if (!content) return;
    setStreamEntries((prev) => prev.map((e) => e.id === id ? { ...e, content } : e));
    try {
      await updateStreamEntryContent(id, content);
    } catch (err) {
      console.error('Error updating stream entry:', err);
    }
  };

  const handleDeleteStream = async (id: string) => {
    setStreamEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      await deleteStreamEntry(id);
    } catch (err) {
      console.error('Error deleting stream entry:', err);
    }
  };

  const handleSaveReview = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      // 1. Write all staged updates to Supabase
      await Promise.all(
        Object.entries(pendingUpdates).map(([id, patch]) => updateTodoItem(id, patch)),
      );

      // 2. Log completion so the Dashboard card knows not to nag again this week
      await logTaskReviewCompleted(userId, weeklyNote.trim());

      if (onFinished) onFinished();
      setStep(5); // Success screen
    } catch (err) {
      console.error('Error saving weekly review:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="rounded-2xl bg-background border border-border-custom/50 p-6 flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          <span className="text-[12px] font-bold text-text-muted">Wczytywanie Tygodniowego Przeglądu...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end sm:justify-center items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onClose} />

      {/* Sheet / Dialog */}
      <div className="relative w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-background border border-border-custom/60 shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[640px] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-border-custom/20 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-[15px] font-black text-text-primary uppercase tracking-wider">Tygodniowy Przegląd Zadań</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-semibold text-text-muted">Niedziela, {today}</span>
              {step < 5 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500">Krok {step} z 4</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Progress Line */}
        {step < 5 && (
          <div className="grid grid-cols-4 h-1 bg-border-custom/20 shrink-0">
            <div className={`h-full transition-all duration-300 ${step >= 1 ? 'bg-indigo-500' : 'bg-transparent'}`} />
            <div className={`h-full transition-all duration-300 ${step >= 2 ? 'bg-indigo-500' : 'bg-transparent'}`} />
            <div className={`h-full transition-all duration-300 ${step >= 3 ? 'bg-indigo-500' : 'bg-transparent'}`} />
            <div className={`h-full transition-all duration-300 ${step >= 4 ? 'bg-indigo-500' : 'bg-transparent'}`} />
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5">
          
          {/* STEP 1: Inbox Triage */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-[13px] font-black text-text-primary flex items-center gap-1.5">
                  <Inbox size={15} className="text-indigo-500" />
                  Krok 1: Oczyszczanie Skrzynki
                </h3>
                <p className="text-[10px] text-text-muted mt-0.5">Przypisz nieprzypisane zadania do sekcji lub zaplanuj termin.</p>
              </div>

              {inboxItems.length === 0 ? (
                <div className="py-12 text-center text-text-muted/60 italic text-[12px] bg-slate-50 dark:bg-white/[0.01] rounded-2xl border border-dashed border-border-custom/40">
                  Twoja Skrzynka jest pusta. Wszystkie zadania są sklasyfikowane!
                </div>
              ) : (
                <div className="space-y-3">
                  {inboxItems.map((item) => {
                    const staged = getStagedItem(item);
                    if (staged.status !== 'open') return null;

                    return (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl border border-border-custom/60 bg-surface-solid/35 space-y-3"
                      >
                        <span className="text-[12px] font-bold text-text-primary block break-words">
                          {item.title}
                        </span>

                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border-custom/10">
                          {/* Section Dropdown */}
                          <div className="flex items-center gap-1 bg-slate-50 dark:bg-white/[0.02] border border-border-custom/50 px-2 py-1 rounded-lg text-[10px] font-semibold text-text-secondary">
                            <Folder size={11} className="text-text-muted" />
                            <select
                              value={staged.section_id || ''}
                              onChange={(e) => stageUpdate(item.id, { section_id: e.target.value || null })}
                              className="bg-transparent outline-none cursor-pointer text-text-secondary"
                            >
                              <option value="">Skrzynka (brak)</option>
                              {sections.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Datepicker */}
                          <div className="flex items-center gap-1 bg-slate-50 dark:bg-white/[0.02] border border-border-custom/50 px-2 py-1 rounded-lg text-[10px] font-semibold text-text-secondary">
                            <Calendar size={11} className="text-text-muted" />
                            <input
                              type="date"
                              value={staged.due_date || ''}
                              onChange={(e) => stageUpdate(item.id, { due_date: e.target.value || null })}
                              className="bg-transparent outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                            />
                          </div>

                          {/* Complete Button */}
                          <button
                            onClick={() => stageUpdate(item.id, { status: 'done', completed_at: new Date().toISOString() })}
                            className="p-1 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500/10 transition-colors btn-press ml-auto"
                            title="Ukończ"
                          >
                            <Check size={12} />
                          </button>

                          {/* Drop Button */}
                          <button
                            onClick={() => stageUpdate(item.id, { status: 'dropped' })}
                            className="p-1 rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10 transition-colors btn-press"
                            title="Odpuść"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Section Audit */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-[13px] font-black text-text-primary flex items-center gap-1.5">
                  <Folder size={15} className="text-indigo-500" />
                  Krok 2: Audyt Sekcji i Projektów
                </h3>
                <p className="text-[10px] text-text-muted mt-0.5">Zweryfikuj zadania przypisane do poszczególnych sekcji.</p>
              </div>

              {activeSections.length === 0 ? (
                <div className="py-12 text-center text-text-muted/60 italic text-[12px] bg-slate-50 dark:bg-white/[0.01] rounded-2xl border border-dashed border-border-custom/40">
                  Brak otwartych zadań w projektach do audytu.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Current Section Indicator Tabs */}
                  <div className="flex flex-wrap gap-1">
                    {activeSections.map((sec, idx) => (
                      <button
                        key={sec.id}
                        onClick={() => setCurrentSectionIdx(idx)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                          idx === currentSectionIdx
                            ? 'bg-indigo-500 border-transparent text-white'
                            : 'border-border-custom/60 text-text-muted bg-surface-solid/20'
                        }`}
                      >
                        {sec.name}
                      </button>
                    ))}
                  </div>

                  {/* Tasks in Current Section */}
                  {(() => {
                    const currentSec = activeSections[currentSectionIdx];
                    if (!currentSec) return null;

                    const secTasks = sectionItems.filter(
                      (item) => getStagedItem(item).section_id === currentSec.id
                    );

                    const openTasks = secTasks.filter((item) => getStagedItem(item).status === 'open');

                    return (
                      <div className="space-y-2.5">
                        <div className="p-3 bg-slate-50 dark:bg-white/[0.01] rounded-xl border border-border-custom/30">
                          <span className="text-[11px] font-black text-indigo-500 uppercase tracking-wider block">Bieżący Projekt:</span>
                          <span className="text-[13px] font-bold text-text-primary mt-0.5 block">{currentSec.name}</span>
                        </div>

                        {openTasks.length === 0 ? (
                          <p className="text-[11px] text-text-muted/50 italic py-6 text-center">Brak otwartych zadań w tej sekcji.</p>
                        ) : (
                          <div className="space-y-2">
                            {openTasks.map((item) => {
                              const staged = getStagedItem(item);
                              return (
                                <div
                                  key={item.id}
                                  className="p-3 rounded-xl border border-border-custom/50 bg-surface-solid/30 flex items-center justify-between gap-3"
                                >
                                  <div className="min-w-0 flex-1">
                                    <span className="text-[12px] font-bold text-text-primary block truncate">
                                      {item.title}
                                    </span>
                                    {staged.due_date && (
                                      <span className="text-[9px] text-text-muted font-semibold mt-0.5 block">
                                        Termin: {staged.due_date}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {/* Datepicker */}
                                    <div className="relative flex items-center gap-1 bg-slate-50 dark:bg-white/[0.02] border border-border-custom/50 px-2 py-1 rounded-lg text-[10px] font-semibold text-text-secondary">
                                      <Calendar size={11} className="text-text-muted" />
                                      <input
                                        type="date"
                                        value={staged.due_date || ''}
                                        onChange={(e) => stageUpdate(item.id, { due_date: e.target.value || null })}
                                        className="bg-transparent outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                                      />
                                    </div>

                                    {/* Complete */}
                                    <button
                                      onClick={() => stageUpdate(item.id, { status: 'done', completed_at: new Date().toISOString() })}
                                      className="p-1 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500/10 transition-colors btn-press"
                                    >
                                      <Check size={12} />
                                    </button>

                                    {/* Drop */}
                                    <button
                                      onClick={() => stageUpdate(item.id, { status: 'dropped' })}
                                      className="p-1 rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10 transition-colors btn-press"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Stream / Voice Log Review */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-[13px] font-black text-text-primary flex items-center gap-1.5">
                  <Mic size={15} className="text-indigo-500" />
                  Krok 3: Kontrola Wpisów
                </h3>
                <p className="text-[10px] text-text-muted mt-0.5">Popraw literówki z transkrypcji, dopowiedz kontekst albo usuń wpisy, które trafiły do strumienia przez przypadek. To jest dokładnie to, co przeczyta tygodniowa synteza AI.</p>
              </div>

              {streamEntries.length === 0 ? (
                <div className="py-12 text-center text-text-muted/60 italic text-[12px] bg-slate-50 dark:bg-white/[0.01] rounded-2xl border border-dashed border-border-custom/40">
                  Brak wpisów z Telegrama w ostatnich 7 dniach.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {streamEntries.map((entry) => {
                    const isEditing = editingStreamId === entry.id;
                    const voice = isVoiceEntry(entry);
                    return (
                      <div
                        key={entry.id}
                        className="p-3 rounded-xl border border-border-custom/50 bg-surface-solid/30 space-y-2"
                      >
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-text-muted uppercase tracking-wider">
                          {voice && <Mic size={10} className="text-indigo-500 shrink-0" />}
                          <span>{entry.created_at ? new Date(entry.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
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
                              <button onClick={() => setEditingStreamId(null)} className="text-[10px] font-bold text-text-muted px-2 py-1">Anuluj</button>
                              <button onClick={saveEditStream} className="text-[10px] font-black text-white bg-indigo-600 rounded-lg px-3 py-1">Zapisz</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[12px] font-medium text-text-primary break-words flex-1">{entry.content || '(pusty wpis)'}</p>
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
          )}

          {/* STEP 4: Weekly Synthesis */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-[13px] font-black text-text-primary flex items-center gap-1.5">
                  <Sparkles size={15} className="text-indigo-500" />
                  Krok 4: Synteza Tygodnia
                </h3>
                <p className="text-[10px] text-text-muted mt-0.5">Podsumuj krótko ten tydzień. Jakie są Twoje najważniejsze lekcje i skupienie na kolejny tydzień?</p>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-text-primary block">Notatka tygodniowa</span>
                <textarea
                  value={weeklyNote}
                  onChange={(e) => setWeeklyNote(e.target.value)}
                  placeholder="Zapisz refleksje, np. 'Wyczyściłem 15 zaległych zadań, przełożyłem 3 projekty. W kolejnym tygodniu skupiam się na wdrożeniach Vanguard.'"
                  rows={6}
                  className="w-full bg-slate-50 dark:bg-white/[0.01] border border-border-custom/60 rounded-xl px-3 py-2 text-[12px] font-semibold text-text-primary placeholder:text-text-muted/30 focus:border-indigo-500/50 outline-none transition-colors resize-none"
                />
              </div>
            </div>
          )}

          {/* STEP 5: Success Screen */}
          {step === 5 && (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-3xl shadow-lg shadow-indigo-500/5">
                <Sparkles />
              </div>
              <div className="space-y-1">
                <h2 className="text-[16px] font-black text-text-primary uppercase tracking-wider">System oczyszczony!</h2>
                <p className="text-[12px] text-text-muted">Twój Tygodniowy Przegląd Zadań został zakończony. Masz teraz pełną jasność umysłu.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border-custom/20 flex items-center justify-between shrink-0">
          {step > 1 && step < 5 && (
            <button
              onClick={() => {
                if (step === 2) {
                  setStep(1);
                } else if (step === 3) {
                  setStep(2);
                } else if (step === 4) {
                  setStep(3);
                }
              }}
              className="px-4 py-3 rounded-xl border border-border-custom/80 text-text-primary text-[12px] font-black hover:bg-slate-100 dark:hover:bg-white/[0.03] transition-all flex items-center gap-1.5"
            >
              <ChevronLeft size={16} />
              Wróć
            </button>
          )}

          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              className="px-5 py-3 rounded-xl bg-indigo-600 text-white text-[12px] font-black hover:bg-indigo-500 transition-all flex items-center gap-1.5 ml-auto font-black"
            >
              Dalej
              <ChevronRight size={16} />
            </button>
          )}

          {step === 2 && (
            <button
              onClick={() => {
                // If there are more sections to review, let the user advance or skip
                if (currentSectionIdx < activeSections.length - 1) {
                  setCurrentSectionIdx((i) => i + 1);
                } else {
                  setStep(3);
                }
              }}
              className="px-5 py-3 rounded-xl bg-indigo-600 text-white text-[12px] font-black hover:bg-indigo-500 transition-all flex items-center gap-1.5 ml-auto font-black"
            >
              {currentSectionIdx < activeSections.length - 1 ? 'Następna Sekcja' : 'Dalej'}
              <ChevronRight size={16} />
            </button>
          )}

          {step === 3 && (
            <button
              onClick={() => setStep(4)}
              className="px-5 py-3 rounded-xl bg-indigo-600 text-white text-[12px] font-black hover:bg-indigo-500 transition-all flex items-center gap-1.5 ml-auto font-black"
            >
              Dalej
              <ChevronRight size={16} />
            </button>
          )}

          {step === 4 && (
            <button
              onClick={handleSaveReview}
              disabled={saving}
              className="px-5 py-3 rounded-xl bg-indigo-600 text-white text-[12px] font-black hover:bg-indigo-500 transition-all flex items-center gap-1.5 ml-auto font-black disabled:opacity-40"
            >
              {saving ? 'Zapisywanie...' : 'Zatwierdź Przegląd'}
              <Check size={16} />
            </button>
          )}

          {step === 5 && (
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-xl bg-indigo-600 text-white text-[12px] font-black hover:bg-indigo-500 transition-all text-center"
            >
              Zamknij
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
