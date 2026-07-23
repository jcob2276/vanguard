/**
 * @component InlineEditor
 * @role Wspólny panel edycji notatki używany w widokach siatki i podziału.
 * @composes RichEditor
 * @usedBy SplitNotesView
 */
import { ControlSelect, Pressable } from '../ui/ControlPrimitives';
import { useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import RichEditor from './RichEditor';
import { getColor, Note, getPlainText, relativeDate } from './keepUtils';
import { invokeEdge } from '../../lib/supabase';
import { notify, confirmDialog } from '../../lib/notify';
import { useUserId } from '../../store/useStore';
import { createSourceTodos } from '../../lib/behavior/captureBridge';
import { useNoteDraftAutosave } from './useNoteDraftAutosave';
import NoteAttachments from './NoteAttachments';
import type { NoteFolder } from '../../lib/noteFoldersApi';
import NoteSaveIndicator from './NoteSaveIndicator';
import { deriveNoteMetadata } from '../../lib/noteText';
import NoteEditorMoreMenu from './NoteEditorMoreMenu';

interface InlineEditorProps {
  note: Note;
  onClose: (isEmpty?: boolean) => void;
  onUpdate: (id: string, patch: Partial<Note>) => void;
  onDelete: (id: string) => void;
  onTogglePin: (note: Note) => void;
  busy: boolean;
  allTags?: string[];
  allNotes?: Note[];
  onExportChecklists?: (note: Note) => void;
  isMobile: boolean;
  folders?: NoteFolder[];
  onExportNote?: (note: Note) => void;
  onNavigateToNote?: (noteId: string) => void;
  onLockNote?: (note: Note) => Promise<void>;
}



export default function InlineEditor({
  note, onClose, onUpdate, onDelete, onTogglePin, busy: _busy, allTags: _allTags = [], allNotes = [], onExportChecklists: _onExportChecklists, isMobile, folders = [], onExportNote, onNavigateToNote, onLockNote,
}: InlineEditorProps) {
  const userId = useUserId();
  const {
    content, color, folder_id, saveStatus, flush: flushSave, flushAndWait, retrySave,
    setContent, setColor, setFolderId,
  } = useNoteDraftAutosave({ note, onSave: onUpdate });
  const [_aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{ type: string; text: string } | null>(null);
  
  const c = getColor(color);
  const metadata = deriveNoteMetadata(content);

  const aiSummarize = async () => {
    setAiLoading('summary');
    setAiResult(null);
    try {
      const plain = getPlainText(content);
      if (plain.length < 20) { notify('Notatka jest za krótka.', 'error'); setAiLoading(null); return; }
      const data = await invokeEdge('vanguard-oracle', {
        body: { mode: 'note_summary', content: plain, title: metadata.title }
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
        body: { mode: 'extract_tasks', content: plain, title: metadata.title }
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
            <Pressable variant="ghost" size="sm" onClick={() => {
              const isEmpty = getPlainText(content).length === 0;
              if (!isEmpty) flushSave();
              onClose(isEmpty);
            }} className="keep-note-back text-inherit hover:bg-text-primary/5">
              <ChevronLeft size={22} />
              <span>Notatki</span>
            </Pressable>
          )}
          {!isMobile && <span className="text-4xs uppercase tracking-widest opacity-[var(--opacity-60)] font-black">Notatka</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <NoteEditorMoreMenu
            pinned={note.is_pinned}
            color={color}
            onPin={() => onTogglePin(note)}
            onArchive={() => { onUpdate(note.id, { is_archived: !note.is_archived }); onClose(); }}
            onExport={onExportNote ? () => onExportNote({ ...note, ...metadata, content, color, folder_id }) : undefined}
            onLock={onLockNote ? () => { void flushAndWait().then(() => onLockNote({
              ...note, ...metadata, content, color, folder_id,
            })); } : undefined}
            onDelete={() => { void confirmDialog('Czy usunąć tę notatkę?').then(confirmed => { if (confirmed) { onDelete(note.id); onClose(); } }); }}
            onSummarize={() => { void aiSummarize(); }}
            onExtractTasks={() => { void aiExtractTasks(); }}
            onColor={setColor}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3 max-w-3xl mx-auto w-full">
        <div className="text-4xs text-text-muted/65 font-bold text-center block tracking-wider uppercase">{noteDateStr}</div>
        <NoteSaveIndicator status={saveStatus} onRetry={retrySave} className="text-4xs text-center opacity-[var(--opacity-55)]" />
        {aiResult && (
          <div className="bg-text-primary/5 border border-border-custom/10 p-3 rounded-xl text-xs relative flex flex-col gap-1 leading-relaxed mb-2">
            <div className="flex items-center justify-between text-3xs opacity-[var(--opacity-60)] font-black">
              <span>{aiResult.type === 'summary' ? '🤖 PODSUMOWANIE AI' : '🤖 WYEKSTRAHOWANE ZADANIA'}</span>
              <Pressable variant="ghost" size="sm" onClick={() => setAiResult(null)} className="hover:text-text-primary text-text-muted"><X size={10} /></Pressable>
            </div>
            <p className="whitespace-pre-wrap">{aiResult.text}</p>
          </div>
        )}
        <div className="relative mt-2 min-h-[var(--ios-editor-min-height)] flex-1 select-text">
          <RichEditor value={content} onChange={setContent} placeholder="Zacznij pisać..."
            showStaticBar allNotes={allNotes} noteId={note.id} userId={userId || undefined}
            onNavigateToNote={id => { flushSave(); onNavigateToNote?.(id); }} />
        </div>
        <ControlSelect
          value={folder_id || ''}
          onChange={event => setFolderId(event.target.value || null)}
          className="w-fit rounded-lg border border-border-custom/20 bg-transparent px-2 py-1 text-3xs"
          aria-label="Folder notatki"
        >
          <option value="">Bez folderu</option>
          {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
        </ControlSelect>
        <NoteAttachments noteId={note.id} onInsertText={text => {
          const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          setContent(`${content}<p>${escaped.replace(/\n/g, '<br>')}</p>`);
        }} />
      </div>
    </div>
  );
}
