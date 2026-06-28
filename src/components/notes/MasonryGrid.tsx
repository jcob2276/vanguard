import { useState } from 'react';
import NoteCard from './NoteCard';
import { Note } from './keepUtils';

export default function MasonryGrid({
  notes,
  onDelete,
  onTogglePin,
  onUpdate,
  onReorder,
  busy,
  columns,
  editingId,
  onOpenCard,
  onClickTag,
  onConvertToTodo,
  search = '',
}: {
  notes: Note[];
  onDelete: (id: string) => void;
  onTogglePin: (note: Note) => void;
  onUpdate: (id: string, patch: Partial<Note>) => void;
  onReorder: (dragId: string, overId: string) => void;
  busy: boolean;
  columns: number;
  editingId: string | null;
  onOpenCard: (id: string) => void;
  onClickTag?: (tag: string) => void;
  onConvertToTodo?: (note: Note) => void;
  search?: string;
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
              isEditing={editingId === note.id}
              onOpen={onOpenCard}
              onDragStart={handleDragStart}
              onDragEnter={handleDragEnter}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              isDragOver={overId === note.id && dragId !== note.id}
              onClickTag={onClickTag}
              onConvertToTodo={onConvertToTodo}
              search={search}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
