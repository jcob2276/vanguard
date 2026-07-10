import { AlertCircle, CheckSquare, Loader2, Pin, X } from 'lucide-react';
import MasonryGrid from './MasonryGrid';
import NoteCard from './NoteCard';
import NoteQuickCapture from './NoteQuickCapture';
import { Note } from '../../lib/notesApi';

type SharedGridProps = Omit<Parameters<typeof MasonryGrid>[0], 'notes'>;

interface KeepNotesListProps {
  error: string | null;
  onClearError: () => void;
  sidebarTab: 'notes' | 'archive';
  onCreate: (note: { title: string; content: string; tags?: string[] }) => void;
  busy: boolean;
  allTags: string[];
  loading: boolean;
  filtered: Note[];
  search: string;
  activeTag: string | null;
  pinned: Note[];
  others: Note[];
  visibleOthers: Note[];
  visibleCount: number;
  setVisibleCount: (fn: (prev: number) => number) => void;
  viewMode: 'grid' | 'list';
  sharedGridProps: SharedGridProps;
}

export default function KeepNotesList({
  error, onClearError, sidebarTab, onCreate, busy, allTags, loading, filtered,
  search, activeTag, pinned, others, visibleOthers, visibleCount, setVisibleCount,
  viewMode, sharedGridProps,
}: KeepNotesListProps) {
  const { onDelete, onTogglePin, onUpdate, editingId, onOpenCard, onClickTag, onConvertToTodo } = sharedGridProps;

  return (
    <main className="keep-main">
      {error && (
        <div className="keep-error">
          <AlertCircle size={14} />
          <span>{error}</span>
          <button type="button" onClick={onClearError} className="keep-error-close"><X size={12} /></button>
        </div>
      )}

      {sidebarTab === 'notes' && (
        <NoteQuickCapture onSave={onCreate} busy={busy} allTags={allTags} />
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
                      onDelete={onDelete}
                      onTogglePin={onTogglePin}
                      onUpdate={onUpdate}
                      busy={busy}
                      isEditing={editingId === note.id}
                      onOpen={onOpenCard}
                      onDragStart={() => {}}
                      onDragEnter={() => {}}
                      onDragEnd={() => {}}
                      onDragOver={e => e.preventDefault()}
                      isDragOver={false}
                      onClickTag={onClickTag}
                      onConvertToTodo={onConvertToTodo}
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
                <MasonryGrid notes={visibleOthers} {...sharedGridProps} />
              ) : (
                <div className="keep-list">
                  {visibleOthers.map(note => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onDelete={onDelete}
                      onTogglePin={onTogglePin}
                      onUpdate={onUpdate}
                      busy={busy}
                      isEditing={editingId === note.id}
                      onOpen={onOpenCard}
                      onDragStart={() => {}}
                      onDragEnter={() => {}}
                      onDragEnd={() => {}}
                      onDragOver={e => e.preventDefault()}
                      isDragOver={false}
                      onClickTag={onClickTag}
                      onConvertToTodo={onConvertToTodo}
                      search={search}
                    />
                  ))}
                </div>
              )}
              {others.length > visibleCount && (
                <div className="flex justify-center mt-6">
                  <button
                    type="button"
                    onClick={() => setVisibleCount(prev => prev + 30)}
                    className="px-6 py-2.5 rounded-xl border border-border-custom bg-surface hover:bg-surface-solid text-[11px] font-bold uppercase tracking-wider text-text-secondary transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    Pokaż więcej notatek ({others.length - visibleCount} pozostało)
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </main>
  );
}
