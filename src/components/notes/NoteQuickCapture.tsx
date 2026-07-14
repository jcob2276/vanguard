import { Pressable, ControlInput } from '../ui/ControlPrimitives';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Tag } from 'lucide-react';
import { COLORS, getColor } from './keepUtils';
import RichEditor from './RichEditor';
import { usePersistentDraft } from '../../hooks/usePersistentDraft';

interface NoteQuickCaptureProps {
  onSave: (note: { title: string; content: string; color: string; tags: string[] }) => void;
  busy: boolean;
  allTags?: string[];
}

export default function NoteQuickCapture({ onSave, busy, allTags }: NoteQuickCaptureProps) {
  // Persisted — typed note text must survive a backgrounded-tab kill before it's saved.
  const [title, setTitle] = usePersistentDraft('vanguard_note_quickcapture_title', '');
  const [content, setContent] = usePersistentDraft('vanguard_note_quickcapture_content', '');
  const [color, setColor] = useState('default');
  const [tagsText, setTagsText] = usePersistentDraft('vanguard_note_quickcapture_tags', '');
  const [isExpanded, setIsExpanded] = useState(() => Boolean(title.trim() || content.trim()));
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    setTitle('');
    setContent('');
    setColor('default');
    setTagsText('');
    setIsExpanded(false);
  }, [setTitle, setContent, setTagsText]);

  const handleSave = useCallback(() => {
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
  }, [title, content, tagsText, color, onSave, handleClose]);

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
  }, [isExpanded, title, content, handleClose, handleSave]);

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
          <Pressable
            type="button"
            aria-label="Utwórz notatkę"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <Plus size={16} />
          </Pressable>
        </div>
      ) : (
        <div className="note-quick-capture-expanded">
          <ControlInput
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
              className="min-h-[var(--legacy-h-036)]"
              style={{ color: c.textSub }}
            />
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Tag size={10} style={{ opacity: 'var(--legacy-inline-style-064)' }} />
            <ControlInput
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
                    <Pressable
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
                    </Pressable>
                  );
                })}
              </div>
            </div>
          )}

          <div className="note-quick-footer" style={{ borderColor: c.border }}>
            <div className="note-quick-actions">
              {COLORS.map(col => (
                <Pressable
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
              <Pressable
                type="button"
                onClick={handleClose}
                className="note-quick-close-btn"
              >
                Anuluj
              </Pressable>
              <Pressable
                type="button"
                onClick={handleSave}
                disabled={busy}
                className="note-quick-save-btn"
              >
                Dodaj
              </Pressable>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
