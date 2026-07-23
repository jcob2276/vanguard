/**
 * @component SplitNotesView
 * @role Alternatywny tryb widoku: lista + panel edycji obok siebie (zamiast grid+modal).
 * @composes NoteRow (lista), InlineEditor (panel edycji)
 * @usedBy Keep (gdy viewMode === 'split')
 */
import { useEffect, useState } from 'react';
import { Bot, Pin } from 'lucide-react';
import { Note } from './keepUtils';
import NoteRow from './NoteRow';
import InlineEditor from './InlineEditor';
import NoteQuickActions from './NoteQuickActions';
import { confirmDialog } from '../../lib/notify';
import type { NoteFolder } from '../../lib/noteFoldersApi';
import MasonryGrid from './MasonryGrid';

interface SplitNotesViewProps {
  notes: Note[];
  filtered: Note[];
  pinned: Note[];
  others: Note[];
  activeNoteId: string | null;
  onSelectNote: (id: string | null) => void;
  onCloseNote: (isEmpty?: boolean) => void;
  onUpdate: (id: string, patch: Partial<Note>) => void;
  onDelete: (id: string) => void;
  onTogglePin: (note: Note) => void;
  busy: boolean;
  allTags: string[];
  onCreate: (note: { title: string; content: string; tags?: string[] }) => void;
  search: string;
  activeTag: string | null;
  onExportChecklists?: (note: Note) => void;
  folders?: NoteFolder[];
  onExportNote?: (note: Note) => void;
  onLockNote?: (note: Note) => Promise<void>;
  collectionView: 'list' | 'gallery';
  gridProps: Omit<Parameters<typeof MasonryGrid>[0], 'notes'>;
}

export default function SplitNotesView({
  notes, filtered, pinned, others, activeNoteId, onSelectNote, onCloseNote, onUpdate, onDelete, onTogglePin,
  busy, allTags, onExportChecklists, folders = [], onExportNote, onLockNote,
  collectionView, gridProps,
}: SplitNotesViewProps) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [actionNote, setActionNote] = useState<Note | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeNote = notes.find(n => n.id === activeNoteId) || null;

  return (
    <div className="keep-split-container">
      {/* List Pane - Visible on desktop, or on mobile when no note is selected */}
      {(!isMobile || !activeNoteId) && (
        <div className={`keep-split-list-pane ${collectionView === 'gallery' ? 'gallery' : ''}`}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-muted p-6 text-center">
              <p className="font-bold text-sm">Brak notatek</p>
              <p className="text-xs mt-1">Zmień filtry lub utwórz nową notatkę.</p>
            </div>
          ) : collectionView === 'gallery' ? (
            <div className="p-2 pb-20">
              <MasonryGrid notes={filtered} {...gridProps} />
            </div>
          ) : (
            <div className="space-y-6 px-3 pb-20 pt-5 md:px-1 md:py-2 md:pb-4">
              {/* Pinned section in iOS Grouped List Style */}
              {pinned.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 px-1 pb-1 text-xs font-semibold text-text-secondary">
                    <Pin size={11} fill="currentColor" className="text-[var(--color-warning)]" /> Przypięte
                  </div>
                  <div className="overflow-hidden rounded-2xl bg-surface-1 shadow-2xs ring-1 ring-text-primary/[0.04]">
                    {pinned.map((n, idx) => (
                      <div key={n.id}>
                        <NoteRow
                          note={n}
                          isActive={activeNoteId === n.id}
                          onClick={() => onSelectNote(n.id)}
                          onLongPress={() => setActionNote(n)}
                        />
                        {idx < pinned.length - 1 && (
                          <div className="border-b border-border-custom/10 ml-4 mr-2" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Others section in iOS Grouped List Style */}
              {others.length > 0 && (
                <div className="space-y-1">
                  <div className="px-1 pb-1 text-xs font-semibold text-text-secondary">
                    Notatki
                  </div>
                  <div className="overflow-hidden rounded-2xl bg-surface-1 shadow-2xs ring-1 ring-text-primary/[0.04]">
                    {others.map((n, idx) => (
                      <div key={n.id}>
                        <NoteRow
                          note={n}
                          isActive={activeNoteId === n.id}
                          onClick={() => onSelectNote(n.id)}
                          onLongPress={() => setActionNote(n)}
                        />
                        {idx < others.length - 1 && (
                          <div className="border-b border-border-custom/10 ml-4 mr-2" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Editor Pane - Visible on desktop, or on mobile when a note IS selected */}
      {(!isMobile || !!activeNoteId) && (
        <div className="keep-split-editor-pane">
          {activeNote ? (
            <InlineEditor
              note={activeNote}
              onClose={onCloseNote}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onTogglePin={onTogglePin}
              busy={busy}
              allTags={allTags}
              allNotes={notes}
              onExportChecklists={onExportChecklists}
              isMobile={isMobile}
              folders={folders}
              onExportNote={onExportNote}
              onNavigateToNote={id => onSelectNote(id)}
              onLockNote={onLockNote}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-text-muted p-8 text-center bg-surface-solid/10">
              <Bot size={40} className="mb-3 text-text-muted/50 animate-pulse" />
              <p className="font-bold text-sm">Wybierz notatkę z listy</p>
              <p className="text-xs mt-1">Kliknij dowolną notatkę po lewej stronie lub utwórz nową notatkę klikając przycisk "+" na dole.</p>
            </div>
          )}
        </div>
      )}
      {actionNote && (
        <NoteQuickActions
          note={actionNote}
          onClose={() => setActionNote(null)}
          onTogglePin={() => { onTogglePin(actionNote); setActionNote(null); }}
          onArchive={() => {
            onUpdate(actionNote.id, { is_archived: true });
            setActionNote(null);
          }}
          onDelete={async () => {
            if (await confirmDialog('Czy usunąć tę notatkę?')) onDelete(actionNote.id);
            setActionNote(null);
          }}
        />
      )}
    </div>
  );
}
