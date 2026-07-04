import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  BookOpen,
  CheckSquare,
  Grid3X3,
  LayoutList,
  ListTodo,
  Loader2,
  Pin,
  Plus,
  Search,
  Tag,
  X,
  Calendar,
} from 'lucide-react';
import EditNoteModal from './EditNoteModal';
import NoteCard from './NoteCard';
import MasonryGrid from './MasonryGrid';
import NoteQuickCapture from './NoteQuickCapture';
import { Note } from './keepUtils';
import { convertNoteToTodoItem, exportNoteChecklistsToTodos } from '../../lib/captureBridge';
import { notify, dismissToast } from '../../lib/notify';

export default function Keep({ session, onBack, onNavigateTo }: { session: any; onBack?: () => void; onNavigateTo?: (dest: string) => void }) {
  const userId = session.user.id;
  const navigate = useNavigate();
  const autoNewNote = new URLSearchParams(window.location.search).get('new') === '1'
    || localStorage.getItem('vanguard_keep_new') === '1';

  useEffect(() => {
    if (localStorage.getItem('vanguard_keep_new') === '1') {
      try { localStorage.removeItem('vanguard_keep_new'); } catch (e) {}
    }
  }, []);

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'notes' | 'archive'>('notes');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [columns, setColumns] = useState(3);
  const [editingId, setEditingId] = useState<string | null>(null);

  const goTo = (dest: string) => {
    if (onNavigateTo) {
      onNavigateTo(dest);
    } else {
      try { localStorage.setItem('vanguard_view', dest); } catch (e) {}
      navigate('/');
    }
  };

  const handleOpenCard = useCallback((id: string) => setEditingId(id), []);
  const handleCloseCard = useCallback(() => setEditingId(null), []);

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

  // Helper to determine network/schema issues for local storage fallback
  const isNetworkOrTableError = useCallback((err: any) => {
    if (!err) return false;
    const msg = err.message?.toLowerCase() || '';
    return (
      err.code === 'PGRST205' ||
      err.code === 'PGRST100' ||
      msg.includes('vanguard_notes') ||
      msg.includes('fetch') ||
      msg.includes('network') ||
      msg.includes('failed to fetch') ||
      !navigator.onLine
    );
  }, []);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchNotes = useCallback(async () => {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('vanguard_notes')
        .select('*')
        .eq('user_id', userId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (err) {
        if (isNetworkOrTableError(err)) {
          const local = localStorage.getItem('vanguard_local_keep_notes');
          try {
            setNotes(local ? JSON.parse(local) : []);
          } catch (e) {
            setNotes([]);
          }
          return;
        }
        throw err;
      }
      setNotes(data || []);
    } catch (e: any) {
      const local = localStorage.getItem('vanguard_local_keep_notes');
      try {
        setNotes(local ? JSON.parse(local) : []);
      } catch (e2) {
        setNotes([]);
      }
      if (!navigator.onLine) {
        setError('Brak połączenia sieciowego. Załadowano notatki lokalne.');
      } else {
        setError(e.message || 'Błąd połączenia. Załadowano wersję lokalną.');
      }
    }
  }, [userId, isNetworkOrTableError]);

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
      const { data, error: err } = await supabase
        .from('vanguard_notes')
        .insert(payload)
        .select()
        .single();
      if (err) {
        if (isNetworkOrTableError(err)) {
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
      setError('Brak połączenia. Zapisano notatkę lokalnie.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (id: string, patch: Partial<Note>) => {
    const updatedAt = new Date().toISOString();

    // Archive / unarchive — undo pattern
    if ('is_archived' in patch) {
      const original = notes.find(n => n.id === id);
      if (!original) return;

      const isArchiving = patch.is_archived && !original.is_archived;
      setNotes(prev => sortNotes(prev.map(n => (n.id === id ? { ...n, ...patch, updated_at: updatedAt } : n))));

      let cancelled = false;
      const timer = window.setTimeout(async () => {
        if (cancelled) return;
        await supabase.from('vanguard_notes').update({ ...patch, updated_at: updatedAt }).eq('id', id);
      }, 5000);

      const toastId = notify(isArchiving ? 'Zarchiwizowano' : 'Przywrócono', 'info', {
        duration: 5000,
        action: {
          label: 'Cofnij',
          onClick: () => {
            cancelled = true;
            clearTimeout(timer);
            setNotes(prev => sortNotes(prev.map(n => (n.id === id ? original : n))));
            dismissToast(toastId);
          },
        },
      });
      return;
    }

    // Normal update (title, content, color, tags, etc.)
    try {
      const { error: err } = await supabase
        .from('vanguard_notes')
        .update({ ...patch, updated_at: updatedAt })
        .eq('id', id);
      if (err && !isNetworkOrTableError(err)) throw err;
      setNotes(prev => {
        const updated = sortNotes(prev.map(n => (n.id === id ? { ...n, ...patch, updated_at: updatedAt } : n)));
        if (err || !navigator.onLine) localStorage.setItem('vanguard_local_keep_notes', JSON.stringify(updated));
        return updated;
      });
    } catch (e: any) {
      setNotes(prev => {
        const updated = sortNotes(prev.map(n => (n.id === id ? { ...n, ...patch, updated_at: updatedAt } : n)));
        localStorage.setItem('vanguard_local_keep_notes', JSON.stringify(updated));
        return updated;
      });
      setError('Brak połączenia. Zaktualizowano lokalnie.');
    }
  };

  const handleDelete = (id: string) => {
    const noteToDelete = notes.find(n => n.id === id);
    if (!noteToDelete) return;

    // Optimistic remove
    setNotes(prev => prev.filter(n => n.id !== id));
    if (editingId === id) setEditingId(null);

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      try {
        const { error: err } = await supabase.from('vanguard_notes').delete().eq('id', id);
        if (err && !isNetworkOrTableError(err)) throw err;
      } catch {
        setError('Brak połączenia. Usunięto lokalnie.');
        setNotes(prev => {
          const updated = prev.filter(n => n.id !== id);
          localStorage.setItem('vanguard_local_keep_notes', JSON.stringify(updated));
          return updated;
        });
      }
    }, 5000);

    const toastId = notify('Notatka usunięta', 'info', {
      duration: 5000,
      action: {
        label: 'Cofnij',
        onClick: () => {
          cancelled = true;
          clearTimeout(timer);
          setNotes(prev => sortNotes([...prev, noteToDelete]));
          dismissToast(toastId);
        },
      },
    });
  };

  const handleTogglePin = async (note: Note) => {
    const next = !note.is_pinned;
    try {
      const { error: err } = await supabase
        .from('vanguard_notes')
        .update({ is_pinned: next })
        .eq('id', note.id);
      if (err && !isNetworkOrTableError(err)) throw err;
      setNotes(prev => {
        const updated = sortNotes(prev.map(n => (n.id === note.id ? { ...n, is_pinned: next } : n)));
        if (err || !navigator.onLine) localStorage.setItem('vanguard_local_keep_notes', JSON.stringify(updated));
        return updated;
      });
    } catch (e: any) {
      setNotes(prev => {
        const updated = sortNotes(prev.map(n => (n.id === note.id ? { ...n, is_pinned: next } : n)));
        localStorage.setItem('vanguard_local_keep_notes', JSON.stringify(updated));
        return updated;
      });
      setError('Brak połączenia. Zmieniono przypięcie lokalnie.');
    }
  };

  // ─── New note (iOS FAB) ──────────────────────────────────────────────────────

  const handleNewNote = useCallback(async () => {
    setBusy(true);
    setError(null);
    const empty = { user_id: userId, title: '', content: '', color: 'default', is_pinned: false, is_archived: false, tags: [] as string[] };
    try {
      const { data, error: err } = await supabase.from('vanguard_notes').insert(empty).select().single();
      if (err) {
        if (isNetworkOrTableError(err)) {
          const local: Note = { id: Math.random().toString(36).slice(2), ...empty, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
          setNotes(prev => [local, ...prev]);
          setEditingId(local.id);
          return;
        }
        throw err;
      }
      setNotes(prev => [data, ...prev]);
      setEditingId(data.id);
    } catch (e: any) {
      const local: Note = { id: Math.random().toString(36).slice(2), ...empty, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      setNotes(prev => [local, ...prev]);
      setEditingId(local.id);
      setError('Brak połączenia. Utworzono notatkę lokalnie.');
    } finally {
      setBusy(false);
    }
  }, [userId, isNetworkOrTableError]);

  // Auto-open new note when navigated with ?new=1 (Telegram shortcut)
  const autoNewNoteHandled = useRef(false);
  useEffect(() => {
    if (autoNewNote && !autoNewNoteHandled.current) {
      autoNewNoteHandled.current = true;
      window.history.replaceState({}, '', window.location.pathname);
      try { localStorage.removeItem('vanguard_keep_new'); } catch {}
      handleNewNote();
    }
  }, [autoNewNote, handleNewNote]);

  // Ctrl+N and Ctrl+F keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) || e.key === '/') {
        const active = document.activeElement as HTMLElement;
        if (
          active &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.tagName === 'SELECT' ||
            active.getAttribute('contenteditable') === 'true')
        ) {
          return;
        }
        e.preventDefault();
        const searchInput = document.querySelector('.keep-search') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !editingId) {
        e.preventDefault();
        handleNewNote();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editingId, handleNewNote]);

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

  const handleTagClick = (tag: string) => {
    setSidebarTab('notes');
    setSearch('');
    setActiveTag(t => (t === tag ? null : tag));
  };

  const handleConvertToTodo = async (note: Note) => {
    setBusy(true);
    try {
      await convertNoteToTodoItem(userId, note);
      setNotes(prev => prev.map(n => (
        n.id === note.id ? { ...n, is_archived: true, is_pinned: false } : n
      )));
      notify('Dodano do zadań', 'success');
    } catch (e: any) {
      notify(e.message || 'Nie udało się dodać do zadań', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleExportChecklists = async (note: Note) => {
    setBusy(true);
    try {
      const created = await exportNoteChecklistsToTodos(userId, note);
      notify(`Dodano ${created.length} zadań`, 'success');
    } catch (e: any) {
      notify(e.message || 'Eksport nie powiódł się', 'error');
    } finally {
      setBusy(false);
    }
  };

  const sharedGridProps = {
    onDelete: handleDelete,
    onTogglePin: handleTogglePin,
    onUpdate: handleUpdate,
    onReorder: handleReorder,
    busy,
    columns,
    editingId,
    onOpenCard: handleOpenCard,
    onClickTag: handleTagClick,
    onConvertToTodo: sidebarTab === 'notes' ? handleConvertToTodo : undefined,
    search,
  };


  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="keep-root">
      {/* ── Topbar ── */}
      <header className="keep-header">
        <div className="keep-header-left">
          <button onClick={() => onBack ? onBack() : navigate('/')} className="keep-back-btn" title="Wróć">
            <ArrowLeft size={16} />
          </button>
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
          <p className="keep-sidebar-section-label">Notatki</p>
          <button
            className={`keep-sidebar-item ${sidebarTab === 'notes' && !activeTag ? 'active' : ''}`}
            onClick={() => { setSidebarTab('notes'); setActiveTag(null); setSearch(''); }}
          >
            <CheckSquare size={15} />
            <span>Notatki</span>
            {notes.filter(n => !n.is_archived).length > 0 && (
              <span className="keep-sidebar-count">{notes.filter(n => !n.is_archived).length}</span>
            )}
          </button>
          <button
            className={`keep-sidebar-item ${sidebarTab === 'archive' && !activeTag ? 'active' : ''}`}
            onClick={() => { setSidebarTab('archive'); setActiveTag(null); setSearch(''); }}
          >
            <Archive size={15} />
            <span>Archiwum</span>
            {notes.filter(n => n.is_archived).length > 0 && (
              <span className="keep-sidebar-count">{notes.filter(n => n.is_archived).length}</span>
            )}
          </button>

          <div className="keep-sidebar-separator" />

          <p className="keep-sidebar-section-label">Nawigacja</p>
          <button className="keep-sidebar-item" onClick={() => goTo('todo')}>
            <ListTodo size={15} />
            <span>To Do</span>
          </button>
          <button className="keep-sidebar-item" onClick={() => goTo('kalendarz')}>
            <Calendar size={15} />
            <span>Kalendarz</span>
          </button>
          <button className="keep-sidebar-item" onClick={() => goTo('links')}>
            <BookOpen size={15} />
            <span>Pocket</span>
          </button>

          {allTags.length > 0 && (
            <>
              <div className="keep-sidebar-separator" />
              <p className="keep-sidebar-section-label">Tagi</p>
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
            </>
          )}
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

          {sidebarTab === 'notes' && (
            <NoteQuickCapture onSave={handleCreate} busy={busy} allTags={allTags} />
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
            <div className="keep-sections pb-20 md:pb-0">
              {search && (
                <div className="text-[10.5px] font-bold text-text-muted px-4 py-2 bg-slate-500/5 border border-border-custom/20 rounded-xl mb-4 flex items-center justify-between">
                  <span>Wyniki wyszukiwania dla "{search}":</span>
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[9.5px]">
                    {filtered.length} {filtered.length === 1 ? 'notatka' : [2, 3, 4].includes(filtered.length % 10) && ![12, 13, 14].includes(filtered.length % 100) ? 'notatki' : 'notatek'}
                  </span>
                </div>
              )}
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
                          isEditing={editingId === note.id}
                          onOpen={handleOpenCard}
                          onDragStart={() => {}}
                          onDragEnter={() => {}}
                          onDragEnd={() => {}}
                          onDragOver={e => e.preventDefault()}
                          isDragOver={false}
                          onClickTag={handleTagClick}
                          onConvertToTodo={sidebarTab === 'notes' ? handleConvertToTodo : undefined}
                          search={search}
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
                          isEditing={editingId === note.id}
                          onOpen={handleOpenCard}
                          onDragStart={() => {}}
                          onDragEnter={() => {}}
                          onDragEnd={() => {}}
                          onDragOver={e => e.preventDefault()}
                          isDragOver={false}
                          onClickTag={handleTagClick}
                          onConvertToTodo={sidebarTab === 'notes' ? handleConvertToTodo : undefined}
                          search={search}
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

      {/* iOS Notes-style FAB */}
      <button
        className="keep-fab"
        onClick={handleNewNote}
        disabled={busy}
        title="Nowa notatka"
        type="button"
      >
        {busy ? <Loader2 size={22} className="animate-spin" /> : <Plus size={24} strokeWidth={2} />}
      </button>

      {/* Page-level Edit Modal */}
      {editingId && (
        (() => {
          const noteToEdit = notes.find(n => n.id === editingId);
          return noteToEdit ? (
            <EditNoteModal
              note={noteToEdit}
              onClose={handleCloseCard}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
              busy={busy}
              allTags={allTags}
              onExportChecklists={handleExportChecklists}
            />
          ) : null;
        })()
      )}

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 flex border-t border-border-custom bg-background/95 backdrop-blur-xl">
        <button className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-primary">
          <CheckSquare size={22} />
          <span className="text-[11px] font-semibold">Notatki</span>
        </button>
        <button onClick={() => goTo('todo')} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-text-muted active:bg-surface">
          <ListTodo size={22} />
          <span className="text-[11px] font-semibold">Zadania</span>
        </button>
        <button onClick={() => goTo('kalendarz')} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-text-muted active:bg-surface">
          <Calendar size={22} />
          <span className="text-[11px] font-semibold">Kalendarz</span>
        </button>
        <button onClick={() => goTo('links')} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-text-muted active:bg-surface">
          <BookOpen size={22} />
          <span className="text-[11px] font-semibold">Pocket</span>
        </button>
      </nav>
    </div>
  );
}
