import { createPortal } from 'react-dom';
import { Archive, Pin, PinOff, Trash2, X } from 'lucide-react';
import { Pressable } from '../ui/ControlPrimitives';
import type { Note } from './keepUtils';

interface Props {
  note: Note;
  onClose: () => void;
  onTogglePin: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export default function NoteQuickActions({ note, onClose, onTogglePin, onArchive, onDelete }: Props) {
  return createPortal(
    <div className="note-actions-layer" role="presentation" onPointerDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="note-actions-sheet" role="dialog" aria-modal="true" aria-label="Akcje notatki">
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <p className="min-w-0 truncate pr-3 text-sm font-semibold text-text-primary">
            {note.title.trim() || 'Bez tytułu'}
          </p>
          <Pressable variant="ghost" size="sm" onClick={onClose} aria-label="Zamknij">
            <X size={18} />
          </Pressable>
        </div>
        <div className="overflow-hidden rounded-2xl bg-surface-1">
          <Pressable className="note-action-row" onClick={onTogglePin} icon={note.is_pinned ? <PinOff size={19} /> : <Pin size={19} />}>
            {note.is_pinned ? 'Odepnij' : 'Przypnij'}
          </Pressable>
          <Pressable className="note-action-row" onClick={onArchive} icon={<Archive size={19} />}>
            Archiwizuj
          </Pressable>
          <Pressable className="note-action-row text-danger" onClick={onDelete} icon={<Trash2 size={19} />}>
            Usuń
          </Pressable>
        </div>
      </section>
    </div>,
    document.body,
  );
}
