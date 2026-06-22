import { useState, useRef, useEffect } from 'react';
import { Plus, Tag } from 'lucide-react';
import { COLORS, getColor } from './keepUtils';
import RichEditor from './RichEditor';

interface NoteQuickCaptureProps {
  onSave: (note: { title: string; content: string; color: string; tags: string[] }) => void;
  busy: boolean;
  allTags?: string[];
}

export default function NoteQuickCapture({ onSave, busy, allTags }: NoteQuickCaptureProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState('default');
  const [tagsText, setTagsText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
    setTitle('');
    setContent('');
    setColor('default');
    setTagsText('');
    setIsExpanded(false);
  };

  const handleSave = () => {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle && !trimmedContent) {
      handleClose();
      return;
    }
    const tags = tagsText
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    onSave({ title: trimmedTitle, content: trimmedContent, color, tags });
    handleClose();
  };

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const hasText = title.trim() || content.trim();
        if (hasText) {
          handleSave();
        } else {
          handleClose();
        }
      }
    };
    if (isExpanded) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isExpanded, title, content, color, tagsText]);

  const c = getColor(color);

  return (
    <div
      ref={containerRef}
      className="note-quick-capture"
      style={{ backgroundColor: isExpanded ? c.bg : 'var(--surface)', borderColor: isExpanded ? c.border : 'var(--border)' }}
    >
      {!isExpanded ? (
        <div
          className="note-quick-capture-collapsed select-none"
          onClick={() => setIsExpanded(true)}
        >
          <span>Utwórz notatkę…</span>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
      ) : (
        <div className="note-quick-capture-expanded">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Tytuł"
            className="note-quick-input-title"
            style={{ color: c.text }}
            autoFocus
          />
          
          <div className="note-quick-editor-wrapper">
            <RichEditor
              value={content}
              onChange={setContent}
              placeholder="Utwórz notatkę…"
              className="min-h-[60px]"
              style={{ color: c.textSub }}
            />
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Tag size={10} style={{ opacity: 0.4 }} />
            <input
              value={tagsText}
              onChange={e => setTagsText(e.target.value)}
              placeholder="Tagi rozdzielone przecinkami…"
              className="note-quick-input-tags"
              style={{ color: c.textSub }}
            />
          </div>
          {allTags && allTags.length > 0 && (
            <div className="mb-3 px-1">
              <p className="tag-suggestions-label">Sugerowane tagi</p>
              <div className="tag-suggestions-list">
                {allTags.map(tag => {
                  const currentTags = tagsText.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
                  const isActive = currentTags.includes(tag.toLowerCase());
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        const tagsList = tagsText.split(',').map(t => t.trim()).filter(Boolean);
                        const isExist = tagsList.some(t => t.toLowerCase() === tag.toLowerCase());
                        let nextTags: string[];
                        if (isExist) {
                          nextTags = tagsList.filter(t => t.toLowerCase() !== tag.toLowerCase());
                        } else {
                          nextTags = [...tagsList, tag];
                        }
                        setTagsText(nextTags.join(', '));
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

          <div className="note-quick-footer" style={{ borderColor: c.border }}>
            <div className="note-quick-actions">
              {COLORS.map(col => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setColor(col.id)}
                  title={col.label}
                  className={`note-quick-color-btn ${color === col.id ? 'active' : ''}`}
                  style={{ backgroundColor: col.dot }}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="note-quick-close-btn"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={busy}
                className="note-quick-save-btn"
              >
                Dodaj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
