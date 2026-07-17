import { Pressable } from '../ui/ControlPrimitives';
import { Pin } from 'lucide-react';
import { useRef } from 'react';
import { Note, getColor, relativeDate, getPlainText } from './keepUtils';

interface NoteRowProps {
  note: Note;
  isActive: boolean;
  onClick: () => void;
  onLongPress: () => void;
}

export default function NoteRow({ note, isActive, onClick, onLongPress }: NoteRowProps) {
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const plainText = getPlainText(note.content);
  const snippet = plainText ? plainText.slice(0, 110) : 'Brak dodatkowej treści';
  const dateStr = relativeDate(note.updated_at || note.created_at);
  const color = getColor(note.color);
  const cancelLongPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const startLongPress = () => {
    longPressed.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      navigator.vibrate?.(10);
      onLongPress();
    }, 500);
  };

  return (
    <Pressable
      onClick={() => {
        if (!longPressed.current) onClick();
        longPressed.current = false;
      }}
      onPointerDown={startLongPress}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onPointerMove={cancelLongPress}
      onContextMenu={event => {
        event.preventDefault();
        cancelLongPress();
        onLongPress();
      }}
      className={`note-list-row relative flex w-full select-none flex-col gap-1 px-4 py-3.5 text-left ${
        isActive ? 'bg-primary/10 text-text-primary' : 'bg-transparent text-text-primary'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="block flex-1 truncate text-sm font-semibold leading-tight tracking-[-0.01em] text-text-primary">
          {note.title.trim() || 'Bez tytułu'}
        </span>
        {note.is_pinned && (
          <span className="text-[var(--color-warning)]">
            <Pin size={12} fill="currentColor" />
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 truncate text-xs leading-[1.35] text-text-muted">
        <span className="shrink-0 font-medium text-text-secondary">{dateStr}</span>
        <span aria-hidden="true">·</span>
        <span className="flex-1 truncate">{snippet}</span>
      </div>

      {note.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5 leading-none">
          {note.tags.slice(0, 3).map(tag => (
            <span key={tag} className="rounded-md bg-primary/8 px-1.5 py-1 text-3xs font-medium lowercase text-primary/80">
              #{tag.toLowerCase()}
            </span>
          ))}
          {note.tags.length > 3 && (
            <span className="px-1 py-1 text-3xs font-medium text-text-muted">+{note.tags.length - 3}</span>
          )}
        </div>
      )}

      {note.color !== 'default' && !isActive && (
        <span
          className="absolute bottom-3 right-2 h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color.dot }}
        />
      )}
    </Pressable>
  );
}
