import { Pressable } from '../ui/ControlPrimitives';
import { useRef } from 'react';
import { Archive, ListTodo, Pin, Trash2 } from 'lucide-react';
import { getColor, relativeDate, sanitizeHtml, Note, highlightHtml } from './keepUtils';

export default function NoteCard({
  note,
  onDelete,
  onTogglePin,
  onUpdate,
  busy,
  isEditing,
  onOpen,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDragOver,
  isDragOver,
  onClickTag,
  onConvertToTodo,
  search = '',
}: {
  note: Note;
  onDelete: (id: string) => void;
  onTogglePin: (note: Note) => void;
  onUpdate: (id: string, patch: Partial<Note>) => void;
  busy: boolean;
  isEditing: boolean;
  onOpen: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnter: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  isDragOver: boolean;
  onClickTag?: (tag: string) => void;
  onConvertToTodo?: (note: Note) => void;
  search?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const c = getColor(note.color);

  return (
    <div
      ref={ref}
      className={`keep-card ${isEditing ? 'editing' : ''} ${note.is_pinned ? 'pinned' : ''} ${isDragOver ? 'drag-over' : ''}`}
      style={{
        backgroundColor: c.bg,
        borderColor: isDragOver ? 'var(--color-theme-hex-6366f1)' : c.border,
        opacity: isEditing ? 'var(--opacity-note-editing)' : 'var(--opacity-100)',
      }}
      onClick={() => onOpen(note.id)}
      draggable={!isEditing}
      onDragStart={() => onDragStart(note.id)}
      onDragEnter={() => onDragEnter(note.id)}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
    >
      {/* Pin badge */}
      {note.is_pinned && (
        <div className="keep-pin-badge">
          <Pin size={9} fill="currentColor" />
        </div>
      )}

      {/* Drag handle — shows on hover */}
      <div className="keep-drag-handle" title="Przeciągnij aby przenieść">
        <span />
        <span />
        <span />
      </div>

      {note.title && (
        <h3
          className="keep-card-title"
          style={{ color: c.text }}
          dangerouslySetInnerHTML={{ __html: highlightHtml(sanitizeHtml(note.title), search) }}
        />
      )}
      {note.content && (
        <div
          className="keep-card-content"
          style={{ color: c.textSub }}
          dangerouslySetInnerHTML={{ __html: highlightHtml(sanitizeHtml(note.content), search) }}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('keep-todo-checkbox')) {
              e.stopPropagation();
              e.preventDefault();
              // Clone from the live DOM (not the `note.content` prop closure) so a
              // second rapid toggle can't overwrite an in-flight first toggle with
              // stale content before React re-renders with the updated note.
              const container = document.createElement('div');
              container.innerHTML = e.currentTarget.innerHTML;
              const checkboxes = Array.from(e.currentTarget.querySelectorAll('.keep-todo-checkbox'));
              const index = checkboxes.indexOf(target);
              if (index !== -1) {
                const docCheckboxes = container.querySelectorAll('.keep-todo-checkbox');
                const targetCheckbox = docCheckboxes[index] as HTMLElement;
                if (targetCheckbox) {
                  const isChecked = targetCheckbox.classList.toggle('checked');
                  const sibling = targetCheckbox.nextElementSibling as HTMLElement;
                  if (sibling) {
                    sibling.classList.toggle('completed', isChecked);
                  }
                  onUpdate(note.id, { content: container.innerHTML });
                }
              }
            }
          }}
        />
      )}
      {note.tags.length > 0 && (
        <div className="keep-card-tags">
          {note.tags.map((t, i) => (
            <span
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                onClickTag?.(t);
              }}
              className="keep-tag cursor-pointer hover:opacity-[var(--opacity-80)] active:scale-95 transition-all"
              style={{ background: c.tagBg, color: c.tagText, borderColor: 'transparent' }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="keep-card-footer" style={{ borderTopColor: 'var(--color-theme-hex-ba255255255008)' }}>
        <span className="keep-card-date" style={{ color: c.textSub, opacity: 'var(--ds-inline-style-0-6)' }}>
          {relativeDate(note.updated_at || note.created_at)}
        </span>
         <div className="keep-card-actions">
          {!note.is_archived && onConvertToTodo && (
            <Pressable
              type="button"
              onClick={e => { e.stopPropagation(); onConvertToTodo(note); }}
              className="keep-icon-btn"
              title="Dodaj do zadań"
            >
              <ListTodo size={14} />
            </Pressable>
          )}
          <Pressable
            type="button"
            onClick={e => { e.stopPropagation(); onTogglePin(note); }}
            className={`keep-icon-btn ${note.is_pinned ? 'active' : ''}`}
            title={note.is_pinned ? 'Odepnij' : 'Przypnij'}
          >
            <Pin size={14} fill={note.is_pinned ? 'currentColor' : 'none'} />
          </Pressable>
          <Pressable
            type="button"
            onClick={e => { e.stopPropagation(); onUpdate(note.id, { is_archived: !note.is_archived, is_pinned: false }); }}
            className={`keep-icon-btn ${note.is_archived ? 'active' : ''}`}
            title={note.is_archived ? 'Przywróć z archiwum' : 'Archiwizuj'}
          >
            <Archive size={14} fill={note.is_archived ? 'currentColor' : 'none'} />
          </Pressable>
          <Pressable
            type="button"
            onClick={e => { e.stopPropagation(); onDelete(note.id); }}
            disabled={busy}
            className="keep-icon-btn danger"
            title="Usuń"
          >
            <Trash2 size={14} />
          </Pressable>
        </div>
      </div>
    </div>
  );
}
