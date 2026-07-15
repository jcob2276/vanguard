import { Pressable, ControlInput, ControlSelect, ControlTextarea } from '../ui/ControlPrimitives';
import React, { useState } from 'react';
import { Paperclip, X, Calendar, Flag, Bell, Tag, Folder, ChevronDown } from 'lucide-react';
import NlpHighlightInput from './NlpHighlightInput';
import TodoDatePickerPopover from './TodoDatePickerPopover';
import TodoReminderPopover from './TodoReminderPopover';
import TodoCardSubtasks from './TodoCardSubtasks';
import { Card } from '../ui/Card';
import type { useTodoCardAttachments } from './useTodoCardAttachments';
import type { TodoItemRow, TodoAttachmentRow } from '../../lib/todo/todo';

interface TodoCardExpandedPanelProps {
  item: TodoItemRow;
  isEditing: boolean;
  editingTitle: string;
  onEditStart: (t: string) => void;
  onEditChange: (val: string) => void;
  onEditSave: () => void;
  onSetNotes?: (notes: string | null) => void;
  onSetDueDate: (date: string | null) => void;
  onSetPriority: (p: string) => void;
  onSetReminder: (isoDatetime: string) => void;
  onSetTags: (tags: string[]) => void;
  onMoveSection: (sId: string | null) => void;
  onDrop: () => void;
  onToggleExpand: (id: string) => void;
  sections: { id: string; name: string }[];
  today: string;
  childTasks: TodoItemRow[];
  onAddChildTask?: (title: string) => void;
  onToggleChildTask?: (child: TodoItemRow) => void;
  attachments: ReturnType<typeof useTodoCardAttachments>['attachments'];
  uploadingFile: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (file: File) => void;
  handleDeleteAttachment: (att: TodoAttachmentRow) => void;
}

export default function TodoCardExpandedPanel({
  item, isEditing, editingTitle, onEditStart, onEditChange, onEditSave, onSetNotes, onSetDueDate,
  onSetPriority, onSetReminder, onSetTags, onMoveSection, onDrop, onToggleExpand, sections, today,
  childTasks, onAddChildTask, onToggleChildTask, attachments, uploadingFile, fileInputRef,
  handleFileUpload, handleDeleteAttachment
}: TodoCardExpandedPanelProps) {
  const [openPopover, setOpenPopover] = useState<'date' | 'reminder' | null>(null);
  const [tagInput, setTagInput] = useState('');

  return (
    <div onClick={e => e.stopPropagation()}>
    <Card className="mt-3 border border-border-custom bg-surface-solid/35 flex flex-col gap-4 shadow-md" padding="1rem">
      {/* Title & Description inputs */}
      <div className="flex flex-col gap-1.5">
        <NlpHighlightInput
          value={isEditing ? editingTitle : item.title}
          onChange={(val) => {
            if (!isEditing) onEditStart(val);
            else onEditChange(val);
          }}
          onBlur={onEditSave}
          onFocus={() => onEditStart(item.title)}
          placeholder="Nazwa zadania"
          className="w-full bg-transparent text-sm font-semibold text-text-primary outline-none placeholder:text-text-muted/40"
        />
        <ControlTextarea
          value={item.notes || ''}
          onChange={(e) => onSetNotes?.(e.target.value || null)}
          rows={2}
          placeholder="Opis"
          className="w-full resize-none bg-transparent text-sm font-medium text-text-secondary outline-none placeholder:text-text-muted/40"
        />
      </div>

      {/* Attachments inline tags list */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-1.5 rounded-lg border border-border-custom/50 bg-surface-solid/40 px-2 py-0.5 text-xs"
            >
              <Paperclip size={10} className="text-text-muted/50" />
              <a
                href={att.file_url}
                target="_blank"
                rel="noreferrer"
                className="max-w-[var(--ds-maxw-120px)] truncate text-primary hover:underline"
              >
                {att.file_name}
              </a>
              <Pressable
                onClick={() => handleDeleteAttachment(att)}
                className="text-text-muted/35 hover:text-danger transition-colors ml-0.5"
              >
                <X size={10} />
              </Pressable>
            </div>
          ))}
        </div>
      )}

      {/* Subtasks */}
      <TodoCardSubtasks
        childTasks={childTasks}
        onAddChildTask={onAddChildTask}
        onToggleChildTask={onToggleChildTask}
      />

      {/* Button chips row (Termin, Załącznik, Priorytet, Przypomnienia, Tagi) */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border-custom/20 pt-2.5">
        {/* Date button + popover */}
        <div className="relative">
          <Pressable
            type="button"
            onClick={() => setOpenPopover((p) => p === 'date' ? null : 'date')}
            className={`flex items-center gap-1.5 rounded-lg border border-border-custom/80 px-2.5 py-1 text-xs font-semibold text-text-secondary hover:bg-text-primary/[0.04] transition-all ${item.due_date ? 'text-primary border-primary/30 bg-primary/5' : ''}`}
          >
            <Calendar size={12} className={item.due_date ? 'text-primary' : 'text-text-muted/60'} />
            <span>{item.due_date ? `${item.due_date}${item.scheduled_time ? ` ${item.scheduled_time.slice(11, 16)}` : ''}` : 'Termin'}</span>
          </Pressable>
          {openPopover === 'date' && (
            <TodoDatePickerPopover
              dueDate={item.due_date || null}
              scheduledTime={item.scheduled_time ? item.scheduled_time.slice(11, 16) : null}
              recurrence={null}
              today={today}
              onChange={(patch) => {
                if (patch.due_date !== undefined) onSetDueDate(patch.due_date);
                if (patch.scheduled_time !== undefined) {
                  // DatePicker can set scheduled time, we pass it up via parent
                }
              }}
              onClose={() => setOpenPopover(null)}
            />
          )}
        </div>

        {/* Attachment button */}
        <div className="relative">
          <ControlInput
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              e.target.value = '';
            }}
          />
          <Pressable
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFile}
            className="flex items-center gap-1.5 rounded-lg border border-border-custom/80 px-2.5 py-1 text-xs font-semibold text-text-secondary hover:bg-text-primary/[0.04] transition-all disabled:opacity-[var(--opacity-40)]"
          >
            <Paperclip size={12} className="text-text-muted/60" />
            <span>{uploadingFile ? 'Wysyłanie…' : 'Załącznik'}</span>
          </Pressable>
        </div>

        {/* Priority Selector button */}
        <div className="relative">
          <ControlSelect
            value={item.priority || 'normal'}
            onChange={(e) => onSetPriority(e.target.value)}
            className="absolute inset-0 opacity-[var(--opacity-0)] cursor-pointer w-full h-full z-[var(--z-raised)]"
          >
            <option value="urgent">🚩 Priorytet 1 (P1)</option>
            <option value="high">🚩 Priorytet 2 (P2)</option>
            <option value="normal">🚩 Priorytet 3 (P3)</option>
            <option value="low">🚩 Priorytet 4 (P4)</option>
          </ControlSelect>
          <Pressable
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-border-custom/80 px-2.5 py-1 text-xs font-semibold text-text-secondary hover:bg-text-primary/[0.04] transition-all"
          >
            <Flag size={12} className={item.priority === 'urgent' ? 'text-danger' : item.priority === 'high' ? 'text-warning' : item.priority === 'normal' ? 'text-info' : 'text-text-muted/60'} />
            <span>
              {item.priority === 'urgent' ? 'P1' : item.priority === 'high' ? 'P2' : item.priority === 'normal' ? 'P3' : 'P4'}
            </span>
          </Pressable>
        </div>

        {/* Reminder button + popover */}
        <div className="relative">
          <Pressable
            type="button"
            onClick={() => setOpenPopover((p) => p === 'reminder' ? null : 'reminder')}
            className={`flex items-center gap-1.5 rounded-lg border border-border-custom/80 px-2.5 py-1 text-xs font-semibold text-text-secondary hover:bg-text-primary/[0.04] transition-all ${item.reminder_at ? 'text-primary border-primary/30 bg-primary/5' : ''}`}
          >
            <Bell size={12} className={item.reminder_at ? 'text-primary' : 'text-text-muted/60'} />
            <span>
              {item.reminder_at
                ? new Date(item.reminder_at).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                : 'Przypomnienia'}
            </span>
          </Pressable>
          {openPopover === 'reminder' && (
            <TodoReminderPopover
              dueDate={item.due_date || null}
              scheduledTime={item.scheduled_time ? item.scheduled_time.slice(11, 16) : null}
              onSetReminder={(iso) => onSetReminder(iso)}
              onClose={() => setOpenPopover(null)}
            />
          )}
        </div>

        {/* Tags input chip */}
        <div className="flex items-center gap-1 border border-border-custom/80 rounded-lg px-2 py-0.5 max-w-[var(--ds-maxw-150px)]">
          <Tag size={11} className="text-text-muted/60" />
          <ControlInput
            value={tagInput}
            placeholder="Tagi"
            onChange={e => setTagInput(e.target.value.toLowerCase().replace(/[\s#]/g, '_'))}
            onKeyDown={e => {
              if (e.key === 'Enter' && tagInput.trim()) {
                const t = tagInput.trim();
                if (!(item.tags || []).includes(t)) onSetTags([...(item.tags || []), t]);
                setTagInput('');
              }
            }}
            className="bg-transparent text-xs font-semibold text-text-secondary outline-none w-full placeholder:text-text-muted/30"
          />
        </div>

        {/* Tag tags list */}
        {(item.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(item.tags || []).map((tag: string) => (
              <span key={tag} className="flex items-center gap-1 rounded-full border border-border-custom/50 bg-surface-solid/60 px-2 py-0.5 text-2xs font-medium text-text-secondary">
                #{tag}
                <Pressable
                  onClick={() => onSetTags((item.tags || []).filter((t: string) => t !== tag))}
                  className="text-text-muted/40 hover:text-danger transition-colors ml-0.5"
                >
                  <X size={9} />
                </Pressable>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="flex items-center justify-between border-t border-border-custom/80 pt-3 mt-1.5">
        {/* Left: Section Selector Dropdown */}
        <div className="relative flex items-center">
          <ControlSelect
            value={item.section_id || ''}
            onChange={(e) => onMoveSection(e.target.value || null)}
            className="absolute inset-0 opacity-[var(--opacity-0)] cursor-pointer w-full h-full z-[var(--z-raised)]"
          >
            <option value="">Skrzynka</option>
            {sections.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </ControlSelect>
          <Pressable
            type="button"
            className="flex items-center gap-1 px-2.5 py-1 text-sm font-semibold text-text-secondary hover:text-text-primary hover:bg-text-primary/[0.04] rounded-lg transition-all"
          >
            <Folder size={13} className="text-text-muted/60" />
            <span>
              {sections.find(s => s.id === item.section_id)?.name || 'Skrzynka'}
            </span>
            <ChevronDown size={11} className="text-text-muted/60" />
          </Pressable>
        </div>

        {/* Right: Actions */}
        <div className="flex gap-2">
          <Pressable
            type="button"
            onClick={onDrop}
            className="rounded-xl border border-danger/15 bg-danger/5 px-3 py-1.5 text-xs font-black text-danger hover:bg-danger/10 transition-colors btn-press"
          >
            Odpuść zadanie
          </Pressable>
          <Pressable
            variant="primary"
            size="sm"
            onClick={() => onToggleExpand(item.id)}
          >
            Zamknij
          </Pressable>
        </div>
      </div>
    </Card>
    </div>
  );
}
