import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  AlertCircle,
  ArrowLeft,
  CheckSquare,
  Grid3X3,
  LayoutList,
  Loader2,
  Pin,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
  Archive,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  is_pinned: boolean;
  is_archived?: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

// ─── Color Palette ────────────────────────────────────────────────────────────
// Each color has a bg, readable text colors, border, and dot for the swatch

const COLORS: {
  id: string;
  label: string;
  bg: string;
  border: string;
  dot: string;
  text: string;       // primary text on this bg
  textSub: string;    // secondary text on this bg
  tagBg: string;
  tagText: string;
}[] = [
  { id: 'default', label: 'Domyślny',    bg: 'var(--keep-bg-default)', border: 'var(--keep-border-default)', dot: '#64748b', text: 'var(--keep-text-default)', textSub: 'var(--keep-text-sub-default)', tagBg: 'var(--keep-tag-bg-default)', tagText: 'var(--keep-tag-text-default)' },
  { id: 'red',     label: 'Koralowy',    bg: 'var(--keep-bg-red)',     border: 'var(--keep-border-red)',     dot: '#ef4444', text: 'var(--keep-text-red)',     textSub: 'var(--keep-text-sub-red)',     tagBg: 'var(--keep-tag-bg-red)',     tagText: 'var(--keep-tag-text-red)' },
  { id: 'orange',  label: 'Pomarańczowy',bg: 'var(--keep-bg-orange)',   border: 'var(--keep-border-orange)',  dot: '#f97316', text: 'var(--keep-text-orange)',  textSub: 'var(--keep-text-sub-orange)',  tagBg: 'var(--keep-tag-bg-orange)',  tagText: 'var(--keep-tag-text-orange)' },
  { id: 'yellow',  label: 'Żółty',       bg: 'var(--keep-bg-yellow)',   border: 'var(--keep-border-yellow)',  dot: '#f59e0b', text: 'var(--keep-text-yellow)',  textSub: 'var(--keep-text-sub-yellow)',  tagBg: 'var(--keep-tag-bg-yellow)',  tagText: 'var(--keep-tag-text-yellow)' },
  { id: 'green',   label: 'Szałwia',     bg: 'var(--keep-bg-green)',    border: 'var(--keep-border-green)',   dot: '#22c55e', text: 'var(--keep-text-green)',   textSub: 'var(--keep-text-sub-green)',   tagBg: 'var(--keep-tag-bg-green)',   tagText: 'var(--keep-tag-text-green)' },
  { id: 'teal',    label: 'Teal',        bg: 'var(--keep-bg-teal)',     border: 'var(--keep-border-teal)',    dot: '#14b8a6', text: 'var(--keep-text-teal)',     textSub: 'var(--keep-text-sub-teal)',     tagBg: 'var(--keep-tag-bg-teal)',     tagText: 'var(--keep-tag-text-teal)' },
  { id: 'blue',    label: 'Niebieski',   bg: 'var(--keep-bg-blue)',     border: 'var(--keep-border-blue)',    dot: '#3b82f6', text: 'var(--keep-text-blue)',     textSub: 'var(--keep-text-sub-blue)',     tagBg: 'var(--keep-tag-bg-blue)',     tagText: 'var(--keep-tag-text-blue)' },
  { id: 'indigo',  label: 'Indygo',      bg: 'var(--keep-bg-indigo)',   border: 'var(--keep-border-indigo)',  dot: '#6366f1', text: 'var(--keep-text-indigo)',   textSub: 'var(--keep-text-sub-indigo)',   tagBg: 'var(--keep-tag-bg-indigo)',   tagText: 'var(--keep-tag-text-indigo)' },
  { id: 'purple',  label: 'Fioletowy',   bg: 'var(--keep-bg-purple)',   border: 'var(--keep-border-purple)',  dot: '#a855f7', text: 'var(--keep-text-purple)',   textSub: 'var(--keep-text-sub-purple)',   tagBg: 'var(--keep-tag-bg-purple)',   tagText: 'var(--keep-tag-text-purple)' },
  { id: 'pink',    label: 'Różowy',      bg: 'var(--keep-bg-pink)',     border: 'var(--keep-border-pink)',    dot: '#ec4899', text: 'var(--keep-text-pink)',     textSub: 'var(--keep-text-sub-pink)',     tagBg: 'var(--keep-tag-bg-pink)',     tagText: 'var(--keep-tag-text-pink)' },
];

const getColor = (id: string) => COLORS.find(c => c.id === id) ?? COLORS[0];

// ─── Inline composer ─────────────────────────────────────────────────────────

function NoteComposer({ onSave, busy, autoExpand = false }: { onSave: (n: Partial<Note>) => void; busy: boolean; autoExpand?: boolean }) {
  const [expanded, setExpanded] = useState(autoExpand);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState('default');
  const [tagsInput, setTagsInput] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (!title.trim() && !content.trim()) setExpanded(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [title, content]);

  const handleSave = () => {
    if (!title.trim() && !content.trim()) return;
    onSave({
      title: title.trim(),
      content: content.trim(),
      color,
      is_pinned: isPinned,
      is_archived: false,
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
    });
    setTitle(''); setContent(''); setColor('default'); setTagsInput(''); setIsPinned(false);
    setExpanded(false);
  };

  const c = getColor(color);

  return (
    <div ref={ref} className="keep-composer" style={{ backgroundColor: c.bg, borderColor: c.border }}>
      {!expanded ? (
        <button className="keep-composer-placeholder" onClick={() => setExpanded(true)} type="button">
          <span style={{ color: 'var(--text-muted)' }}>Utwórz notatkę…</span>
          <div className="keep-composer-quick-btns">
            <Plus size={18} />
          </div>
        </button>
      ) : (
        <div className="keep-composer-body">
          <div className="keep-composer-title-row">
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Tytuł"
              className="keep-composer-title"
              style={{ color: c.text }}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
            <button
              onClick={() => setIsPinned(p => !p)}
              className={`keep-icon-btn ${isPinned ? 'active' : ''}`}
              title={isPinned ? 'Odepnij' : 'Przypnij'}
              type="button"
            >
              <Pin size={15} fill={isPinned ? 'currentColor' : 'none'} />
            </button>
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Utwórz notatkę…"
            rows={4}
            className="keep-composer-content"
            style={{ color: c.textSub }}
          />
          <div className="keep-composer-tags-row">
            <Tag size={11} className="keep-tag-icon" />
            <input
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="Tagi oddzielone przecinkiem…"
              className="keep-composer-tags-input"
            />
          </div>
          <div className="keep-composer-toolbar">
            <div className="keep-color-row">
              {COLORS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  onClick={() => setColor(c.id)}
                  className={`keep-swatch ${color === c.id ? 'selected' : ''}`}
                  style={{ backgroundColor: c.dot }}
                />
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => { setTitle(''); setContent(''); setExpanded(false); }} className="keep-btn-ghost">Anuluj</button>
            <button type="button" onClick={handleSave} disabled={busy || (!title.trim() && !content.trim())} className="keep-btn-primary">
              {busy ? <Loader2 size={13} className="animate-spin" /> : 'Zapisz'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Note Card ────────────────────────────────────────────────────────────────

function NoteCard({
  note,
  onDelete,
  onTogglePin,
  onUpdate,
  busy,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDragOver,
  isDragOver,
}: {
  note: Note;
  onDelete: (id: string) => void;
  onTogglePin: (note: Note) => void;
  onUpdate: (id: string, patch: Partial<Note>) => void;
  busy: boolean;
  onDragStart: (id: string) => void;
  onDragEnter: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  isDragOver: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [color, setColor] = useState(note.color);
  const [tagsInput, setTagsInput] = useState(note.tags.join(', '));
  const ref = useRef<HTMLDivElement>(null);
  const c = getColor(color);

  useEffect(() => {
    if (!editing) {
      setTitle(note.title);
      setContent(note.content);
      setColor(note.color);
      setTagsInput(note.tags.join(', '));
    }
  }, [note, editing]);

  const handleSave = useCallback(() => {
    const patch: Partial<Note> = {
      title: title.trim(),
      content: content.trim(),
      color,
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
    };
    onUpdate(note.id, patch);
    setEditing(false);
  }, [color, content, note.id, onUpdate, tagsInput, title]);

  useEffect(() => {
    if (!editing) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handleSave();
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editing, handleSave]);

  return (
    <div
      ref={ref}
      className={`keep-card ${editing ? 'editing' : ''} ${note.is_pinned ? 'pinned' : ''} ${isDragOver ? 'drag-over' : ''}`}
      style={editing ? {} : { backgroundColor: c.bg, borderColor: isDragOver ? '#6366f1' : c.border }}
      onClick={() => !editing && setEditing(true)}
      draggable={!editing}
      onDragStart={() => onDragStart(note.id)}
      onDragEnter={() => onDragEnter(note.id)}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
    >
      {/* Pin badge */}
      {note.is_pinned && !editing && (
        <div className="keep-pin-badge">
          <Pin size={9} fill="currentColor" />
        </div>
      )}

      {editing ? (
        <>
          <div className="keep-modal-backdrop" onClick={e => { e.stopPropagation(); handleSave(); }} />
          <div className="keep-modal-content" style={{ backgroundColor: c.bg, borderColor: c.border }} onClick={e => e.stopPropagation()}>
            <div className="keep-ios-grab-handle" />
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Tytuł"
              className="keep-card-title-input"
              style={{ color: c.text }}
            />
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Treść notatki…"
              className="keep-card-content-input"
              style={{ color: c.textSub }}
              rows={6}
            />
            <div className="keep-composer-tags-row" style={{ marginBottom: 8 }}>
              <Tag size={10} className="keep-tag-icon" />
              <input
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="Tagi…"
                className="keep-composer-tags-input"
              />
            </div>
            <div className="keep-color-row" style={{ marginBottom: 10 }}>
              {COLORS.map(col => (
                <button
                  key={col.id}
                  type="button"
                  title={col.label}
                  onClick={e => { e.stopPropagation(); setColor(col.id); }}
                  className={`keep-swatch ${color === col.id ? 'selected' : ''}`}
                  style={{ backgroundColor: col.dot }}
                />
              ))}
            </div>
            <div className="keep-card-edit-actions">
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onTogglePin(note); }}
                className={`keep-icon-btn ${note.is_pinned ? 'active' : ''}`}
                title={note.is_pinned ? 'Odepnij' : 'Przypnij'}
              >
                <Pin size={13} fill={note.is_pinned ? 'currentColor' : 'none'} />
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onUpdate(note.id, { is_archived: !note.is_archived, is_pinned: false }); }}
                className={`keep-icon-btn ${note.is_archived ? 'active' : ''}`}
                title={note.is_archived ? 'Przywróć z archiwum' : 'Archiwizuj'}
              >
                <Archive size={13} fill={note.is_archived ? 'currentColor' : 'none'} />
              </button>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onDelete(note.id); }}
                disabled={busy}
                className="keep-icon-btn danger"
                title="Usuń"
              >
                <Trash2 size={13} />
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); handleSave(); }}
                className="keep-btn-primary small"
              >
                Zamknij
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Drag handle — shows on hover */}
          <div className="keep-drag-handle" title="Przeciągnij aby przenieść">
            <span />
            <span />
            <span />
          </div>

          {note.title && (
            <h3 className="keep-card-title" style={{ color: c.text }}>{note.title}</h3>
          )}
          {note.content && (
            <p className="keep-card-content" style={{ color: c.textSub }}>{note.content}</p>
          )}
          {note.tags.length > 0 && (
            <div className="keep-card-tags">
              {note.tags.map((t, i) => (
                <span key={i} className="keep-tag" style={{ background: c.tagBg, color: c.tagText, borderColor: 'transparent' }}>{t}</span>
              ))}
            </div>
          )}
          <div className="keep-card-footer" style={{ borderTopColor: 'rgba(255,255,255,0.08)' }}>
            <span className="keep-card-date" style={{ color: c.textSub, opacity: 0.6 }}>
              {new Date(note.updated_at || note.created_at).toLocaleDateString('pl-PL', {
                day: 'numeric', month: 'short',
              })}
            </span>
             <div className="keep-card-actions">
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onTogglePin(note); }}
                className={`keep-icon-btn ${note.is_pinned ? 'active' : ''}`}
                title={note.is_pinned ? 'Odepnij' : 'Przypnij'}
              >
                <Pin size={11} fill={note.is_pinned ? 'currentColor' : 'none'} />
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onUpdate(note.id, { is_archived: !note.is_archived, is_pinned: false }); }}
                className={`keep-icon-btn ${note.is_archived ? 'active' : ''}`}
                title={note.is_archived ? 'Przywróć z archiwum' : 'Archiwizuj'}
              >
                <Archive size={11} fill={note.is_archived ? 'currentColor' : 'none'} />
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onDelete(note.id); }}
                disabled={busy}
                className="keep-icon-btn danger"
                title="Usuń"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Draggable Masonry grid ───────────────────────────────────────────────────

function MasonryGrid({
  notes,
  onDelete,
  onTogglePin,
  onUpdate,
  onReorder,
  busy,
  columns,
}: {
  notes: Note[];
  onDelete: (id: string) => void;
  onTogglePin: (note: Note) => void;
  onUpdate: (id: string, patch: Partial<Note>) => void;
  onReorder: (dragId: string, overId: string) => void;
  busy: boolean;
  columns: number;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Distribute notes into columns
  const cols: Note[][] = Array.from({ length: columns }, () => []);
  notes.forEach((note, i) => cols[i % columns].push(note));

  const handleDragStart = (id: string) => setDragId(id);
  const handleDragEnter = (id: string) => setOverId(id);
  const handleDragEnd = () => {
    if (dragId && overId && dragId !== overId) {
      onReorder(dragId, overId);
    }
    setDragId(null);
    setOverId(null);
  };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  return (
    <div className="keep-masonry" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {cols.map((col, ci) => (
        <div key={ci} className="keep-masonry-col">
          {col.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onDelete={onDelete}
              onTogglePin={onTogglePin}
              onUpdate={onUpdate}
              busy={busy}
              onDragStart={handleDragStart}
              onDragEnter={handleDragEnter}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              isDragOver={overId === note.id && dragId !== note.id}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Main Keep page ───────────────────────────────────────────────────────────

export default function Keep({ session }: { session: any }) {
  const userId = session.user.id;
  const autoNewNote = new URLSearchParams(window.location.search).get('new') === '1';

  useEffect(() => {
    if (autoNewNote) window.history.replaceState({}, '', '/keep');
  }, [autoNewNote]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'notes' | 'archive'>('notes');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [columns, setColumns] = useState(3);

  // Responsive columns
  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      if (w < 640) {
        setColumns(viewMode === 'grid' ? 2 : 1);
      } else if (w < 900) {
        setColumns(2);
      } else if (w < 1300) {
        setColumns(3);
      } else {
        setColumns(4);
      }
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [viewMode]);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchNotes = useCallback(async () => {
    setError(null);
    try {
      const { data, error: err } = await (supabase as any)
        .from('vanguard_notes')
        .select('*')
        .eq('user_id', userId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (err) {
        if (err.code === 'PGRST205' || err.message?.includes('vanguard_notes')) {
          const local = localStorage.getItem('vanguard_local_keep_notes');
          setNotes(local ? JSON.parse(local) : []);
          return;
        }
        throw err;
      }
      setNotes(data || []);
    } catch (e: any) {
      setError(e.message);
    }
  }, [userId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchNotes();
      setLoading(false);
    })();
  }, [fetchNotes]);

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  const sortNotes = (arr: Note[]) =>
    [...arr].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const handleCreate = async (partial: Partial<Note>) => {
    setBusy(true);
    setError(null);
    const payload = { user_id: userId, ...partial };
    try {
      const { data, error: err } = await (supabase as any)
        .from('vanguard_notes')
        .insert(payload)
        .select()
        .single();
      if (err) {
        if (err.code === 'PGRST205' || err.message?.includes('vanguard_notes')) {
          const local: Note = {
            id: Math.random().toString(36).slice(2),
            title: partial.title || '',
            content: partial.content || '',
            color: partial.color || 'default',
            is_pinned: partial.is_pinned || false,
            tags: partial.tags || [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          const updated = sortNotes([local, ...notes]);
          localStorage.setItem('vanguard_local_keep_notes', JSON.stringify(updated));
          setNotes(updated);
          return;
        }
        throw err;
      }
      setNotes(prev => sortNotes([data, ...prev]));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (id: string, patch: Partial<Note>) => {
    try {
      const { error: err } = await (supabase as any)
        .from('vanguard_notes')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (err && !(err.code === 'PGRST205')) throw err;
      setNotes(prev =>
        sortNotes(prev.map(n => (n.id === id ? { ...n, ...patch, updated_at: new Date().toISOString() } : n)))
      );
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    try {
      const { error: err } = await (supabase as any).from('vanguard_notes').delete().eq('id', id);
      if (err && !(err.code === 'PGRST205')) throw err;
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePin = async (note: Note) => {
    const next = !note.is_pinned;
    try {
      const { error: err } = await (supabase as any)
        .from('vanguard_notes')
        .update({ is_pinned: next })
        .eq('id', note.id);
      if (err && !(err.code === 'PGRST205')) throw err;
      setNotes(prev => sortNotes(prev.map(n => (n.id === note.id ? { ...n, is_pinned: next } : n))));
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ─── Drag & Drop reorder ─────────────────────────────────────────────────────

  const handleReorder = (dragId: string, overId: string) => {
    setNotes(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(n => n.id === dragId);
      const toIdx = arr.findIndex(n => n.id === overId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      // Only allow reordering within same group (pinned↔pinned or others↔others)
      if (arr[fromIdx].is_pinned !== arr[toIdx].is_pinned) return prev;
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
  };

  // ─── Filter & search ────────────────────────────────────────────────────────

  const allTags = Array.from(new Set(notes.flatMap(n => n.tags))).sort();

  const filtered = notes.filter(n => {
    const matchTab = sidebarTab === 'notes' ? !n.is_archived : !!n.is_archived;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some(t => t.toLowerCase().includes(q));
    const matchTag = !activeTag || n.tags.includes(activeTag);
    return matchTab && matchSearch && matchTag;
  });

  const pinned = sidebarTab === 'notes' ? filtered.filter(n => n.is_pinned) : [];
  const others = sidebarTab === 'notes' ? filtered.filter(n => !n.is_pinned) : filtered;

  const sharedGridProps = {
    onDelete: handleDelete,
    onTogglePin: handleTogglePin,
    onUpdate: handleUpdate,
    onReorder: handleReorder,
    busy,
    columns,
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="keep-root">
      {/* ── Topbar ── */}
      <header className="keep-header">
        <div className="keep-header-left">
          <a href="/" className="keep-back-btn" title="Wróć">
            <ArrowLeft size={16} />
          </a>
          <div className="keep-logo">
            <CheckSquare size={18} className="keep-logo-icon" />
            <span>Notatki</span>
          </div>
        </div>

        <div className="keep-search-wrap">
          <Search size={14} className="keep-search-icon" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj notatek…"
            className="keep-search"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="keep-search-clear">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="keep-header-right">
          <button
            type="button"
            onClick={() => setViewMode(v => (v === 'grid' ? 'list' : 'grid'))}
            className="keep-icon-btn"
            title={viewMode === 'grid' ? 'Lista' : 'Siatka'}
          >
            {viewMode === 'grid' ? <LayoutList size={16} /> : <Grid3X3 size={16} />}
          </button>
        </div>
      </header>

      <div className="keep-body">
        {/* ── Sidebar ── */}
        <aside className="keep-sidebar">
          <button
            className={`keep-sidebar-item ${sidebarTab === 'notes' && !activeTag ? 'active' : ''}`}
            onClick={() => { setSidebarTab('notes'); setActiveTag(null); }}
          >
            <CheckSquare size={15} />
            <span>Notatki</span>
          </button>
          <button
            className={`keep-sidebar-item ${sidebarTab === 'archive' && !activeTag ? 'active' : ''}`}
            onClick={() => { setSidebarTab('archive'); setActiveTag(null); }}
          >
            <Archive size={15} />
            <span>Archiwum</span>
          </button>
          <div className="keep-sidebar-separator" style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />
          {allTags.map(tag => (
            <button
              key={tag}
              className={`keep-sidebar-item ${activeTag === tag ? 'active' : ''}`}
              onClick={() => { setSidebarTab('notes'); setActiveTag(t => (t === tag ? null : tag)); }}
            >
              <Tag size={13} />
              <span>{tag}</span>
            </button>
          ))}
        </aside>

        {/* ── Main ── */}
        <main className="keep-main">
          {error && (
            <div className="keep-error">
              <AlertCircle size={14} />
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="keep-error-close"><X size={12} /></button>
            </div>
          )}

          {/* Composer (visible only in main Notes tab) */}
          {sidebarTab === 'notes' && (
            <div className="keep-composer-wrap">
              <NoteComposer onSave={handleCreate} busy={busy} autoExpand={autoNewNote} />
            </div>
          )}

          {loading ? (
            <div className="keep-loading">
              <Loader2 size={28} className="animate-spin keep-loader-icon" />
              <p>Wczytuję notatki…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="keep-empty">
              <CheckSquare size={42} strokeWidth={1} className="keep-empty-icon" />
              <p className="keep-empty-title">
                {search || activeTag ? 'Brak wyników' : 'Brak notatek'}
              </p>
              <p className="keep-empty-sub">
                {search || activeTag
                  ? 'Spróbuj innego wyszukiwania lub filtra.'
                  : 'Utwórz pierwszą notatkę powyżej.'}
              </p>
            </div>
          ) : (
            <div className="keep-sections">
              {/* Pinned */}
              {pinned.length > 0 && (
                <section className="keep-section">
                  <h2 className="keep-section-label">
                    <Pin size={11} fill="currentColor" /> Przypięte
                  </h2>
                  {viewMode === 'grid' ? (
                    <MasonryGrid notes={pinned} {...sharedGridProps} />
                  ) : (
                    <div className="keep-list">
                      {pinned.map(note => (
                        <NoteCard
                          key={note.id}
                          note={note}
                          onDelete={handleDelete}
                          onTogglePin={handleTogglePin}
                          onUpdate={handleUpdate}
                          busy={busy}
                          onDragStart={() => {}}
                          onDragEnter={() => {}}
                          onDragEnd={() => {}}
                          onDragOver={e => e.preventDefault()}
                          isDragOver={false}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Others */}
              {others.length > 0 && (
                <section className="keep-section">
                  {pinned.length > 0 && (
                    <h2 className="keep-section-label">Inne</h2>
                  )}
                  {viewMode === 'grid' ? (
                    <MasonryGrid notes={others} {...sharedGridProps} />
                  ) : (
                    <div className="keep-list">
                      {others.map(note => (
                        <NoteCard
                          key={note.id}
                          note={note}
                          onDelete={handleDelete}
                          onTogglePin={handleTogglePin}
                          onUpdate={handleUpdate}
                          busy={busy}
                          onDragStart={() => {}}
                          onDragEnter={() => {}}
                          onDragEnd={() => {}}
                          onDragOver={e => e.preventDefault()}
                          isDragOver={false}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
