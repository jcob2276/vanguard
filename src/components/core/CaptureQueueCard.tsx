import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Archive, BookOpen, Check, Inbox, ListTodo, StickyNote } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getTodayWarsaw } from '../../lib/date';
import { notify } from '../../lib/notify';
import { updateTodoItem } from '../../lib/todo';
import { convertLinkToTodoItem, convertNoteToTodoItem } from '../../lib/captureBridge';
import { useCaptureQueue, type CaptureQueueItem } from '../../hooks/useCaptureQueue';

const KIND_META = {
  link: { label: 'Pocket', icon: BookOpen, tone: 'text-sky-500 bg-sky-500/10' },
  todo: { label: 'Inbox', icon: ListTodo, tone: 'text-indigo-500 bg-indigo-500/10' },
  note: { label: 'Notatka', icon: StickyNote, tone: 'text-amber-500 bg-amber-500/10' },
} as const;

export default function CaptureQueueCard({
  session,
  onNavigate,
  onQueueChange,
}: {
  session: Session;
  onNavigate: (dest: string) => void;
  onQueueChange?: () => void;
}) {
  const userId = session.user.id;
  const { items, loading, refresh, total } = useCaptureQueue(userId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const today = getTodayWarsaw();

  const bump = () => {
    refresh();
    onQueueChange?.();
  };

  const markLinkRead = async (id: string) => {
    setBusyId(id);
    try {
      await supabase
        .from('vanguard_links')
        .update({ status: 'read', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId);
      bump();
    } catch (e: any) {
      notify(e.message || 'Błąd', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const linkToTodo = async (item: Extract<CaptureQueueItem, { kind: 'link' }>) => {
    setBusyId(item.id);
    try {
      await convertLinkToTodoItem(userId, { id: item.id, url: item.url, title: item.title });
      notify('Dodano do zadań', 'success');
      bump();
    } catch (e: any) {
      notify(e.message || 'Błąd', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const todoToday = async (id: string) => {
    setBusyId(id);
    try {
      await updateTodoItem(id, {
        due_date: today,
        ai_bucket: 'today',
        ai_classified_at: new Date().toISOString(),
      });
      bump();
    } catch (e: any) {
      notify(e.message || 'Błąd', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const classifyTodo = async (item: Extract<CaptureQueueItem, { kind: 'todo' }>) => {
    setBusyId(item.id);
    try {
      const base = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${base}/functions/v1/vanguard-todo-classify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ itemId: item.id, userId, title: item.title }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      bump();
    } catch (e: any) {
      notify(e.message || 'Klasyfikacja nie powiodła się', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const noteToTodo = async (item: Extract<CaptureQueueItem, { kind: 'note' }>) => {
    setBusyId(item.id);
    try {
      await convertNoteToTodoItem(userId, { id: item.id, title: item.title, content: item.content });
      notify('Dodano do zadań', 'success');
      bump();
    } catch (e: any) {
      notify(e.message || 'Błąd', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const keepNote = async (id: string) => {
    setBusyId(id);
    try {
      await supabase
        .from('vanguard_notes')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId);
      bump();
    } catch (e: any) {
      notify(e.message || 'Błąd', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const archiveNote = async (id: string) => {
    setBusyId(id);
    try {
      await supabase
        .from('vanguard_notes')
        .update({ is_archived: true, is_pinned: false })
        .eq('id', id)
        .eq('user_id', userId);
      bump();
    } catch (e: any) {
      notify(e.message || 'Błąd', 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (loading || total === 0) return null;

  return (
    <div className="rounded-[20px] border border-border-custom bg-surface/60 p-4 space-y-3 animate-fadeIn">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Inbox size={14} />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-text-muted">Do ogarnięcia</p>
            <p className="text-[12px] text-text-secondary">{total} {total === 1 ? 'rzecz czeka' : 'rzeczy czeka'} na decyzję</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const meta = KIND_META[item.kind];
          const Icon = meta.icon;
          const disabled = busyId === item.id;

          return (
            <div
              key={`${item.kind}-${item.id}`}
              className="rounded-[14px] border border-border-custom/60 bg-background/50 px-3 py-2.5 space-y-2"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${meta.tone}`}>
                  <Icon size={12} />
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate(item.kind === 'link' ? 'links' : item.kind === 'todo' ? 'todo' : 'keep')}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="text-[13px] font-semibold text-text-primary leading-snug truncate">{item.title}</p>
                  {item.kind === 'note' && item.snippet && (
                    <p className="text-[11px] text-text-muted line-clamp-1 mt-0.5">{item.snippet}</p>
                  )}
                  <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted/60 mt-1">{meta.label}</p>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 pl-8">
                {item.kind === 'link' && (
                  <>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => markLinkRead(item.id)}
                      className="rounded-lg border border-border-custom px-2.5 py-1 text-[10px] font-bold text-text-muted hover:text-text-primary disabled:opacity-50"
                    >
                      <Check size={10} className="inline mr-1" />
                      Przeczytane
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => linkToTodo(item)}
                      className="rounded-lg bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary hover:bg-primary/15 disabled:opacity-50"
                    >
                      → Zadanie
                    </button>
                  </>
                )}
                {item.kind === 'todo' && (
                  <>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => todoToday(item.id)}
                      className="rounded-lg bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary hover:bg-primary/15 disabled:opacity-50"
                    >
                      Dziś
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => classifyTodo(item)}
                      className="rounded-lg border border-border-custom px-2.5 py-1 text-[10px] font-bold text-text-muted hover:text-text-primary disabled:opacity-50"
                    >
                      Klasyfikuj
                    </button>
                  </>
                )}
                {item.kind === 'note' && (
                  <>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => noteToTodo(item)}
                      className="rounded-lg bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary hover:bg-primary/15 disabled:opacity-50"
                    >
                      → Zadanie
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => keepNote(item.id)}
                      className="rounded-lg border border-border-custom px-2.5 py-1 text-[10px] font-bold text-text-muted hover:text-text-primary disabled:opacity-50"
                    >
                      Zostaw
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => archiveNote(item.id)}
                      className="rounded-lg border border-border-custom px-2 py-1 text-text-muted hover:text-text-primary disabled:opacity-50"
                      title="Archiwizuj"
                    >
                      <Archive size={11} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
