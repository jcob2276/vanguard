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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <nav className="keep-ios-nav" style={{ borderBottomColor: c.border }}>
            <button type="button" className="keep-ios-back" onClick={handleSave}>
              <ChevronLeft size={22} strokeWidth={2.5} />
              <span>Notatki</span>
            </button>
            <span className="keep-ios-date" style={{ color: c.textSub }}>{noteDate}</span>
            <div className="keep-ios-nav-right">
              <button
                type="button"
                title="Asystent AI"
                onClick={() => setShowAI(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                  background: showAI ? 'var(--primary)' : 'rgba(99,102,241,0.12)',
                  color: showAI ? '#fff' : 'var(--primary)',
                  border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                <Sparkles size={13} />
                AI
              </button>
              <button type="button" className="keep-ios-done" onClick={handleSave}>Gotowe</button>
              <button type="button" className="keep-ios-more" onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}>
                <MoreHorizontal size={22} />
              </button>
            </div>
          </nav>

          {showMenu && (
            <>
              <div className="keep-menu-overlay" onClick={() => setShowMenu(false)} />
              <div className="keep-menu" onClick={e => e.stopPropagation()}>
                <div className="keep-menu-colors">
                  {COLORS.map(col => (
                    <button key={col.id} type="button" title={col.label} onClick={() => setColor(col.id)}
                      className={`keep-swatch ${color === col.id ? 'selected' : ''}`} style={{ backgroundColor: col.dot }} />
                  ))}
                </div>
                <div className="keep-menu-rule" />
                <button type="button" className="keep-menu-item" onClick={() => { onTogglePin(note); setShowMenu(false); }}>
                  <Pin size={17} fill={note.is_pinned ? 'currentColor' : 'none'} />
                  <span>{note.is_pinned ? 'Odepnij' : 'Przypnij'}</span>
                </button>
                {uncheckedCount > 0 && onExportChecklists && (
                  <button type="button" className="keep-menu-item" onClick={() => { onExportChecklists({ ...note, title, content }); setShowMenu(false); }}>
                    <ListTodo size={17} />
                    <span>Eksportuj {uncheckedCount} pkt. do zadan</span>
                  </button>
                )}
                <button type="button" className="keep-menu-item"
                  onClick={() => { onUpdate(note.id, { is_archived: !note.is_archived, is_pinned: false }); setShowMenu(false); onClose(); }}>
                  <Archive size={17} />
                  <span>{note.is_archived ? 'Przywroc' : 'Archiwizuj'}</span>
                </button>
                <div className="keep-menu-rule" />
                <button type="button" className="keep-menu-item danger" onClick={() => { onDelete(note.id); onClose(); }} disabled={busy}>
                  <Trash2 size={17} />
                  <span>Usun notatke</span>
                </button>
              </div>
            </>
          )}

          <div className="keep-modal-body" ref={bodyRef}>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Tytul" className="keep-ios-title-input" style={{ color: c.text }} />
            <div className="keep-ios-meta-row" style={{ borderBottomColor: c.border }}>
              <Tag size={10} style={{ opacity: 0.35, flexShrink: 0 }} />
              <input value={tagsInput} onChange={e => setTagsInput(e.target.value)}
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
                      <button key={tag} type="button"
                        onClick={() => {
                          const tagsList = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
                          const isExist = tagsList.some(t => t.toLowerCase() === tag.toLowerCase());
                          setTagsInput(isExist
                            ? tagsList.filter(t => t.toLowerCase() !== tag.toLowerCase()).join(', ')
                            : [...tagsList, tag].join(', '));
                        }}
                        className={`tag-suggestion-pill ${isActive ? 'active' : ''}`}
                      >{tag}</button>
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
                    <button key={bl.id} type="button" className="keep-backlink-item"
                      onClick={() => {
                        if (onNavigateToNote) {
                          onUpdate(note.id, { title: title.trim(), content: content.trim(), color, tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean) });
                          onNavigateToNote(bl.id);
                        }
                      }}>
                      <span>📎</span>
                      {bl.title || '(Bez tytulu)'}
                      <ChevronRight size={10} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between px-5 py-2.5 border-t border-border-custom/20 text-[10px] text-text-muted/50 mt-auto bg-surface-solid/5 select-none" style={{ borderColor: c.border }}>
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
              padding: '14px 16px', borderBottom: `1px solid ${c.border}`,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(168,85,247,0.04) 100%)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={14} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>AI Companion</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 500 }}>Asystent notatek</div>
                </div>
              </div>
              <button type="button" onClick={() => setShowAI(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { key: 'summary', label: 'Stworz podsumowanie', sub: 'TL;DR notatki jednym kliknieciem', Icon: BrainCircuit, color: 'var(--primary)', bg: 'rgba(99,102,241,0.12)', action: aiSummarize },
                { key: 'tasks', label: 'Wyciagnij zadania', sub: 'Automatycznie tworzy zadania w Todo', Icon: ListTodo, color: '#22c55e', bg: 'rgba(34,197,94,0.12)', action: aiExtractTasks },
                { key: 'connect', label: 'Polacz tematy', sub: 'Sugestie powiazanych notatek', Icon: Cpu, color: '#a855f7', bg: 'rgba(168,85,247,0.12)', action: aiConnectTopics },
              ].map(btn => (
                <button key={btn.key} type="button" disabled={!!aiLoading} onClick={btn.action}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
                    borderRadius: 10, border: '1px solid var(--border)',
                    background: aiLoading === btn.key ? btn.bg.replace('0.12', '0.20') : 'transparent',
                    cursor: aiLoading ? 'wait' : 'pointer', transition: 'all 0.2s', textAlign: 'left', width: '100%',
                  }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: btn.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {aiLoading === btn.key
                      ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} color={btn.color} />
                      : <btn.Icon size={14} color={btn.color} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{btn.label}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{btn.sub}</div>
                  </div>
                </button>
              ))}
            </div>

            {aiResult && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px' }}>
                <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', background: 'rgba(148,163,184,0.04)' }}>
                  <div style={{ padding: '8px 12px', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={9} />
                    {aiResult.type === 'summary' && 'Podsumowanie'}
                    {aiResult.type === 'tasks' && 'Wyciagniete zadania'}
                    {aiResult.type === 'connect' && 'Sugestie polaczen'}
                  </div>
                  <div style={{ padding: '12px', fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {aiResult.text}
                  </div>
                  {aiResult.type === 'summary' && (
                    <button type="button"
                      onClick={() => {
                        const summaryHtml = `<div class="keep-callout-block">💡 <strong>Podsumowanie AI:</strong> ${aiResult.text}</div><p><br></p>`;
                        setContent(summaryHtml + content);
                        setAiResult(null);
                        notify('Podsumowanie dodane na gore notatki!', 'success');
                      }}
                      style={{ width: '100%', padding: '8px 12px', fontSize: 10, fontWeight: 700, borderTop: '1px solid var(--border)', background: 'rgba(99,102,241,0.06)', color: 'var(--primary)', cursor: 'pointer', border: 'none', borderRadius: '0 0 10px 10px', transition: 'all 0.15s' }}>
                      Wstaw na gore notatki
                    </button>
                  )}
                </div>
              </div>
            )}

            {!aiResult && !aiLoading && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 10 }}>
                <Bot size={32} style={{ opacity: 0.25 }} />
                <p style={{ fontSize: 10, textAlign: 'center', color: 'var(--text-muted)', lineHeight: 1.5, fontWeight: 500, opacity: 0.6 }}>Wybierz akcje AI powyzej, aby przeanalizowac te notatke</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
