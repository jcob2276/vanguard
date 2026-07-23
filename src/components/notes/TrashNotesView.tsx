import { RotateCcw, Trash2 } from 'lucide-react';
import type { Note } from '../../lib/notesApi';
import { confirmDialog } from '../../lib/notify';
import { Pressable } from '../ui/ControlPrimitives';
import { getPlainText, relativeDate } from './keepUtils';

interface TrashNotesViewProps {
  notes: Note[];
  loading: boolean;
  onRestore: (id: string) => Promise<void>;
  onPermanentDelete: (id: string) => Promise<void>;
}

export default function TrashNotesView({
  notes,
  loading,
  onRestore,
  onPermanentDelete,
}: TrashNotesViewProps) {
  if (loading) {
    return <div className="flex flex-1 items-center justify-center text-sm text-text-muted">Ładowanie kosza…</div>;
  }

  if (!notes.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <Trash2 size={28} className="text-text-muted/50" />
        <strong>Kosz jest pusty</strong>
        <span className="text-xs text-text-muted">Usunięte notatki pojawią się tutaj.</span>
      </div>
    );
  }

  return (
    <section className="flex-1 overflow-y-auto p-4 md:p-6" aria-label="Kosz notatek">
      <header className="mb-4">
        <h2 className="text-lg font-bold">Kosz</h2>
        <p className="text-xs text-text-muted">Przywróć notatkę albo usuń ją bezpowrotnie.</p>
      </header>
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        {notes.map(note => (
          <article key={note.id} className="rounded-xl border border-border-custom bg-surface-solid p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{note.title || 'Bez tytułu'}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-text-muted">{getPlainText(note.content) || 'Pusta notatka'}</p>
                <span className="mt-2 block text-4xs text-text-muted">
                  Usunięto {relativeDate(note.deleted_at || note.updated_at)}
                </span>
              </div>
              <div className="flex shrink-0 gap-1">
                <Pressable variant="ghost" size="sm" onClick={() => void onRestore(note.id)} title="Przywróć notatkę">
                  <RotateCcw size={15} />
                </Pressable>
                <Pressable
                  variant="ghost"
                  size="sm"
                  className="text-danger"
                  title="Usuń bezpowrotnie"
                  onClick={() => {
                    void confirmDialog('Usunąć tę notatkę bezpowrotnie? Tej operacji nie można cofnąć.')
                      .then(async confirmed => {
                        if (confirmed) await onPermanentDelete(note.id);
                      });
                  }}
                >
                  <Trash2 size={15} />
                </Pressable>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
