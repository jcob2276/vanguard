import React, { useState } from 'react';
import { Paperclip, X, Calendar, Flag, Bell, Tag, Folder, ChevronDown } from 'lucide-react';
import NlpHighlightInput from './NlpHighlightInput';
import TodoDatePickerPopover from './TodoDatePickerPopover';
import TodoReminderPopover from './TodoReminderPopover';
import TodoCardSubtasks from './TodoCardSubtasks';
import type { useTodoCardAttachments } from './useTodoCardAttachments';

interface TodoCardExpandedPanelProps {
  item: any;
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
  sections: any[];
  today: string;
  childTasks: any[];
  onAddChildTask?: (title: string) => void;
  onToggleChildTask?: (child: any) => void;
  attachments: ReturnType<typeof useTodoCardAttachments>['attachments'];
  uploadingFile: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (file: File) => void;
  handleDeleteAttachment: (att: any) => void;
}

export default function TodoCardExpandedPanel({
  item,
  isEditing,
  editingTitle,
  onEditStart,
  onEditChange,
  onEditSave,
  onSetNotes,
  onSetDueDate,
  onSetPriority,
  onSetReminder,
  onSetTags,
  onMoveSection,
  onDrop,
  onToggleExpand,
  sections,
  today,
  childTasks,
  onAddChildTask,
  onToggleChildTask,
  attachments,
  uploadingFile,
  fileInputRef,
  handleFileUpload,
  handleDeleteAttachment,
}: TodoCardExpandedPanelProps) {
  const [openPopover, setOpenPopover] = useState<'date' | 'reminder' | null>(null);
  const [tagInput, setTagInput] = useState('');

  return (
    <div className="mt-3 border border-border-custom bg-surface-solid/35 rounded-2xl p-4 flex flex-col gap-4 shadow-md" onClick={e => e.stopPropagation()}>
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
          className="w-full bg-transparent text-[13px] font-semibold text-text-primary outline-none placeholder:text-text-muted/40"
        />
        <textarea
          value={item.notes || ''}
          onChange={(e) => onSetNotes?.(e.target.value || null)}
          rows={2}
          placeholder="Opis"
          className="w-full resize-none bg-transparent text-[12px] font-medium text-text-secondary outline-none placeholder:text-text-muted/40"
        />
      </div>

      {/* Attachments inline tags list */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-1.5 rounded-lg border border-border-custom/50 bg-surface-solid/40 px-2 py-0.5 text-[10px]"
            >
              <Paperclip size={10} className="text-text-muted/50" />
              <a
                href={att.file_url}
                target="_blank"
                rel="noreferrer"
                className="max-w-[120px] truncate text-primary hover:underline"
              >
                {att.file_name}
              </a>
              <button
                onClick={() => handleDeleteAttachment(att)}
                className="text-text-muted/35 hover:text-rose-400 transition-colors ml-0.5"
              >
                <X size={10} />
              </button>
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
          <button
            type="button"
            onClick={() => setOpenPopover((p) => p === 'date' ? null : 'date')}
            className={`flex items-center gap-1.5 rounded-lg border border-border-custom/80 px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:bg-text-primary/[0.04] transition-all ${item.due_date ? 'text-primary border-primary/30 bg-primary/5' : ''}`}
          >
            <Calendar size={12} className={item.due_date ? 'text-primary' : 'text-text-muted/60'} />
            <span>{item.due_date ? `${item.due_date}${item.scheduled_time ? ` ${item.scheduled_time.slice(11, 16)}` : ''}` : 'Termin'}</span>
          </button>
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
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFile}
            className="flex items-center gap-1.5 rounded-lg border border-border-custom/80 px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:bg-text-primary/[0.04] transition-all disabled:opacity-40"
          >
            <Paperclip size={12} className="text-text-muted/60" />
            <span>{uploadingFile ? 'Wysyłanie…' : 'Załącznik'}</span>
          </button>
        </div>

        {/* Priority Selector button */}
        <div className="relative">
          <select
            value={item.priority || 'normal'}
            onChange={(e) => onSetPriority(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
          >
            <option value="urgent">🚩 Priorytet 1 (P1)</option>
            <option value="high">🚩 Priorytet 2 (P2)</option>
            <option value="normal">🚩 Priorytet 3 (P3)</option>
            <option value="low">🚩 Priorytet 4 (P4)</option>
          </select>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-border-custom/80 px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:bg-text-primary/[0.04] transition-all"
          >
            <Flag size={12} className={item.priority === 'urgent' ? 'text-rose-500' : item.priority === 'high' ? 'text-amber-500' : item.priority === 'normal' ? 'text-sky-500' : 'text-text-muted/60'} />
            <span>
              {item.priority === 'urgent' ? 'P1' : item.priority === 'high' ? 'P2' : item.priority === 'normal' ? 'P3' : 'P4'}
            </span>
          </button>
        </div>

        {/* Reminder button + popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenPopover((p) => p === 'reminder' ? null : 'reminder')}
            className={`flex items-center gap-1.5 rounded-lg border border-border-custom/80 px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:bg-text-primary/[0.04] transition-all ${item.reminder_at ? 'text-primary border-primary/30 bg-primary/5' : ''}`}
          >
            <Bell size={12} className={item.reminder_at ? 'text-primary' : 'text-text-muted/60'} />
            <span>
              {item.reminder_at
                ? new Date(item.reminder_at).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                : 'Przypomnienia'}
            </span>
          </button>
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
        <div className="flex items-center gap-1 border border-border-custom/80 rounded-lg px-2 py-0.5 max-w-[150px]">
          <Tag size={11} className="text-text-muted/60" />
          <input
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
            className="bg-transparent text-[11px] font-semibold text-text-secondary outline-none w-full placeholder:text-text-muted/30"
          />
        </div>

        {/* Tag tags list */}
        {(item.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(item.tags || []).map((tag: string) => (
              <span key={tag} className="flex items-center gap-1 rounded-full border border-border-custom/50 bg-surface-solid/60 px-2 py-0.5 text-[9.5px] font-medium text-text-secondary">
                #{tag}
                <button
                  onClick={() => onSetTags((item.tags || []).filter((t: string) => t !== tag))}
                  className="text-text-muted/40 hover:text-rose-400 transition-colors ml-0.5"
                >
                  <X size={9} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="flex items-center justify-between border-t border-border-custom/80 pt-3 mt-1.5">
        {/* Left: Section Selector Dropdown */}
        <div className="relative flex items-center">
          <select
            value={item.section_id || ''}
            onChange={(e) => onMoveSection(e.target.value || null)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
          >
            <option value="">Skrzynka</option>
            {sections.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="flex items-center gap-1 px-2.5 py-1 text-[12px] font-semibold text-text-secondary hover:text-text-primary hover:bg-text-primary/[0.04] rounded-lg transition-all"
          >
            <Folder size={13} className="text-text-muted/60" />
            <span>
              {sections.find(s => s.id === item.section_id)?.name || 'Skrzynka'}
            </span>
            <ChevronDown size={11} className="text-text-muted/60" />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDrop}
            className="rounded-xl border border-rose-500/15 bg-rose-500/5 px-3 py-1.5 text-[11px] font-black text-rose-400 hover:bg-rose-500/10 transition-colors btn-press"
          >
            Odpuść zadanie
          </button>
          <button
            type="button"
            onClick={() => onToggleExpand(item.id)}
            className="todoist-btn-primary"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}
