import { Pressable, ControlInput } from '../ui/ControlPrimitives';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, Bot, BrainCircuit, ChevronLeft, ChevronRight, Cpu, Link2, ListTodo, Loader2, MoreHorizontal, Pin, Sparkles, Tag, Trash2, X } from 'lucide-react';
import RichEditor from './RichEditor';
import { COLORS, getColor, Note } from './keepUtils';
import { supabase } from '../../lib/supabase';
import { notify } from '../../lib/notify';
import { useUserId } from '../../store/useStore';
export default function EditNoteModal({
  note,
  onClose,
  onUpdate,
  onDelete,
  onTogglePin,
  busy,
  allTags,
  allNotes = [],
  onExportChecklists,
  onNavigateToNote,
}: {
  note: Note;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Note>) => void;
  onDelete: (id: string) => void;
  onTogglePin: (note: Note) => void;
  busy: boolean;
  allTags?: string[];
  allNotes?: Note[];
  onExportChecklists?: (note: Note) => void;
  onNavigateToNote?: (noteId: string) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [color, setColor] = useState(note.color);
  const [tagsInput, setTagsInput] = useState(note.tags.join(', '));
  const [showMenu, setShowMenu] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{ type: string; text: string } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const c = getColor(color), userId = useUserId();

  useEffect(() => {
    void (async () => {
      setTitle(note.title);
      setContent(note.content);
      setColor(note.color);
      setTagsInput(note.tags.join(', '));
      setAiResult(null);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

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

  // Wiki-link navigation listener
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { noteId: string };
      if (detail?.noteId && onNavigateToNote) {
        onUpdate(note.id, {
          title: title.trim(),
          content: content.trim(),
          color,
          tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
        });
        onNavigateToNote(detail.noteId);
      }
    };
    el.addEventListener('wiki-link-navigate', handler);
    return () => el.removeEventListener('wiki-link-navigate', handler);
  }, [note.id, onUpdate, onNavigateToNote, title, content, color, tagsInput]);

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

  const { wordCount, charCount } = (() => {
    const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const chars = text.length;
    const words = text ? text.split(' ').length : 0;
    return { wordCount: words, charCount: chars };
  })();

  // Backlinks: notes that reference this note by id or title
  const backlinks = allNotes.filter(n => {
    if (n.id === note.id) return false;
    return n.content.includes(`data-note-id="${note.id}"`) ||
      (note.title && n.content.includes(`[[${note.title}]]`));
  });

  const getPlainText = () => content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  const aiSummarize = async () => {
    setAiLoading('summary');
    setAiResult(null);
    try {
      const plain = getPlainText();
      if (plain.length < 20) { notify('Notatka jest za krótka do podsumowania.', 'error'); setAiLoading(null); return; }
      const { data, error } = await supabase.functions.invoke('vanguard-oracle', {
        body: { mode: 'note_summary', content: plain, title: title.trim() }
      });
      if (error) throw error;
      const summary = data?.summary || data?.response || data?.content || 'Brak odpowiedzi.';
      setAiResult({ type: 'summary', text: summary });
    } catch (e: unknown) {
      notify('Blad AI: ' + (e instanceof Error ? e.message : 'Nieznany blad'), 'error');
    }
    setAiLoading(null);
  };

  const aiExtractTasks = async () => {
    setAiLoading('tasks');
    setAiResult(null);
    try {
      const plain = getPlainText();
      if (plain.length < 20) { notify('Notatka jest za krótka.', 'error'); setAiLoading(null); return; }
      const { data, error } = await supabase.functions.invoke('vanguard-oracle', {
        body: { mode: 'extract_tasks', content: plain, title: title.trim() }
      });
      if (error) throw error;
      const tasks: string[] = data?.tasks || [];
      if (tasks.length === 0) {
        setAiResult({ type: 'tasks', text: 'Nie znaleziono zadań w tej notatce.' });
        setAiLoading(null);
        return;
      }
      if (!userId) throw new Error('Brak zalogowanego użytkownika');
      const inserts = tasks.map((t: string) => ({
        user_id: userId,
        title: t.trim(),
        status: 'open',
      }));
      const { error: insertErr } = await supabase.from('todo_items').insert(inserts);
      if (insertErr) throw insertErr;
      notify(`Dodano ${tasks.length} zadan do listy!`, 'success');
      setAiResult({ type: 'tasks', text: `Dodano ${tasks.length} zadan:\n- ${tasks.join('\n- ')}` });
    } catch (e: unknown) {
      notify('Blad AI: ' + (e instanceof Error ? e.message : 'Nieznany blad'), 'error');
    }
    setAiLoading(null);
  };

  const aiConnectTopics = async () => {
    setAiLoading('connect');
    setAiResult(null);
    try {
      const plain = getPlainText();
      const otherTitles = allNotes.filter(n => n.id !== note.id && n.title).map(n => n.title).slice(0, 30);
      const { data, error } = await supabase.functions.invoke('vanguard-oracle', {
        body: { mode: 'connect_notes', content: plain, title: title.trim(), other_titles: otherTitles }
      });
      if (error) throw error;
      const suggestions = data?.suggestions || data?.response || 'Brak sugestii.';
      setAiResult({ type: 'connect', text: suggestions });
    } catch (e: unknown) {
      notify('Blad AI: ' + (e instanceof Error ? e.message : 'Nieznany blad'), 'error');
    }
    setAiLoading(null);
  };

  const allNotesMeta = allNotes.map(n => ({ id: n.id, title: n.title }));

  return (
    <>
      <div className="keep-modal-backdrop" onClick={e => { e.stopPropagation(); handleSave(); }} />
      <div
        className="keep-modal-content"
        style={{ backgroundColor: c.bg, borderColor: c.border, display: 'flex', flexDirection: 'row', overflow: 'hidden', maxWidth: showAI ? 860 : undefined }}
        onClick={e => e.stopPropagation()}
      >
        {/* Main note column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 'var(--legacy-inline-style-058)' }}>
          <nav className="keep-ios-nav" style={{ borderBottomColor: c.border }}>
            <Pressable type="button" className="keep-ios-back" onClick={handleSave}>
              <ChevronLeft size={22} strokeWidth={2.5} />
              <span>Notatki</span>
            </Pressable>
            <span className="keep-ios-date" style={{ color: c.textSub }}>{noteDate}</span>
            <div className="keep-ios-nav-right">
              <Pressable
                type="button"
                title="Asystent AI"
                onClick={() => setShowAI(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--legacy-inline-style-030)',
                  padding: 'var(--legacy-inline-style-077)', borderRadius: 'var(--legacy-inline-style-011)', fontSize: 'var(--legacy-inline-style-018)', fontWeight: 'var(--legacy-inline-style-026)',
                  background: showAI ? 'var(--primary)' : 'var(--primary-12)',
                  color: showAI ? 'var(--legacy-color-046)' : 'var(--primary)',
                  border: 'none', cursor: 'pointer', transition: 'var(--legacy-inline-style-086)',
                }}
              >
                <Sparkles size={13} />
                AI
              </Pressable>
              <Pressable type="button" className="keep-ios-done" onClick={handleSave}>Gotowe</Pressable>
              <Pressable type="button" className="keep-ios-more" onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}>
                <MoreHorizontal size={22} />
              </Pressable>
            </div>
          </nav>

          {showMenu && (
            <>
              <div className="keep-menu-overlay" onClick={() => setShowMenu(false)} />
              <div className="keep-menu" onClick={e => e.stopPropagation()}>
                <div className="keep-menu-colors">
                  {COLORS.map(col => (
                    <Pressable key={col.id} type="button" title={col.label} onClick={() => setColor(col.id)}
                      className={`keep-swatch ${color === col.id ? 'selected' : ''}`} style={{ backgroundColor: col.dot }} />
                  ))}
                </div>
                <div className="keep-menu-rule" />
                <Pressable type="button" className="keep-menu-item" onClick={() => { onTogglePin(note); setShowMenu(false); }}>
                  <Pin size={17} fill={note.is_pinned ? 'currentColor' : 'none'} />
                  <span>{note.is_pinned ? 'Odepnij' : 'Przypnij'}</span>
                </Pressable>
                {uncheckedCount > 0 && onExportChecklists && (
                  <Pressable type="button" className="keep-menu-item" onClick={() => { onExportChecklists({ ...note, title, content }); setShowMenu(false); }}>
                    <ListTodo size={17} />
                    <span>Eksportuj {uncheckedCount} pkt. do zadan</span>
                  </Pressable>
                )}
                <Pressable type="button" className="keep-menu-item"
                  onClick={() => { onUpdate(note.id, { is_archived: !note.is_archived, is_pinned: false }); setShowMenu(false); onClose(); }}>
                  <Archive size={17} />
                  <span>{note.is_archived ? 'Przywroc' : 'Archiwizuj'}</span>
                </Pressable>
                <div className="keep-menu-rule" />
                <Pressable type="button" className="keep-menu-item danger" onClick={() => { onDelete(note.id); onClose(); }} disabled={busy}>
                  <Trash2 size={17} />
                  <span>Usun notatke</span>
                </Pressable>
              </div>
            </>
          )}

          <div className="keep-modal-body" ref={bodyRef}>
            <ControlInput autoFocus value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Tytul" className="keep-ios-title-input" style={{ color: c.text }} />
            <div className="keep-ios-meta-row" style={{ borderBottomColor: c.border }}>
              <Tag size={10} style={{ opacity: 'var(--legacy-inline-style-063)', flexShrink: 0 }} />
              <ControlInput value={tagsInput} onChange={e => setTagsInput(e.target.value)}
                placeholder="Tagi..." className="keep-ios-tags-input" style={{ color: c.textSub }} />
            </div>
            {allTags && allTags.length > 0 && (
              <div className="mt-2.5 px-3">
                <p className="tag-suggestions-label">Sugerowane tagi</p>
                <div className="tag-suggestions-list">
                  {allTags.map(tag => {
                    const currentTags = tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
                    const isActive = currentTags.includes(tag.toLowerCase());
                    return (
                      <Pressable key={tag} type="button"
                        onClick={() => {
                          const tagsList = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
                          const isExist = tagsList.some(t => t.toLowerCase() === tag.toLowerCase());
                          setTagsInput(isExist
                            ? tagsList.filter(t => t.toLowerCase() !== tag.toLowerCase()).join(', ')
                            : [...tagsList, tag].join(', '));
                        }}
                        className={`tag-suggestion-pill ${isActive ? 'active' : ''}`}
                      >{tag}</Pressable>
                    );
                  })}
                </div>
              </div>
            )}
            <RichEditor
              value={content}
              onChange={setContent}
              placeholder="Zacznij pisac... wpisz / dla komend, [[ aby polaczyc notatke"
              className="keep-ios-editor"
              style={{ color: c.textSub }}
              showStaticBar
              allNotes={allNotesMeta}
            />

            {backlinks.length > 0 && (
              <div className="keep-backlinks-section">
                <div className="keep-backlinks-title">
                  <Link2 size={11} />
                  Notatki linkujace do tej strony ({backlinks.length})
                </div>
                <div>
                  {backlinks.map(bl => (
                    <Pressable key={bl.id} type="button" className="keep-backlink-item"
                      onClick={() => {
                        if (onNavigateToNote) {
                          onUpdate(note.id, { title: title.trim(), content: content.trim(), color, tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean) });
                          onNavigateToNote(bl.id);
                        }
                      }}>
                      <span>📎</span>
                      {bl.title || '(Bez tytulu)'}
                      <ChevronRight size={10} />
                    </Pressable>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between px-5 py-2.5 border-t border-border-custom/20 text-xs text-text-muted/50 mt-auto bg-surface-solid/5 select-none" style={{ borderColor: c.border }}>
              <span>{wordCount} slow / {charCount} znakow</span>
              {uncheckedCount > 0 && <span className="font-semibold text-primary">{uncheckedCount} otwartych podpunktow</span>}
            </div>
          </div>
        </div>

        {/* AI Smart Companion side-panel */}
        {showAI && (
          <div className="keep-ai-companion" style={{ borderColor: c.border }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: 'var(--legacy-inline-style-074)', borderBottom: `1px solid ${c.border}`,
              background: 'linear-gradient(135deg, var(--primary-5) 0%, var(--legacy-color-100) 100%)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--legacy-inline-style-032)' }}>
                <div style={{ width: 'var(--legacy-inline-style-095)', height: 'var(--legacy-inline-style-036)', borderRadius: 'var(--legacy-inline-style-011)', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={14} color="var(--legacy-color-046)" />
                </div>
                <div>
                  <div style={{ fontSize: 'var(--legacy-inline-style-019)', fontWeight: 'var(--legacy-inline-style-027)', color: 'var(--text-primary)', letterSpacing: 'var(--legacy-inline-style-042)' }}>AI Companion</div>
                  <div style={{ fontSize: 'var(--legacy-inline-style-023)', color: 'var(--text-muted)', fontWeight: 'var(--legacy-inline-style-024)' }}>Asystent notatek</div>
                </div>
              </div>
              <Pressable type="button" onClick={() => setShowAI(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 'var(--legacy-inline-style-076)' }}>
                <X size={14} />
              </Pressable>
            </div>

            <div style={{ padding: 'var(--legacy-inline-style-072)', display: 'flex', flexDirection: 'column', gap: 'var(--legacy-inline-style-032)' }}>
              {[
                { key: 'summary', label: 'Stworz podsumowanie', sub: 'TL;DR notatki jednym kliknieciem', Icon: BrainCircuit, color: 'var(--primary)', bg: 'var(--primary-12)', action: aiSummarize },
                { key: 'tasks', label: 'Wyciagnij zadania', sub: 'Automatycznie tworzy zadania w Todo', Icon: ListTodo, color: 'var(--legacy-color-010)', bg: 'var(--legacy-color-144)', action: aiExtractTasks },
                { key: 'connect', label: 'Polacz tematy', sub: 'Sugestie powiazanych notatek', Icon: Cpu, color: 'var(--legacy-color-033)', bg: 'var(--legacy-color-101)', action: aiConnectTopics },
              ].map(btn => (
                <Pressable key={btn.key} type="button" disabled={!!aiLoading} onClick={btn.action}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 'var(--legacy-inline-style-029)', padding: 'var(--legacy-inline-style-073)',
                    borderRadius: 'var(--legacy-inline-style-004)', border: '1px solid var(--border)',
                    background: aiLoading === btn.key ? btn.bg.replace('0.12', '0.20') : 'transparent',
                    cursor: aiLoading ? 'wait' : 'pointer', transition: 'var(--legacy-inline-style-086)', textAlign: 'left', width: 'var(--legacy-inline-style-092)',
                  }}>
                  <div style={{ width: 'var(--legacy-inline-style-096)', height: 'var(--legacy-inline-style-037)', borderRadius: 'var(--legacy-inline-style-011)', background: btn.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {aiLoading === btn.key
                      ? <Loader2 size={14} style={{ animation: 'var(--legacy-inline-style-002)' }} color={btn.color} />
                      : <btn.Icon size={14} color={btn.color} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--legacy-inline-style-018)', fontWeight: 'var(--legacy-inline-style-026)', color: 'var(--text-primary)' }}>{btn.label}</div>
                    <div style={{ fontSize: 'var(--legacy-inline-style-023)', color: 'var(--text-muted)', marginTop: 'var(--legacy-inline-style-053)', lineHeight: 'var(--legacy-inline-style-048)' }}>{btn.sub}</div>
                  </div>
                </Pressable>
              ))}
            </div>

            {aiResult && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--legacy-inline-style-068)' }}>
                <div style={{ borderRadius: 'var(--legacy-inline-style-004)', border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--legacy-color-072)' }}>
                  <div style={{ padding: 'var(--legacy-inline-style-079)', fontSize: 'var(--legacy-inline-style-023)', fontWeight: 'var(--legacy-inline-style-028)', textTransform: 'uppercase', letterSpacing: 'var(--legacy-inline-style-044)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 'var(--legacy-inline-style-031)' }}>
                    <Sparkles size={9} />
                    {aiResult.type === 'summary' && 'Podsumowanie'}
                    {aiResult.type === 'tasks' && 'Wyciagniete zadania'}
                    {aiResult.type === 'connect' && 'Sugestie polaczen'}
                  </div>
                  <div style={{ padding: 'var(--legacy-inline-style-072)', fontSize: 'var(--legacy-inline-style-018)', color: 'var(--text-primary)', lineHeight: 'var(--legacy-inline-style-050)', whiteSpace: 'pre-wrap' }}>
                    {aiResult.text}
                  </div>
                  {aiResult.type === 'summary' && (
                    <Pressable type="button"
                      onClick={() => {
                        const summaryHtml = `<div class="keep-callout-block">💡 <strong>Podsumowanie AI:</strong> ${aiResult.text}</div><p><br></p>`;
                        setContent(summaryHtml + content);
                        setAiResult(null);
                        notify('Podsumowanie dodane na gore notatki!', 'success');
                      }}
                      style={{ width: 'var(--legacy-inline-style-092)', padding: 'var(--legacy-inline-style-079)', fontSize: 'var(--legacy-inline-style-017)', fontWeight: 'var(--legacy-inline-style-026)', borderTop: '1px solid var(--border)', background: 'var(--primary-5)', color: 'var(--primary)', cursor: 'pointer', border: 'none', borderRadius: 'var(--legacy-inline-style-003)', transition: 'var(--legacy-inline-style-085)' }}>
                      Wstaw na gore notatki
                    </Pressable>
                  )}
                </div>
              </div>
            )}

            {!aiResult && !aiLoading && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--legacy-inline-style-075)', gap: 'var(--legacy-inline-style-029)' }}>
                <Bot size={32} style={{ opacity: 'var(--legacy-inline-style-062)' }} />
                <p style={{ fontSize: 'var(--legacy-inline-style-017)', textAlign: 'center', color: 'var(--text-muted)', lineHeight: 'var(--legacy-inline-style-049)', fontWeight: 'var(--legacy-inline-style-024)', opacity: 'var(--legacy-inline-style-066)' }}>Wybierz akcje AI powyzej, aby przeanalizowac te notatke</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
