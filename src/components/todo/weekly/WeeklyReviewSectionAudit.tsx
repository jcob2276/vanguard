import React from 'react';
import { useWeeklyReview } from './context/WeeklyReviewContext';
import { Folder, Calendar, Check, Trash2 } from 'lucide-react';
import EmptyState from '../../ui/EmptyState';
import type { Database } from '../../../lib/database.types';

type TodoItemRow = Database['public']['Tables']['todo_items']['Row'];

export default function WeeklyReviewSectionAudit() {
  const {
    activeSections,
    currentSectionIdx,
    setCurrentSectionIdx,
    sectionItems,
    getStagedItem,
    stageUpdate,
  } = useWeeklyReview();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[13px] font-black text-text-primary flex items-center gap-1.5 uppercase tracking-wider">
          <Folder size={15} className="text-indigo-500" />
          Krok 2: Audyt Sekcji i Projektów
        </h3>
        <p className="text-[10px] text-text-muted mt-0.5">
          Zweryfikuj zadania przypisane do poszczególnych sekcji.
        </p>
      </div>

      {activeSections.length === 0 ? (
        <EmptyState icon="✅" label="Brak otwartych zadań w projektach do audytu." />
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
                  <span className="text-[11px] font-black text-indigo-500 uppercase tracking-wider block">
                    Bieżący Projekt:
                  </span>
                  <span className="text-[13px] font-bold text-text-primary mt-0.5 block">
                    {currentSec.name}
                  </span>
                </div>

                {openTasks.length === 0 ? (
                  <p className="text-[11px] text-text-muted/50 italic py-6 text-center">
                    Brak otwartych zadań w tej sekcji.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {openTasks.map((item: TodoItemRow) => {
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
                                onChange={(e) =>
                                  stageUpdate(item.id, { due_date: e.target.value || null })
                                }
                                className="bg-transparent outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                              />
                            </div>

                            {/* Complete */}
                            <button
                              onClick={() =>
                                stageUpdate(item.id, {
                                  status: 'done',
                                  completed_at: new Date().toISOString(),
                                })
                              }
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
  );
}
