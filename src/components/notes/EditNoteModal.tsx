import { useCallback, useEffect, useState } from 'react';
import { Archive, ChevronLeft, ListTodo, MoreHorizontal, Pin, Tag, Trash2 } from 'lucide-react';
import RichEditor from './RichEditor';
import { COLORS, getColor, Note } from './keepUtils';

export default function EditNoteModal({
  note,
  onClose,
  onUpdate,
  onDelete,
  onTogglePin,
  busy,
  allTags,
  onExportChecklists,
}: {
  note: Note;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Note>) => void;
  onDelete: (id: string) => void;
  onTogglePin: (note: Note) => void;
  busy: boolean;
  allTags?: string[];
  onExportChecklists?: (note: Note) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [color, setColor] = useState(note.color);
  const [tagsInput, setTagsInput] = useState(note.tags.join(', '));
  const [showMenu, setShowMenu] = useState(false);
  const c = getColor(color);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setColor(note.color);
    setTagsInput(note.tags.join(', '));
  }, [note]);

  const handleSave = useCallback(() => {
    onUpdate(note.id, {
      title: title.trim(),
      content: content.trim(),
      color,
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
    });
    onClose();
  }, [color, content, note.id, onUpdate, onClose, tagsInput, title]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleSave(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleSave]);

  const noteDate = new Date(note.updated_at || note.created_at).toLocaleDateString('pl-PL', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const uncheckedCount = (() => {
    const doc = new DOMParser().parseFromString(content, 'text/html');
    let count = 0;
    doc.querySelectorAll('.keep-todo-item').forEach((el) => {
      const checkbox = el.querySelector('.keep-todo-checkbox');
      const text = el.querySelector('.keep-todo-text')?.textContent?.trim();
      if (text && !checkbox?.classList.contains('checked')) count += 1;
    });
    return count;
  })();

  return (
    <>
      <div className="keep-modal-backdrop" onClick={e => { e.stopPropagation(); handleSave(); }} />
      <div
        className="keep-modal-content"
        style={{ backgroundColor: c.bg, borderColor: c.border }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── iOS navigation bar ── */}
        <nav className="keep-ios-nav" style={{ borderBottomColor: `${c.border}` }}>
          <button type="button" className="keep-ios-back" onClick={handleSave}>
            <ChevronLeft size={22} strokeWidth={2.5} />
            <span>Notatki</span>
          </button>
          <span className="keep-ios-date" style={{ color: c.textSub }}>{noteDate}</span>
          <div className="keep-ios-nav-right">
            <button type="button" className="keep-ios-done" onClick={handleSave}>
              Gotowe
            </button>
            <button
              type="button"
              className="keep-ios-more"
              onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
            >
              <MoreHorizontal size={22} />
            </button>
          </div>
        </nav>

        {/* ── Overflow menu (iOS popover style) ── */}
        {showMenu && (
          <>
            <div className="keep-menu-overlay" onClick={() => setShowMenu(false)} />
            <div className="keep-menu" onClick={e => e.stopPropagation()}>
              <div className="keep-menu-colors">
                {COLORS.map(col => (
                  <button
                    key={col.id}
                    type="button"
                    title={col.label}
                    onClick={() => setColor(col.id)}
                    className={`keep-swatch ${color === col.id ? 'selected' : ''}`}
                    style={{ backgroundColor: col.dot }}
                  />
                ))}
              </div>
              <div className="keep-menu-rule" />
              <button
                type="button"
                className="keep-menu-item"
                onClick={() => { onTogglePin(note); setShowMenu(false); }}
              >
                <Pin size={17} fill={note.is_pinned ? 'currentColor' : 'none'} />
                <span>{note.is_pinned ? 'Odepnij' : 'Przypnij'}</span>
              </button>
              {uncheckedCount > 0 && onExportChecklists && (
                <button
                  type="button"
                  className="keep-menu-item"
                  onClick={() => {
                    onExportChecklists({ ...note, title, content });
                    setShowMenu(false);
                  }}
                >
                  <ListTodo size={17} />
                  <span>Eksportuj {uncheckedCount} pkt. do zadań</span>
                </button>
              )}
              <button
                type="button"
                className="keep-menu-item"
                onClick={() => { onUpdate(note.id, { is_archived: !note.is_archived, is_pinned: false }); setShowMenu(false); onClose(); }}
              >
                <Archive size={17} />
                <span>{note.is_archived ? 'Przywróć' : 'Archiwizuj'}</span>
              </button>
              <div className="keep-menu-rule" />
              <button
                type="button"
                className="keep-menu-item danger"
                onClick={() => { onDelete(note.id); onClose(); }}
                disabled={busy}
              >
                <Trash2 size={17} />
                <span>Usuń notatkę</span>
              </button>
            </div>
          </>
        )}

        {/* ── Note body ── */}
        <div className="keep-modal-body">
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Tytuł"
            className="keep-ios-title-input"
            style={{ color: c.text }}
          />
          <div className="keep-ios-meta-row" style={{ borderBottomColor: c.border }}>
            <Tag size={10} style={{ opacity: 0.35, flexShrink: 0 }} />
            <input
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="Tagi…"
              className="keep-ios-tags-input"
              style={{ color: c.textSub }}
            />
          </div>
          {allTags && allTags.length > 0 && (
            <div className="mt-2.5 px-3">
              <p className="tag-suggestions-label">Sugerowane tagi</p>
              <div className="tag-suggestions-list">
                {allTags.map(tag => {
                  const currentTags = tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
                  const isActive = currentTags.includes(tag.toLowerCase());
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        const tagsList = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
                        const isExist = tagsList.some(t => t.toLowerCase() === tag.toLowerCase());
                        let nextTags: string[];
                        if (isExist) {
                          nextTags = tagsList.filter(t => t.toLowerCase() !== tag.toLowerCase());
                        } else {
                          nextTags = [...tagsList, tag];
                        }
                        setTagsInput(nextTags.join(', '));
                      }}
                      className={`tag-suggestion-pill ${isActive ? 'active' : ''}`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <RichEditor
            value={content}
            onChange={setContent}
            placeholder="Zacznij pisać…"
            className="keep-ios-editor"
            style={{ color: c.textSub }}
            showStaticBar
          />
        </div>
      </div>
    </>
  );
}
