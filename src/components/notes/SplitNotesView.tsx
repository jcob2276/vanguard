import { useEffect, useState } from 'react';
import { Bot, Pin } from 'lucide-react';
import { Note } from './keepUtils';
import NoteRow from './NoteRow';
import InlineEditor from './InlineEditor';

interface SplitNotesViewProps {
  notes: Note[];
  filtered: Note[];
  pinned: Note[];
  others: Note[];
  activeNoteId: string | null;
  onSelectNote: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<Note>) => void;
  onDelete: (id: string) => void;
  onTogglePin: (note: Note) => void;
  busy: boolean;
  allTags: string[];
  onCreate: (note: { title: string; content: string; tags?: string[] }) => void;
  search: string;
  activeTag: string | null;
  onExportChecklists?: (note: Note) => void;
}

export default function SplitNotesView({
  notes, filtered, pinned, others, activeNoteId, onSelectNote, onUpdate, onDelete, onTogglePin,
  busy, allTags, onExportChecklists
}: SplitNotesViewProps) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

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
        <div className="keep-split-list-pane">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-muted p-6 text-center">
              <p className="font-bold text-sm">Brak notatek</p>
              <p className="text-xs mt-1">Zmień filtry lub utwórz nową notatkę.</p>
            </div>
          ) : (
            <div className="pb-20 md:pb-4 px-1 py-2 space-y-4">
              {/* Pinned section in iOS Grouped List Style */}
              {pinned.length > 0 && (
                <div className="space-y-1">
                  <div className="text-4xs font-black uppercase tracking-widest text-text-muted px-2 py-0.5 flex items-center gap-1">
                    <Pin size={8} fill="currentColor" className="text-[var(--color-warning)]" /> Przypięte
                  </div>
                  <div className="bg-surface-1 border border-border-custom/30 rounded-2xl overflow-hidden shadow-2xs">
                    {pinned.map((n, idx) => (
                      <div key={n.id}>
                        <NoteRow
                          note={n}
                          isActive={activeNoteId === n.id}
                          onClick={() => onSelectNote(n.id)}
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
                  <div className="text-4xs font-black uppercase tracking-widest text-text-muted px-2 py-0.5">
                    Notatki
                  </div>
                  <div className="bg-surface-1 border border-border-custom/30 rounded-2xl overflow-hidden shadow-2xs">
                    {others.map((n, idx) => (
                      <div key={n.id}>
                        <NoteRow
                          note={n}
                          isActive={activeNoteId === n.id}
                          onClick={() => onSelectNote(n.id)}
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
              onClose={() => onSelectNote(null)}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onTogglePin={onTogglePin}
              busy={busy}
              allTags={allTags}
              allNotes={notes}
              onExportChecklists={onExportChecklists}
              isMobile={isMobile}
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
    </div>
  );
}
