/* eslint-disable max-lines-per-function -- Dense rich-editor DOM, selection and AI commands stay coordinated here. */
/**
 * @component InlineEditor
 * @role Panel edycji notatki w trybie split (odpowiednik EditNoteModal, ale bez modala).
 * @composes RichEditor
 * @usedBy SplitNotesView
 */
import { Pressable } from '../ui/ControlPrimitives';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, Bot, ChevronLeft, Pin, Sparkles, Tag, Trash2, X } from 'lucide-react';
import RichEditor from './RichEditor';
import { COLORS, getColor, Note, getPlainText, relativeDate } from './keepUtils';
import { invokeEdge } from '../../lib/supabase';
import { notify, confirmDialog } from '../../lib/notify';
import { useUserId } from '../../store/useStore';
import { createSourceTodos } from '../../lib/behavior/captureBridge';
import Spinner from '../ui/Spinner';

interface InlineEditorProps {
  note: Note;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Note>) => void;
  onDelete: (id: string) => void;
  onTogglePin: (note: Note) => void;
  busy: boolean;
  allTags?: string[];
  allNotes?: Note[];
  onExportChecklists?: (note: Note) => void;
  isMobile: boolean;
}



export default function InlineEditor({
  note, onClose, onUpdate, onDelete, onTogglePin, busy: _busy, allTags: _allTags = [], allNotes = [], onExportChecklists, isMobile
}: InlineEditorProps) {
  const userId = useUserId();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [color, setColor] = useState(note.color);
  const [tagsInput, setTagsInput] = useState(note.tags.join(', '));
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{ type: string; text: string } | null>(null);
  
  const c = getColor(color);
  const saveTimeoutRef = useRef<number | null>(null);
  const latestValuesRef = useRef({ title, content, color, tagsInput });
  const prevNoteIdRef = useRef(note.id);

  useEffect(() => {
    latestValuesRef.current = { title, content, color, tagsInput };
  });

  const flushSave = useCallback((noteId: string) => {
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const vals = latestValuesRef.current;
    const currentNote = allNotes.find(n => n.id === noteId);
    const parsedTags = vals.tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    const hasTagsChanged = JSON.stringify(currentNote?.tags ?? []) !== JSON.stringify(parsedTags);
    
    if (
      currentNote && 
      currentNote.title === vals.title.trim() && 
      currentNote.content === vals.content.trim() && 
      currentNote.color === vals.color && 
      !hasTagsChanged
    ) {
      return;
    }

    onUpdate(noteId, {
      title: vals.title.trim(),
      content: vals.content.trim(),
      color: vals.color,
      tags: parsedTags,
    });
  }, [onUpdate, allNotes]);

  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => flushSave(note.id), 1000);
  }, [note.id, flushSave]);

  useEffect(() => {
    if (prevNoteIdRef.current !== note.id) {
      flushSave(prevNoteIdRef.current);
      prevNoteIdRef.current = note.id;
      setTitle(note.title);
      setContent(note.content);
      setColor(note.color);
      setTagsInput(note.tags.join(', '));
      setAiResult(null);
      setShowColorPicker(false);
    }
  // Reset only when navigating to another note; live note updates are autosave echoes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id, flushSave]);

  useEffect(() => {
    return () => {
      if (prevNoteIdRef.current) flushSave(prevNoteIdRef.current);
    };
  }, [flushSave]);

  const handleTitleChange = (val: string) => { setTitle(val); scheduleSave(); };
  const handleContentChange = (val: string) => { setContent(val); scheduleSave(); };
  const handleTagsChange = (val: string) => { setTagsInput(val); scheduleSave(); };

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    onUpdate(note.id, { color: newColor });
    setShowColorPicker(false);
  };

  const aiSummarize = async () => {
    setAiLoading('summary');
    setAiResult(null);
    try {
      const plain = getPlainText(content);
      if (plain.length < 20) { notify('Notatka jest za krótka.', 'error'); setAiLoading(null); return; }
      const data = await invokeEdge('vanguard-oracle', {
        body: { mode: 'note_summary', content: plain, title: title.trim() }
      }) as { summary?: string; response?: string; content?: string };
      setAiResult({ type: 'summary', text: data?.summary || data?.response || data?.content || 'Brak odpowiedzi.' });
    } catch (e: unknown) {
      notify('Błąd AI: ' + (e instanceof Error ? e.message : 'Nieznany błąd'), 'error');
    }
    setAiLoading(null);
  };

  const aiExtractTasks = async () => {
    setAiLoading('tasks');
    setAiResult(null);
    try {
      const plain = getPlainText(content);
      if (plain.length < 20) { notify('Notatka jest za krótka.', 'error'); setAiLoading(null); return; }
      const data = await invokeEdge('vanguard-oracle', {
        body: { mode: 'extract_tasks', content: plain, title: title.trim() }
      }) as { tasks?: string[] };
      const tasks: string[] = data?.tasks || [];
      if (tasks.length === 0) { setAiResult({ type: 'tasks', text: 'Brak zadań.' }); setAiLoading(null); return; }
      if (!userId) throw new Error('Brak zalogowanego użytkownika');
      
      const created = await createSourceTodos(userId, tasks, `source:note:${note.id}`);
      setAiResult({ type: 'tasks', text: created.length ? `Dodano ${created.length} zadań.` : 'Nie dodano duplikatów.' });
      notify(created.length ? `Dodano ${created.length} zadań do listy.` : 'Te zadania są już na liście.', 'success');
    } catch (e: unknown) {
      notify('Błąd AI: ' + (e instanceof Error ? e.message : 'Nieznany błąd'), 'error');
    }
    setAiLoading(null);
  };

  const noteDateStr = relativeDate(note.updated_at || note.created_at);

  return (
    <div 
      className="keep-inline-editor flex flex-col h-full overflow-hidden"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      <div className="keep-inline-header flex items-center justify-between border-b border-border-custom/10 px-4 py-3 bg-background/5">
        <div className="flex items-center gap-2">
          {isMobile && (
            <Pressable variant="ghost" size="sm" onClick={() => { flushSave(note.id); onClose(); }} className="keep-note-back text-inherit hover:bg-black/5">
              <ChevronLeft size={22} />
              <span>Notatki</span>
            </Pressable>
          )}
          {!isMobile && <span className="text-4xs uppercase tracking-widest opacity-60 font-black">Notatka</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <Pressable variant="ghost" size="sm" onClick={() => onTogglePin(note)} className={`${note.is_pinned ? 'text-[var(--color-warning)]' : 'text-inherit'} hover:bg-black/5`}>
            <Pin size={15} fill={note.is_pinned ? 'currentColor' : 'none'} />
          </Pressable>
          <Pressable variant="ghost" size="sm" onClick={() => { onUpdate(note.id, { is_archived: !note.is_archived }); onClose(); }} className="keep-note-secondary-action text-inherit hover:bg-black/5">
            <Archive size={15} />
          </Pressable>
          <div className="keep-note-secondary-action relative">
            <Pressable variant="ghost" size="sm" onClick={() => setShowColorPicker(!showColorPicker)} className="text-inherit hover:bg-black/5 w-6 h-6 flex items-center justify-center">
              <span className="w-3.5 h-3.5 rounded-full border border-border-custom/30 inline-block" style={{ backgroundColor: c.dot }} />
            </Pressable>
            {showColorPicker && (
              <div className="absolute right-0 top-8 z-50 bg-surface-solid border border-border-custom p-2 rounded-xl shadow-lg flex gap-1.5 w-max max-w-44 flex-wrap">
                {COLORS.map(o => (
                  <button key={o.id} onClick={() => handleColorChange(o.id)} className={`w-6 h-6 rounded-full border transition-all hover:scale-110 cursor-pointer ${color === o.id ? 'border-primary' : 'border-border-custom/40'}`} style={{ backgroundColor: o.dot }} />
                ))}
              </div>
            )}
          </div>
          <Pressable variant="ghost" size="sm" onClick={async () => { if (await confirmDialog('Czy usunąć tę notatkę?')) { onDelete(note.id); onClose(); } }} className="keep-note-secondary-action text-inherit hover:bg-black/5 hover:text-danger">
            <Trash2 size={15} />
          </Pressable>
          {onExportChecklists && (
            <Pressable variant="ghost" size="sm" onClick={() => onExportChecklists(note)} className="keep-note-secondary-action text-inherit hover:bg-black/5">
              <X size={15} className="rotate-45" />
            </Pressable>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3 max-w-3xl mx-auto w-full">
        <div className="text-4xs text-text-muted/65 font-bold text-center block tracking-wider uppercase">{noteDateStr}</div>
        <input type="text" placeholder="Tytuł..." value={title} onChange={(e) => handleTitleChange(e.target.value)} className="w-full text-xl font-black bg-transparent border-0 outline-none p-0 focus:ring-0 text-inherit placeholder:opacity-30 tracking-tight" style={{ color: 'inherit' }} />
        <div className="flex items-center gap-1.5 text-4xs opacity-80 py-1">
          <Tag size={9} className="opacity-50" />
          <input type="text" placeholder="Dodaj tagi..." value={tagsInput} onChange={(e) => handleTagsChange(e.target.value)} className="bg-transparent border-0 outline-none p-0 flex-1 text-inherit placeholder:opacity-45 text-3xs focus:ring-0 focus:outline-none" />
        </div>
        <div className="keep-note-ai-actions flex gap-2 my-1">
          <Pressable variant="ghost" size="sm" onClick={aiSummarize} disabled={!!aiLoading} className="text-4xs flex items-center gap-1 bg-black/5 hover:bg-black/10 border-0 rounded-lg text-inherit font-bold">
            {aiLoading === 'summary' ? <Spinner size="sm" className="h-3 w-3 !border-inherit/30" /> : <Sparkles size={10} />}
            Napisz podsumowanie
          </Pressable>
          <Pressable variant="ghost" size="sm" onClick={aiExtractTasks} disabled={!!aiLoading} className="text-4xs flex items-center gap-1 bg-black/5 hover:bg-black/10 border-0 rounded-lg text-inherit font-bold">
            {aiLoading === 'tasks' ? <Spinner size="sm" className="h-3 w-3 !border-inherit/30" /> : <Bot size={10} />}
            Wyciągnij zadania do Todo
          </Pressable>
        </div>
        {aiResult && (
          <div className="bg-black/5 border border-border-custom/10 p-3 rounded-xl text-xs relative flex flex-col gap-1 leading-relaxed mb-2">
            <div className="flex items-center justify-between text-3xs opacity-60 font-black">
              <span>{aiResult.type === 'summary' ? '🤖 PODSUMOWANIE AI' : '🤖 WYEKSTRAHOWANE ZADANIA'}</span>
              <Pressable variant="ghost" size="sm" onClick={() => setAiResult(null)} className="hover:text-text-primary text-text-muted"><X size={10} /></Pressable>
            </div>
            <p className="whitespace-pre-wrap">{aiResult.text}</p>
          </div>
        )}
        <div className="flex-1 min-h-[300px] relative select-text mt-2">
          <RichEditor value={content} onChange={handleContentChange} placeholder="Zacznij pisać..." showStaticBar={true} allNotes={allNotes} />
        </div>
      </div>
    </div>
  );
}
