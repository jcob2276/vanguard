import { Pressable } from '../ui/ControlPrimitives';
import { Pin } from 'lucide-react';
import { Note, getColor, relativeDate, getPlainText } from './keepUtils';

interface NoteRowProps {
  note: Note;
  isActive: boolean;
  onClick: () => void;
}



export default function NoteRow({ note, isActive, onClick }: NoteRowProps) {
  const plainText = getPlainText(note.content);
  const snippet = plainText ? plainText.slice(0, 80) : 'Brak dodatkowej treści';
  const dateStr = relativeDate(note.updated_at || note.created_at);
  const c = getColor(note.color);

  return (
    <Pressable
      onClick={onClick}
      className={`w-full text-left px-4 py-3 transition-all cursor-pointer flex flex-col gap-0.5 relative select-none ${
        isActive 
          ? 'bg-primary text-white shadow-xs' 
          : 'hover:bg-surface-2 bg-surface-1 text-text-primary'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`font-bold text-xs truncate block flex-1 ${isActive ? 'text-white' : 'text-text-primary'}`}>
          {note.title.trim() || 'Bez tytułu'}
        </span>
        {note.is_pinned && (
          <span className={isActive ? 'text-white/80' : 'text-[var(--color-warning)]'}>
            <Pin size={9} fill="currentColor" />
          </span>
        )}
      </div>

      {/* iOS notes style: Date and Snippet inline on same line */}
      <div className="flex items-center gap-1.5 text-3xs truncate select-none leading-relaxed">
        <span className={`font-semibold shrink-0 ${isActive ? 'text-white/95' : 'text-text-muted'}`}>
          {dateStr}
        </span>
        <span className={isActive ? 'text-white/60' : 'text-text-muted/50'}>
          ·
        </span>
        <span className={`truncate flex-1 ${isActive ? 'text-white/80' : 'text-text-muted/70'}`}>
          {snippet}
        </span>
      </div>

      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-x-1.5 mt-0.5 select-none leading-none">
          {note.tags.slice(0, 3).map(t => (
            <span
              key={t}
              className={`text-4xs font-medium lowercase ${isActive ? 'text-white/60' : 'text-primary/75'}`}
            >
              #{t.toLowerCase()}
            </span>
          ))}
          {note.tags.length > 3 && (
            <span className={`text-4xs font-medium ${isActive ? 'text-white/50' : 'text-text-muted'}`}>
              +{note.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Small indicator dot showing note color if not default */}
      {note.color !== 'default' && !isActive && (
        <span 
          className="absolute right-2 bottom-2 w-1.5 h-1.5 rounded-full border border-border-custom/40"
          style={{ backgroundColor: c.dot }}
        />
      )}
    </Pressable>
  );
}
