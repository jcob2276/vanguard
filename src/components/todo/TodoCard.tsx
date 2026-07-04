import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Bell, BellOff, Check, Repeat2, Link2, Pencil, X, Trash2, GripVertical, Clock, Sparkles, ListTree, Paperclip, Upload } from 'lucide-react';
import {
  GOAL_ICON,
  PRIORITY,
  PRIORITY_ORDER,
  splitEmoji,
  relativeDate,
  parseSubtasks,
  RECURRENCE_LABELS
} from './todoUtils';
import { listAttachments, uploadAttachment, deleteAttachment } from '../../lib/todo';
import { LIFE_SPHERES } from '../../lib/lifeSpheres';

export interface TodoCardProps {
  item: any;
  onToggle: () => void;
  onDrop: () => void;
  onSetPriority: (p: string) => void;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
  onToggleSubtask: (index: number) => void;
  onAddSubtask: (text: string) => void;
  onDeleteSubtask: (index: number) => void;
  busy: boolean;
  today: string;
  isLinkedToPlan: boolean;
  sections: any[];
  onMoveSection: (sId: string | null) => void;
  isEditing: boolean;
  editingTitle: string;
  onEditStart: (t: string) => void;
  onEditChange: (val: string) => void;
  onEditSave: () => void;
  sectionName?: string | null;
  sectionGoalKey?: string | null;
  onDragStart?: (item: any, clientX: number, clientY: number) => void;
  isDragging: boolean;
  onShowContextMenu: (item: any, clientX: number, clientY: number) => void;
  onMoveToToday?: () => void;
  onSetDueDate: (date: string | null) => void;
  onSetRecurrence: (r: string | null) => void;
  dreamTitle?: string | null;
  onSetReminder: (isoDatetime: string) => void;
  onCancelReminder: () => void;
  onSetTags: (tags: string[]) => void;
  onSetSphere?: (sphere: string | null) => void;
  onAiBreakdown: () => Promise<string[]>;
  onSetTitle: (title: string) => void;
  childTasks?: any[];
  onAddChildTask?: (title: string) => void;
  onToggleChildTask?: (child: any) => void;
}

export default function TodoCard({
  item,
  onToggle,
  onDrop,
  onSetPriority,
  expanded,
  onToggleExpand,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
  busy,
  today,
  isLinkedToPlan,
  sections,
  onMoveSection,
  isEditing,
  editingTitle,
  onEditStart,
  onEditChange,
  onEditSave,
  sectionName,
  sectionGoalKey,
  onDragStart,
  isDragging,
  onShowContextMenu,
  onMoveToToday,
  onSetDueDate,
  onSetRecurrence,
  dreamTitle,
  onSetReminder,
  onCancelReminder,
  onSetTags,
  onSetSphere,
  onAiBreakdown,
  onSetTitle,
  childTasks = [],
  onAddChildTask,
  onToggleChildTask,
}: TodoCardProps) {
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null);
  const [newSubtask, setNewSubtask] = useState('');
  const [newChildTask, setNewChildTask] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attachmentsLoaded, setAttachmentsLoaded] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [completing, setCompleting] = useState(false);
  const [completingOut, setCompletingOut] = useState(false);
  const [expandMounted, setExpandMounted] = useState(false);
  const longPressTimer = useRef<any>(null);
  const gripLongPressTimer = useRef<any>(null);
  const prevSwipeRef = useRef(0);

  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (expanded) {
      setExpandMounted(true);
      setShowAdvanced(!!item.recurrence || !!item.reminder_at);
    } else {
      const t = setTimeout(() => setExpandMounted(false), 280);
      return () => clearTimeout(t);
    }
  }, [expanded, item.recurrence, item.reminder_at]);

  // Lazy-load attachments only once, the first time the card is expanded.
  useEffect(() => {
    if (!expanded || attachmentsLoaded) return;
    listAttachments(item.id).then((rows) => {
      setAttachments(rows);
      setAttachmentsLoaded(true);
    }).catch(() => setAttachmentsLoaded(true));
  }, [expanded, item.id, attachmentsLoaded]);

  const handleFileUpload = async (file: File) => {
    setUploadingFile(true);
    try {
      const created = await uploadAttachment(item.user_id, item.id, file);
      setAttachments((prev) => [...prev, created]);
    } catch (e) {
      console.error('Attachment upload failed', e);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteAttachment = async (att: any) => {
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    try { await deleteAttachment(att); } catch (e) { console.error('Attachment delete failed', e); }
  };

  const [reminderInput, setReminderInput] = useState('');

  const { description, subtasks } = useMemo(() => parseSubtasks(item.notes), [item.notes]);
  const doneCount = subtasks.filter(s => s.checked).length;
  // Progress must count both subtask stores (checklist-in-notes and real parent_task_id
  // children) — a card can have either or both, and counting only one undercounts.
  const totalSubtaskCount = subtasks.length + childTasks.length;
  const doneSubtaskCount = doneCount + childTasks.filter((c) => c.status === 'done').length;
  const p = PRIORITY[item.priority] ?? PRIORITY.normal;
  const isDone = item.status === 'done';

  const leftBorder = sectionGoalKey === 'cialo'
    ? 'border-l-[3px] border-l-emerald-500/70'
    : sectionGoalKey === 'duch'
    ? 'border-l-[3px] border-l-violet-500/70'
    : sectionGoalKey === 'konto'
    ? 'border-l-[3px] border-l-amber-500/70'
    : item.priority === 'urgent'
    ? 'border-l-[3px] border-l-rose-500/60'
    : item.priority === 'high'
    ? 'border-l-[3px] border-l-orange-400/50'
    : 'border-l-[3px] border-l-border-custom/10';
  const { icon, label } = splitEmoji(item.title);
  const dateInfo = relativeDate(item.due_date, today);
  const tomorrowStr = useMemo(() => {
    if (!today) return '';
    const [y, m, d] = today.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  }, [today]);

  // ── Touch swipe (card body) ──
  const onTouchStart = (e: React.TouchEvent) => {
    if (isDragging) return;
    const t = e.targetTouches[0];
    setTouchStartX(t.clientX);
    setTouchStartY(t.clientY);
    // Long press on card body → context menu
    longPressTimer.current = setTimeout(() => {
      onShowContextMenu(item, t.clientX, t.clientY);
    }, 600);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    clearTimeout(longPressTimer.current);
    if (isDragging) return;
    const dx = e.targetTouches[0].clientX - touchStartX;
    const dy = Math.abs(e.targetTouches[0].clientY - touchStartY);
    if (dy > 12) return;
    const newOffset = Math.max(-130, Math.min(130, dx));
    prevSwipeRef.current = newOffset;
    setSwipeOffset(newOffset);
    setSwipeDir(dx > 40 ? 'right' : dx < -40 ? 'left' : null);
  };

  const onTouchEnd = () => {
    clearTimeout(longPressTimer.current);
    prevSwipeRef.current = 0;
    if (!isDragging) {
      if (swipeOffset > 100) {
        setSwipeOffset(500);
        handleComplete();
        return;
      } else if (swipeOffset < -100) {
        setSwipeOffset(-500);
        setTimeout(() => {
          onDrop();
          setSwipeOffset(0);
          setSwipeDir(null);
        }, 150);
        return;
      }
    }
    setSwipeOffset(0);
    setSwipeDir(null);
  };

  const handleComplete = () => {
    if (isDone) {
      onToggle();
      setSwipeOffset(0);
      setSwipeDir(null);
      return;
    }
    setCompleting(true);
    setTimeout(() => setCompletingOut(true), 130);
    setTimeout(() => {
      onToggle();
      setCompleting(false);
      setCompletingOut(false);
      setSwipeOffset(0);
      setSwipeDir(null);
    }, 420);
  };

  // ── Grip: long press (mobile) / mousedown (desktop) ──
  const onGripTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    const t = e.touches[0];
    gripLongPressTimer.current = setTimeout(() => {
      onDragStart?.(item, t.clientX, t.clientY);
    }, 350);
  };

  const onGripTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    clearTimeout(gripLongPressTimer.current);
  };

  const onGripTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    clearTimeout(gripLongPressTimer.current);
  };

  const onGripMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    onDragStart?.(item, e.clientX, e.clientY);
  };

  return (
    <div
      className={`group relative ${isDone ? 'opacity-40' : ''} ${isDragging ? 'opacity-0 pointer-events-none' : ''}`}
      style={
        completingOut
          ? {
              transform: 'translateX(28px)',
              opacity: 0,
              pointerEvents: 'none',
              transition: 'transform 0.28s cubic-bezier(0.4,0,1,1), opacity 0.22s ease-out'
            }
          : { transition: 'opacity 0.15s' }
      }
    >
      {/* Swipe hint overlays */}
      <div
        className={`absolute inset-0 flex items-center justify-start pl-3 text-emerald-500 pointer-events-none transition-opacity duration-150 ${
          swipeDir === 'right' ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <Check size={15} strokeWidth={3} />
      </div>
      <div
        className={`absolute inset-0 flex items-center justify-end pr-3 text-rose-400 pointer-events-none transition-opacity duration-150 ${
          swipeDir === 'left' ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <X size={15} />
      </div>

      {/* Row */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onContextMenu={e => {
          e.preventDefault();
          onShowContextMenu(item, e.clientX, e.clientY);
        }}
        style={{ transform: `translateX(${swipeOffset}px)` }}
        onClick={e => e.stopPropagation()}
        className={`relative border-b border-border-custom/10 pr-2 py-3.5 pl-3 transition-colors duration-150 ease-out hover:bg-surface-solid/20 ${leftBorder}`}
      >
        <div className="flex items-start gap-3.5">
          {/* Drag grip */}
          <div
            onTouchStart={onGripTouchStart}
            onTouchEnd={onGripTouchEnd}
            onTouchMove={onGripTouchMove}
            onMouseDown={onGripMouseDown}
            className="mt-0.5 shrink-0 touch-none cursor-grab text-transparent group-hover:text-text-muted/15 transition-colors select-none"
          >
            <GripVertical size={13} />
          </div>

          {/* Emoji icon OR priority circle checkbox */}
          {icon ? (
            <button
              onClick={e => {
                e.stopPropagation();
                handleComplete();
              }}
              disabled={busy}
              className="shrink-0 mt-0.5 btn-press"
            >
              <span
                className={`flex h-[20px] w-[20px] items-center justify-center text-[15px] leading-none transition-all ${
                  isDone ? 'grayscale opacity-40' : ''
                }`}
              >
                {icon}
              </span>
            </button>
          ) : (
            <button
              onClick={e => {
                e.stopPropagation();
                handleComplete();
              }}
              disabled={busy}
              className="mt-0.5 shrink-0 btn-press"
            >
              <div
                className={`h-[15px] w-[15px] rounded-full border-[1.5px] flex items-center justify-center transition-all duration-200 ${
                  completing || isDone
                    ? `bg-emerald-500 border-transparent todo-checkbox-pop ${completing && !completingOut ? 'scale-[1.35]' : 'scale-100'}`
                    : `${p.ring} bg-transparent`
                }`}
              >
                {(completing || isDone) && <Check size={7} className="text-white" strokeWidth={3} />}
              </div>
            </button>
          )}

          {/* Content */}
          <div
            className="min-w-0 flex-1 cursor-pointer"
            onClick={(e) => {
              if (expanded) {
                e.stopPropagation();
                if (!isEditing) onEditStart(item.title);
              } else {
                onToggleExpand(item.id);
              }
            }}
          >
            {isEditing ? (
              <input
                autoFocus
                value={editingTitle}
                onChange={e => onEditChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === 'Escape') onEditSave();
                }}
                onBlur={onEditSave}
                onClick={e => e.stopPropagation()}
                className="w-full rounded-xl border border-primary/30 bg-surface-solid px-3 py-1.5 text-[14px] font-semibold text-text-primary outline-none ring-2 ring-primary/15"
              />
            ) : (
              <div className="group/title flex items-center gap-1.5">
                <p
                  className={`text-[14px] font-semibold leading-snug transition-colors ${
                    isDone ? 'line-through text-text-muted/50' : 'text-text-primary'
                  }`}
                >
                  {label}
                </p>
                {expanded && (
                  <Pencil size={10} className="text-text-muted opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0" />
                )}
              </div>
            )}

            {/* Metadata */}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {dateInfo && !isDone && <span className={`text-[10px] font-medium ${dateInfo.color}`}>{dateInfo.text}</span>}
              {item.recurrence && (
                <span className="flex items-center gap-0.5 text-[10px] text-primary/40">
                  <Repeat2 size={8} /> {RECURRENCE_LABELS[item.recurrence]}
                </span>
              )}
              {totalSubtaskCount > 0 && (
                <div className="todo-progress-container" title={`${doneSubtaskCount}/${totalSubtaskCount} podzadań`}>
                  <div className="todo-progress-track">
                    <div
                      className={`todo-progress-bar ${
                        sectionGoalKey === 'cialo'
                          ? 'bg-emerald-500'
                          : sectionGoalKey === 'duch'
                          ? 'bg-indigo-500'
                          : sectionGoalKey === 'konto'
                          ? 'bg-amber-500'
                          : 'bg-primary'
                      }`}
                      style={{ width: `${(doneSubtaskCount / totalSubtaskCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-text-muted/45 font-medium">{doneSubtaskCount}/{totalSubtaskCount}</span>
                </div>
              )}
              {item.duration_minutes != null && item.duration_minutes > 0 && !isDone && (
                <span className="flex items-center gap-0.5 text-[10px] text-text-muted/40 font-medium">
                  <Clock size={8} />
                  {item.duration_minutes >= 60
                    ? `${Math.floor(item.duration_minutes / 60)}h${item.duration_minutes % 60 > 0 ? ` ${item.duration_minutes % 60}m` : ''}`
                    : `${item.duration_minutes}m`}
                </span>
              )}
              {(item.tags || []).map((tag: string) => (
                <span key={tag} className="inline-flex items-center rounded-full bg-surface-solid border border-border-custom/30 px-1.5 py-px text-[9px] font-medium text-text-muted/55">
                  {tag}
                </span>
              ))}
              {isLinkedToPlan && (
                <span className="flex items-center gap-0.5 text-[10px] text-primary/50">
                  <Link2 size={7} /> Plan
                </span>
              )}
              {sectionName &&
                (() => {
                  const GoalIcon = sectionGoalKey ? GOAL_ICON[sectionGoalKey] : null;
                  const chipBg = sectionGoalKey === 'cialo'
                    ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : sectionGoalKey === 'duch'
                    ? 'bg-indigo-500/8 border-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                    : sectionGoalKey === 'konto'
                    ? 'bg-amber-500/8 border-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'bg-surface-solid border-border-custom/50 text-text-secondary';
                  return (
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wide transition-all ${chipBg}`}>
                      {GoalIcon && <GoalIcon size={8} />}
                      <span className="uppercase">{sectionName}</span>
                      {dreamTitle && (
                        <span className="opacity-60 truncate max-w-[80px]">· {dreamTitle}</span>
                      )}
                    </span>
                  );
                })()}
            </div>
          </div>

          {/* Quick "→ Dziś" action */}
          {onMoveToToday && !isDone && (
            <button
              onClick={e => {
                e.stopPropagation();
                onMoveToToday();
              }}
              className="shrink-0 text-[11px] font-medium text-text-muted/30 hover:text-orange-500 transition-colors btn-press"
              title="Przesuń na dziś"
            >
              →
            </button>
          )}
        </div>

        {/* Expanded */}
        <div
          style={{
            display: 'grid',
            gridTemplateRows: expanded ? '1fr' : '0fr',
            transition: 'grid-template-rows 260ms cubic-bezier(0.4,0,0.2,1)'
          }}
        >
          <div style={{ overflow: 'hidden' }}>
            {expandMounted && (
              <div className="mt-3 space-y-3 border-t border-border-custom/10 pt-3" onClick={e => e.stopPropagation()}>
                {description && (
                  <p className="rounded-xl border border-border-custom/40 bg-surface-solid/50 px-3 py-2.5 text-[11px] leading-relaxed text-text-secondary whitespace-pre-wrap">
                    {description}
                  </p>
                )}

                {/* Termin (Due date) - Default Visible */}
                <div>
                  <p className="mb-1 text-[11px] font-semibold text-text-muted">Termin</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSetDueDate(today)}
                      className={`rounded-xl px-2.5 py-1.5 text-[11px] font-semibold border transition-all btn-press ${
                        item.due_date === today
                          ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20'
                          : 'border-border-custom/50 text-text-muted hover:text-text-primary hover:bg-surface-solid/40'
                      }`}
                    >
                      Dziś
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetDueDate(tomorrowStr)}
                      className={`rounded-xl px-2.5 py-1.5 text-[11px] font-semibold border transition-all btn-press ${
                        item.due_date === tomorrowStr
                          ? 'bg-sky-500/15 text-sky-500 border-sky-500/20'
                          : 'border-border-custom/50 text-text-muted hover:text-text-primary hover:bg-surface-solid/40'
                      }`}
                    >
                      Jutro
                    </button>
                    <input
                      type="date"
                      value={item.due_date || ''}
                      onChange={e => onSetDueDate(e.target.value || null)}
                      className="flex-1 min-w-[120px] rounded-xl border border-border-custom/50 bg-surface-solid/40 px-3 py-1.5 text-[12px] text-text-primary outline-none focus:border-primary/30 [color-scheme:light] dark:[color-scheme:dark]"
                    />
                    {item.due_date && (
                      <button
                        onClick={() => onSetDueDate(null)}
                        className="shrink-0 flex items-center gap-1 rounded-xl border border-border-custom/50 px-3 py-1.5 text-[11px] font-semibold text-text-muted hover:text-rose-400 transition-colors btn-press"
                      >
                        <X size={10} /> Usuń
                      </button>
                    )}
                  </div>
                </div>

                {/* Subtasks (Podzadania) - Default Visible */}
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold text-text-muted">Podzadania</p>
                  <div className="space-y-1">
                    {subtasks.map((st, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2.5 rounded-xl border border-border-custom/30 bg-surface-solid/40 px-3 py-2"
                      >
                        <button onClick={() => onToggleSubtask(idx)} className="shrink-0 btn-press">
                          <div
                            className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
                              st.checked ? 'bg-emerald-500 border-emerald-500 todo-checkbox-pop' : 'border-border-custom'
                            }`}
                          >
                            {st.checked && <Check size={8} className="text-white" strokeWidth={3} />}
                          </div>
                        </button>
                        <span
                          className={`min-w-0 flex-1 text-[11px] font-medium truncate ${
                            st.checked ? 'line-through text-text-muted' : 'text-text-primary'
                          }`}
                        >
                          {st.text}
                        </span>
                        <button
                          onClick={() => onDeleteSubtask(idx)}
                          className="shrink-0 text-text-muted/30 hover:text-rose-400 transition-colors btn-press"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                    {subtasks.length === 0 && (
                      <button
                        onClick={async () => {
                          setAiLoading(true);
                          try {
                            const steps = await onAiBreakdown();
                            for (const s of steps) onAddSubtask(s);
                          } finally {
                            setAiLoading(false);
                          }
                        }}
                        disabled={aiLoading}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 py-2 text-[11px] font-semibold text-primary/70 hover:bg-primary/10 hover:text-primary transition-all btn-press disabled:opacity-40"
                      >
                        {aiLoading
                          ? <span className="animate-pulse">Rozbijam…</span>
                          : <><Sparkles size={11} /> Rozbij z AI</>
                        }
                      </button>
                    )}
                    <div className="flex gap-2 pt-0.5">
                      <input
                        placeholder="Nowe podzadanie..."
                        value={newSubtask}
                        onChange={e => setNewSubtask(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newSubtask.trim()) {
                            onAddSubtask(newSubtask);
                            setNewSubtask('');
                          }
                        }}
                        className="min-w-0 flex-1 rounded-xl border border-border-custom/50 bg-surface-solid/40 px-3 py-2 text-[11px] font-medium text-text-primary outline-none placeholder:text-text-muted/35 focus:border-primary/30"
                      />
                      <button
                        onClick={() => {
                          if (newSubtask.trim()) {
                            onAddSubtask(newSubtask);
                            setNewSubtask('');
                          }
                        }}
                        disabled={!newSubtask.trim()}
                        className="rounded-xl bg-primary/90 px-3 py-2 text-[9px] font-black text-white disabled:opacity-30 hover:bg-primary transition-colors btn-press"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Nested subtasks — real todo_items (own priority/due date/reminders), not a checklist line */}
                {onAddChildTask && (
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold text-text-muted flex items-center gap-1.5">
                      <ListTree size={11} /> Podzadania (pełne)
                    </p>
                    <div className="space-y-1">
                      {childTasks.map((child) => (
                        <div
                          key={child.id}
                          className="flex items-center gap-2.5 rounded-xl border border-border-custom/30 bg-surface-solid/40 px-3 py-2"
                        >
                          <button onClick={() => onToggleChildTask?.(child)} className="shrink-0 btn-press">
                            <div
                              className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
                                child.status === 'done' ? 'bg-emerald-500 border-emerald-500 todo-checkbox-pop' : 'border-border-custom'
                              }`}
                            >
                              {child.status === 'done' && <Check size={8} className="text-white" strokeWidth={3} />}
                            </div>
                          </button>
                          <span
                            className={`min-w-0 flex-1 text-[11px] font-medium truncate ${
                              child.status === 'done' ? 'line-through text-text-muted' : 'text-text-primary'
                            }`}
                          >
                            {child.title}
                          </span>
                        </div>
                      ))}
                      <div className="flex gap-2 pt-0.5">
                        <input
                          placeholder="Nowe pełne podzadanie…"
                          value={newChildTask}
                          onChange={e => setNewChildTask(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && newChildTask.trim()) {
                              onAddChildTask(newChildTask);
                              setNewChildTask('');
                            }
                          }}
                          className="min-w-0 flex-1 rounded-xl border border-border-custom/50 bg-surface-solid/40 px-3 py-2 text-[11px] font-medium text-text-primary outline-none placeholder:text-text-muted/35 focus:border-primary/30"
                        />
                        <button
                          onClick={() => {
                            if (newChildTask.trim()) {
                              onAddChildTask(newChildTask);
                              setNewChildTask('');
                            }
                          }}
                          disabled={!newChildTask.trim()}
                          className="rounded-xl bg-primary/90 px-3 py-2 text-[9px] font-black text-white disabled:opacity-30 hover:bg-primary transition-colors btn-press"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* File attachments */}
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold text-text-muted flex items-center gap-1.5">
                    <Paperclip size={11} /> Załączniki
                  </p>
                  <div className="space-y-1">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-2.5 rounded-xl border border-border-custom/30 bg-surface-solid/40 px-3 py-2"
                      >
                        <Paperclip size={11} className="shrink-0 text-text-muted/50" />
                        <a
                          href={att.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 flex-1 text-[11px] font-medium text-primary truncate hover:underline"
                        >
                          {att.file_name}
                        </a>
                        <button
                          onClick={() => handleDeleteAttachment(att)}
                          className="shrink-0 text-text-muted/30 hover:text-rose-400 transition-colors btn-press"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
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
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-custom/60 py-2 text-[11px] font-semibold text-text-muted hover:text-primary hover:border-primary/40 transition-all disabled:opacity-40"
                    >
                      <Upload size={11} /> {uploadingFile ? 'Wysyłanie…' : 'Dodaj plik'}
                    </button>
                  </div>
                </div>

                {/* Collapsible advanced options toggle */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1.5 btn-press"
                  >
                    {showAdvanced ? '− Ukryj opcje zadania' : '＋ Pokaż opcje zadania (Priorytet, Sekcja, Powtarzanie...)'}
                  </button>
                </div>

                {/* Advanced options wrapper */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateRows: showAdvanced ? '1fr' : '0fr',
                    transition: 'grid-template-rows 260ms cubic-bezier(0.4,0,0.2,1)'
                  }}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-3 border-t border-border-custom/10 pt-2.5 mt-1.5 pb-1">
                      {/* Priority and Section picker row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Priority grid */}
                        <div>
                          <p className="mb-1 text-[11px] font-semibold text-text-muted">Priorytet</p>
                          <div className="flex items-center gap-1">
                            {['urgent', 'high', 'normal', 'low'].map(pid => {
                              const active = item.priority === pid;
                              const cfg = {
                                urgent: { label: 'P1', color: 'border-rose-500/20 text-rose-500 hover:bg-rose-500/10', activeColor: 'bg-rose-500 text-white border-transparent' },
                                high: { label: 'P2', color: 'border-violet-500/20 text-violet-500 hover:bg-violet-500/10', activeColor: 'bg-violet-500 text-white border-transparent' },
                                normal: { label: 'P3', color: 'border-sky-500/20 text-sky-500 hover:bg-sky-500/10', activeColor: 'bg-sky-500 text-white border-transparent' },
                                low: { label: 'P4', color: 'border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10', activeColor: 'bg-emerald-500 text-white border-transparent' }
                              }[pid as 'urgent' | 'high' | 'normal' | 'low'];
                              return (
                                <button
                                  key={pid}
                                  type="button"
                                  onClick={() => onSetPriority(pid)}
                                  className={`w-7.5 h-7.5 rounded-xl border text-[11px] font-black flex items-center justify-center transition-all btn-press ${
                                    active ? cfg.activeColor : `${cfg.color} bg-surface-solid/20`
                                  }`}
                                  title={PRIORITY[pid].label}
                                >
                                  {cfg.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Section picker */}
                        {sections.length > 0 && (
                          <div>
                            <p className="mb-1 text-[11px] font-semibold text-text-muted">Sekcja</p>
                            <select
                              value={item.section_id || ''}
                              onChange={e => onMoveSection(e.target.value || null)}
                              className="w-full rounded-xl border border-border-custom/50 bg-surface-solid/40 px-3 py-1.5 text-[11px] font-semibold text-text-secondary outline-none focus:border-primary/30 cursor-pointer"
                            >
                              <option value="">📥 Skrzynka (brak sekcji)</option>
                              {sections.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Recurrence and Reminder row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Recurrence */}
                        {onSetRecurrence && (
                          <div>
                            <p className="mb-1 text-[11px] font-semibold text-text-muted">Powtarzanie</p>
                            <div className="flex gap-1">
                              {(['', 'daily', 'weekly', 'monthly'] as const).map(r => (
                                <button
                                  key={r || 'none'}
                                  type="button"
                                  onClick={() => onSetRecurrence(r)}
                                  className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-medium transition-colors btn-press ${
                                    (item.recurrence || '') === r
                                      ? 'border-primary/20 bg-primary/10 text-primary'
                                      : 'border-border-custom/50 text-text-muted hover:text-text-primary'
                                  }`}
                                >
                                  {r === '' ? 'Nie' : r === 'daily' ? '↺ Dzień' : r === 'weekly' ? '↺ Tydzień' : '↺ Miesiąc'}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Reminder */}
                        {!isDone && (
                          <div>
                            <p className="mb-1 text-[11px] font-semibold text-text-muted">Przypomnienie</p>
                            {item.reminder_at && !item.reminder_sent ? (
                              <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-2.5 py-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Bell size={11} className="text-primary" />
                                  <span className="text-[11px] font-semibold text-primary">
                                    {new Date(item.reminder_at).toLocaleString('pl-PL', {
                                      timeZone: 'Europe/Warsaw',
                                      month: 'short', day: 'numeric',
                                      hour: '2-digit', minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                                <button
                                  onClick={onCancelReminder}
                                  className="flex items-center gap-1 text-[10px] font-semibold text-text-muted hover:text-rose-400 transition-colors btn-press"
                                >
                                  <BellOff size={10} /> Anuluj
                                </button>
                              </div>
                            ) : item.reminder_sent ? (
                              <p className="text-[11px] text-text-muted/50">✓ Wysłano</p>
                            ) : (
                              <div className="flex items-center gap-2">
                                <input
                                  type="datetime-local"
                                  value={reminderInput}
                                  onChange={e => setReminderInput(e.target.value)}
                                  className="flex-1 rounded-xl border border-border-custom/50 bg-surface-solid/40 px-2.5 py-1 text-[11px] text-text-primary outline-none focus:border-primary/30 [color-scheme:light] dark:[color-scheme:dark]"
                                />
                                <button
                                  onClick={() => {
                                    if (!reminderInput) return;
                                    onSetReminder(new Date(reminderInput).toISOString());
                                    setReminderInput('');
                                  }}
                                  disabled={!reminderInput}
                                  className="shrink-0 flex items-center gap-1 rounded-xl bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary disabled:opacity-30 hover:bg-primary/20 transition-colors btn-press"
                                >
                                  <Bell size={10} /> Ustaw
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Life sphere — weekly balance tracking (Praca/Ciało/Duch/Finanse/Relacje/Odpoczynek) */}
                      {onSetSphere && (
                        <div>
                          <p className="mb-1 text-[11px] font-semibold text-text-muted">Sfera życia</p>
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => onSetSphere(null)}
                              className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-medium transition-colors btn-press ${
                                !item.category
                                  ? 'border-primary/20 bg-primary/10 text-primary'
                                  : 'border-border-custom/50 text-text-muted hover:text-text-primary'
                              }`}
                            >
                              Brak
                            </button>
                            {LIFE_SPHERES.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => onSetSphere(s.id)}
                                className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-medium transition-colors btn-press ${
                                  item.category === s.id
                                    ? `${s.border} ${s.bgSoft} ${s.text}`
                                    : 'border-border-custom/50 text-text-muted hover:text-text-primary'
                                }`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-text-muted">Tagi</p>
                        {(item.tags || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {(item.tags || []).map((tag: string) => (
                              <span key={tag} className="flex items-center gap-1 rounded-full border border-border-custom/50 bg-surface-solid/60 px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                                #{tag}
                                <button
                                  onClick={() => onSetTags((item.tags || []).filter((t: string) => t !== tag))}
                                  className="text-text-muted/40 hover:text-rose-400 transition-colors ml-0.5 btn-press"
                                >
                                  <X size={9} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input
                            placeholder="Nowy tag..."
                            value={tagInput}
                            onChange={e => setTagInput(e.target.value.toLowerCase().replace(/[\s#]/g, '_'))}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && tagInput.trim()) {
                                const t = tagInput.trim();
                                if (!(item.tags || []).includes(t)) onSetTags([...(item.tags || []), t]);
                                setTagInput('');
                              }
                            }}
                            className="min-w-0 flex-1 rounded-xl border border-border-custom/50 bg-surface-solid/40 px-2.5 py-1.5 text-[11px] font-medium text-text-primary outline-none placeholder:text-text-muted/35 focus:border-primary/30"
                          />
                          <button
                            onClick={() => {
                              const t = tagInput.trim();
                              if (!t) return;
                              if (!(item.tags || []).includes(t)) onSetTags([...(item.tags || []), t]);
                              setTagInput('');
                            }}
                            disabled={!tagInput.trim()}
                            className="rounded-xl bg-primary/10 px-2.5 py-1.5 text-[9px] font-black text-primary disabled:opacity-30 hover:bg-primary/20 transition-colors btn-press"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Odpuść zadanie (Trash button) */}
                      <div className="pt-1">
                        <button
                          onClick={onDrop}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/15 bg-rose-500/5 py-2 text-[9px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500/10 transition-colors btn-press"
                        >
                          <Trash2 size={10} /> Odpuść zadanie
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
