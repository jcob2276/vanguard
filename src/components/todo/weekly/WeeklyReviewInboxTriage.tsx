import React from 'react';
import { useWeeklyReview } from './context/WeeklyReviewContext';
import { Inbox, Check, Trash2, Folder } from 'lucide-react';
import EmptyState from '../../ui/EmptyState';
import type { Database } from '../../../lib/database.types';

type TodoItemRow = Database['public']['Tables']['todo_items']['Row'];

export default function WeeklyReviewInboxTriage() {
  const {
    inboxItems,
    sections,
    stageUpdate,
    getStagedItem,
  } = useWeeklyReview();

  const openInboxItems = inboxItems.filter((item) => getStagedItem(item).status === 'open');

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-black text-text-primary flex items-center gap-1.5 uppercase tracking-wider">
          <Inbox size={15} className="text-primary" />
          Krok 1: Triaż Skrzynki Odbiorczej
        </h3>
        <p className="text-xs text-text-muted mt-0.5">
          Przenieś luźne zadania ze skrzynki do odpowiednich projektów lub zamknij/odpuść te, które nie są już aktualne.
        </p>
      </div>

      {openInboxItems.length === 0 ? (
        <EmptyState icon="📥" label="Twoja skrzynka odbiorcza jest pusta. Wszystkie zadania mają przypisane projekty!" />
      ) : (
        <div className="space-y-2">
          {openInboxItems.map((item: TodoItemRow) => {
            const staged = getStagedItem(item);
            return (
              <div
                key={item.id}
                className="p-3 rounded-xl border border-border-custom/50 bg-surface-solid/30 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-bold text-text-primary block truncate">
                    {item.title}
                  </span>
                  {staged.due_date && (
                    <span className="text-2xs text-text-muted font-semibold mt-0.5 block">
                      Termin: {staged.due_date}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Project Selector */}
                  <div className="relative flex items-center gap-1 bg-slate-50 dark:bg-white/[0.02] border border-border-custom/50 px-2 py-1 rounded-lg text-xs font-semibold text-text-secondary">
                    <Folder size={11} className="text-text-muted" />
                    <select
                      value={staged.section_id || ''}
                      onChange={(e) =>
                        stageUpdate(item.id, { section_id: e.target.value || null })
                      }
                      className="bg-transparent outline-none cursor-pointer pr-1"
                    >
                      <option value="">(Brak Projektu)</option>
                      {sections.map((sec) => (
                        <option key={sec.id} value={sec.id}>
                          {sec.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Complete Button */}
                  <button
                    onClick={() =>
                      stageUpdate(item.id, {
                        status: 'done',
                        completed_at: new Date().toISOString(),
                      })
                    }
                    className="p-1 rounded-lg border border-success/20 bg-success/5 text-success hover:bg-success/10 transition-colors btn-press"
                    title="Wykonaj"
                  >
                    <Check size={12} />
                  </button>

                  {/* Drop Button */}
                  <button
                    onClick={() => stageUpdate(item.id, { status: 'dropped' })}
                    className="p-1 rounded-lg border border-danger/20 bg-danger/5 text-danger hover:bg-danger/10 transition-colors btn-press"
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
  );
}
