import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertCircle, Calendar, Plus, Trash2, Pin, Tag, Paintbrush, Loader } from 'lucide-react';
import DataStateNotice from '../core/DataStateNotice';

interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  is_pinned: boolean;
  tags: string[];
  created_at: string;
}

const COLORS = [
  { id: 'default', name: 'Domyślny', bg: 'bg-surface border-border-custom text-text-primary' },
  { id: 'red', name: 'Czerwony', bg: 'bg-rose-500/10 border-rose-500/20 text-rose-350 dark:text-rose-400' },
  { id: 'blue', name: 'Niebieski', bg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-550 dark:text-indigo-400' },
  { id: 'green', name: 'Zielony', bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' },
  { id: 'yellow', name: 'Żółty', bg: 'bg-amber-500/10 border-amber-500/20 text-amber-655 dark:text-amber-400' },
  { id: 'purple', name: 'Fioletowy', bg: 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400' },
];

export default function Keep({ session }) {
  const userId = session.user.id;
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState('default');
  const [tagsInput, setTagsInput] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  const fetchNotes = useCallback(async () => {
    setError(null);
    try {
      const { data, error: fetchErr } = await (supabase as any)
        .from('vanguard_notes')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (fetchErr) {
        // Fallback to localStorage if table is not applied on remote yet to prevent blocking the user
        if (fetchErr.code === 'PGRST205' || fetchErr.message.includes('vanguard_notes')) {
          console.warn('vanguard_notes table not applied on remote, falling back to localStorage');
          const local = localStorage.getItem('vanguard_local_keep_notes');
          setNotes(local ? JSON.parse(local) : []);
          return;
        }
        throw fetchErr;
      }
      setNotes(data || []);
    } catch (err: any) {
      console.error('Keep fetch error:', err);
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchNotes();
      setLoading(false);
    })();
  }, [fetchNotes]);

  const saveToLocalStorageFallback = (updated: Note[]) => {
    localStorage.setItem('vanguard_local_keep_notes', JSON.stringify(updated));
    setNotes(updated);
  };

  const handleCreateNote = async () => {
    if (!title.trim() && !content.trim()) return;
    setBusy(true);
    setError(null);

    const parsedTags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const newNote = {
      user_id: userId,
      title: title.trim(),
      content: content.trim(),
      color,
      is_pinned: isPinned,
      tags: parsedTags,
    };

    try {
      const { data, error: createErr } = await (supabase as any)
        .from('vanguard_notes')
        .insert(newNote)
        .select()
        .single();

      if (createErr) {
        if (createErr.code === 'PGRST205' || createErr.message.includes('vanguard_notes')) {
          // Local fallback
          const localNote: Note = {
            id: Math.random().toString(36).substring(2),
            title: title.trim(),
            content: content.trim(),
            color,
            is_pinned: isPinned,
            tags: parsedTags,
            created_at: new Date().toISOString(),
          };
          const updated = [localNote, ...notes].sort((a, b) => {
            if (a.is_pinned && !b.is_pinned) return -1;
            if (!a.is_pinned && b.is_pinned) return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
          saveToLocalStorageFallback(updated);
          resetForm();
          return;
        }
        throw createErr;
      }

      setNotes((prev) => [data, ...prev].sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }));
      resetForm();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setColor('default');
    setTagsInput('');
    setIsPinned(false);
  };

  const handleDeleteNote = async (id: string) => {
    setBusy(true);
    try {
      const { error: delErr } = await (supabase as any).from('vanguard_notes').delete().eq('id', id);
      if (delErr) {
        if (delErr.code === 'PGRST205' || delErr.message.includes('vanguard_notes')) {
          const updated = notes.filter((n) => n.id !== id);
          saveToLocalStorageFallback(updated);
          return;
        }
        throw delErr;
      }
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePin = async (note: Note) => {
    const nextPin = !note.is_pinned;
    try {
      const { error: updateErr } = await (supabase as any)
        .from('vanguard_notes')
        .update({ is_pinned: nextPin })
        .eq('id', note.id);

      if (updateErr) {
        if (updateErr.code === 'PGRST205' || updateErr.message.includes('vanguard_notes')) {
          const updated = notes.map((n) => (n.id === note.id ? { ...n, is_pinned: nextPin } : n)).sort((a, b) => {
            if (a.is_pinned && !b.is_pinned) return -1;
            if (!a.is_pinned && b.is_pinned) return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
          saveToLocalStorageFallback(updated);
          return;
        }
        throw updateErr;
      }

      setNotes((prev) =>
        prev
          .map((n) => (n.id === note.id ? { ...n, is_pinned: nextPin } : n))
          .sort((a, b) => {
            if (a.is_pinned && !b.is_pinned) return -1;
            if (!a.is_pinned && b.is_pinned) return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          })
      );
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
        <Loader className="animate-spin text-primary" size={24} />
        <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Wczytuję notatki...</p>
      </div>
    );
  }

  const pinnedNotes = notes.filter((n) => n.is_pinned);
  const otherNotes = notes.filter((n) => !n.is_pinned);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-black uppercase tracking-tight text-text-primary font-display flex items-center gap-2">
            <Paintbrush size={16} className="text-primary" /> Keep Notes
          </h2>
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-text-secondary">
            Twoje myśli i notatki w stylu Google Keep
          </p>
        </div>
      </div>

      {error && <DataStateNotice tone="warning" title="Błąd" detail={error} />}

      {/* Editor Box */}
      <div className="rounded-[24px] border border-border-custom bg-surface p-4.5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tytuł notatki"
            className="w-full bg-transparent text-[13px] font-black uppercase tracking-tight text-text-primary outline-none placeholder:text-text-muted/40 font-display"
          />
          <button
            type="button"
            onClick={() => setIsPinned(!isPinned)}
            className={`p-1.5 rounded-lg border transition-colors ${
              isPinned ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border-custom text-text-muted hover:text-text-primary'
            }`}
            title={isPinned ? 'Odepnij' : 'Przypnij'}
          >
            <Pin size={12} fill={isPinned ? 'currentColor' : 'none'} />
          </button>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Napisz notatkę..."
          rows={3}
          className="w-full bg-transparent text-[12px] font-semibold leading-relaxed text-text-secondary outline-none placeholder:text-text-muted/40 resize-none"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border-custom/50">
          {/* Color Selector */}
          <div className="flex items-center gap-1">
            {COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColor(c.id)}
                className={`h-5 w-5 rounded-full border transition-all ${
                  c.id === 'default' ? 'bg-surface-solid' : `bg-${c.id}-500/20`
                } ${color === c.id ? 'border-primary scale-110 shadow-sm' : 'border-border-custom hover:scale-105'}`}
                style={{
                  backgroundColor: c.id === 'red' ? 'rgba(239, 68, 68, 0.2)' :
                                   c.id === 'blue' ? 'rgba(59, 130, 246, 0.2)' :
                                   c.id === 'green' ? 'rgba(16, 185, 129, 0.2)' :
                                   c.id === 'yellow' ? 'rgba(245, 158, 11, 0.2)' :
                                   c.id === 'purple' ? 'rgba(139, 92, 246, 0.2)' : undefined
                }}
                title={c.name}
              />
            ))}
          </div>

          {/* Tags input */}
          <div className="flex items-center gap-1.5 min-w-[120px] max-w-[180px]">
            <Tag size={11} className="text-text-muted shrink-0" />
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Tagi (po przecinku)"
              className="w-full bg-transparent text-[10px] font-semibold text-text-secondary outline-none placeholder:text-text-muted/40"
            />
          </div>

          <button
            type="button"
            onClick={handleCreateNote}
            disabled={busy || (!title.trim() && !content.trim())}
            className="rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 text-[9px] font-black uppercase tracking-widest text-white transition-all disabled:opacity-45 cursor-pointer font-display"
          >
            Dodaj
          </button>
        </div>
      </div>

      {/* Grid of Notes */}
      {notes.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-border-custom p-8 text-center bg-surface/30">
          <p className="text-[11px] font-black uppercase tracking-widest text-text-primary font-display">Brak notatek</p>
          <p className="mt-1 text-[9px] font-bold text-text-muted uppercase">Utwórz swoją pierwszą notatkę u góry.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pinned Section */}
          {pinnedNotes.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted pl-1">Przypięte</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pinnedNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onDelete={handleDeleteNote}
                    onTogglePin={handleTogglePin}
                    busy={busy}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other Notes Section */}
          {otherNotes.length > 0 && (
            <div className="space-y-2.5">
              {pinnedNotes.length > 0 && (
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted pl-1">Inne</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {otherNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onDelete={handleDeleteNote}
                    onTogglePin={handleTogglePin}
                    busy={busy}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NoteCard({
  note,
  onDelete,
  onTogglePin,
  busy,
}: {
  note: Note;
  onDelete: (id: string) => void;
  onTogglePin: (note: Note) => void;
  busy: boolean;
}) {
  const colorObj = COLORS.find((c) => c.id === note.color) || COLORS[0];

  return (
    <article className={`rounded-[20px] border p-4.5 flex flex-col justify-between transition-all duration-300 ${colorObj.bg}`}>
      <div>
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-display text-[12.5px] font-black uppercase tracking-tight leading-tight">{note.title || 'Bez tytułu'}</h4>
          <button
            type="button"
            onClick={() => onTogglePin(note)}
            className="text-text-muted hover:text-text-primary transition-colors shrink-0"
          >
            <Pin size={11} fill={note.is_pinned ? 'currentColor' : 'none'} />
          </button>
        </div>

        <p className="mt-2 text-[11px] font-semibold leading-relaxed whitespace-pre-wrap">{note.content}</p>

        {note.tags && note.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {note.tags.map((t, idx) => (
              <span
                key={idx}
                className="rounded-md border border-border-custom bg-surface-solid/50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-text-secondary"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border-custom/50 pt-2.5">
        <span className="text-[8px] font-bold uppercase tracking-wider text-text-muted">
          {new Date(note.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
        </span>
        <button
          type="button"
          onClick={() => onDelete(note.id)}
          disabled={busy}
          className="text-text-muted hover:text-rose-500 transition-colors cursor-pointer disabled:opacity-40"
          title="Usuń"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </article>
  );
}
