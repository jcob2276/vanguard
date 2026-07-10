import { notify } from '../../lib/notify';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { shiftDateStr } from '../../lib/date';
import { Bell, BellOff, Check, Repeat2, Link2, Pencil, X, Trash2, GripVertical, Clock, Sparkles, Paperclip, Upload, Tag, Calendar, MessageSquare, MoreHorizontal, Folder, ChevronDown, Flag } from 'lucide-react';
import {
  GOAL_ICON,
  PRIORITY,
  PRIORITY_ORDER,
  splitEmoji,
  relativeDate,
  RECURRENCE_LABELS
} from './todoUtils';
import { listAttachments, uploadAttachment, deleteAttachment } from '../../lib/todo/todo';
import { LIFE_SPHERES } from '../../lib/projects/lifeSpheres';
import TodoDatePickerPopover from './TodoDatePickerPopover';
import TodoReminderPopover from './TodoReminderPopover';
import NlpHighlightInput from './NlpHighlightInput';

export interface TodoCardProps {
  item: any;
  onToggle: () => void;
  onDrop: () => void;
  onSetPriority: (p: string) => void;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
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
  onSetNotes?: (notes: string | null) => void;
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
  onSetNotes,
  childTasks = [],
  onAddChildTask,
  onToggleChildTask,
}: TodoCardProps) {
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null);
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
  const [openPopover, setOpenPopover] = useState<'date' | 'reminder' | null>(null);
  const longPressTimer = useRef<any>(null);
  const gripLongPressTimer = useRef<any>(null);
  const prevSwipeRef = useRef(0);

  const [transitionCompleted, setTransitionCompleted] = useState(false);

  useEffect(() => {
    if (expanded) {
      void (async () => { setExpandMounted(true); })();
      const t = setTimeout(() => setTransitionCompleted(true), 300);
      return () => clearTimeout(t);
    } else {
      void (async () => { setTransitionCompleted(false); })();
      const t = setTimeout(() => setExpandMounted(false), 280);
      return () => clearTimeout(t);
    }
  }, [expanded]);

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
    } catch (e: unknown) { notify('Nie udało się wgrać załącznika.', 'error'); console.warn('[TodoCard] Failed to upload attachment:', e); } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteAttachment = async (att: any) => {
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    try { await deleteAttachment(att); } catch (e: unknown) { notify('Nie udało się usunąć załącznika.', 'error'); console.warn('[TodoCard] Failed to delete attachment:', e); }
  };

  const [reminderInput, setReminderInput] = useState('');

  const description = (item.notes || '').trim();
  const totalSubtaskCount = childTasks.length;
  const doneSubtaskCount = childTasks.filter((c) => c.status === 'done').length;
  const p = PRIORITY[item.priority] ?? PRIORITY.normal;
  const isDone = item.status === 'done';

  const leftBorder = '';
  const { icon, label } = splitEmoji(item.title);
  const dateInfo = relativeDate(item.due_date, today);
  const tomorrowStr = useMemo(() => {
    if (!today) return '';
    return shiftDateStr(today, 1);
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

  const handleContentMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (isEditing) return;

    const startX = e.clientX;
    const startY = e.clientY;
    let dragStarted = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 5) {
        dragStarted = true;
        cleanup();
        onDragStart?.(item, moveEvent.clientX, moveEvent.clientY);
      }
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      cleanup();
      if (!dragStarted) {
        if (expanded) {
          if (!isEditing) onEditStart(item.title);
        } else {
          onToggleExpand(item.id);
        }
      }
    };

    const cleanup = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
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
        className={`relative border-b border-border-custom/15 pr-2 py-4 pl-1 transition-all duration-200 ease-out group-hover:bg-text-primary/[0.015] ${leftBorder}`}
      >
        <div className="flex items-start gap-3">
          {/* Drag grip */}
          <div
            onTouchStart={onGripTouchStart}
            onTouchEnd={onGripTouchEnd}
            onTouchMove={onGripTouchMove}
            onMouseDown={onGripMouseDown}
            className="mt-0.5 shrink-0 touch-none cursor-grab text-text-muted/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150 select-none"
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
                className={`flex h-[18px] w-[18px] items-center justify-center text-[13.5px] leading-none transition-all ${
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
              className="mt-0.5 shrink-0 btn-press cursor-pointer"
            >
              <div
                className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all duration-150 ${
                  completing || isDone
                    ? 'bg-emerald-500 border-emerald-500 scale-100'
                    : item.priority === 'urgent'
                    ? 'border-rose-500 hover:bg-rose-500/10'
                    : item.priority === 'high'
                    ? 'border-amber-400 hover:bg-amber-400/10'
                    : item.priority === 'normal'
                    ? 'border-cyan-400 hover:bg-cyan-400/10'
                    : 'border-slate-400 hover:bg-slate-400/10'
                }`}
              >
                {(completing || isDone) && <Check size={9} className="text-white" strokeWidth={3.5} />}
              </div>
            </button>
          )}

          {/* Content */}
          <div
            className="min-w-0 flex-1 cursor-pointer"
            onMouseDown={handleContentMouseDown}
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
                className="w-full rounded-xl border border-primary/30 bg-surface-solid px-3 py-1.5 text-[13px] font-semibold text-text-primary outline-none ring-2 ring-primary/15"
              />
            ) : (
              <div className="group/title flex items-center gap-1.5">
                <p
                  className={`text-[13.5px] font-semibold leading-snug transition-colors ${
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
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {dateInfo && !isDone && <span className={`text-[9.5px] font-medium ${dateInfo.color}`}>{dateInfo.text}</span>}
              {item.recurrence && (
                <span className="flex items-center gap-0.5 text-[9.5px] text-primary/40">
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
                  <span className="text-[9.5px] text-text-muted/45 font-medium">{doneSubtaskCount}/{totalSubtaskCount}</span>
                </div>
              )}
              {item.duration_minutes != null && item.duration_minutes > 0 && !isDone && (
                <span className="flex items-center gap-0.5 text-[9.5px] text-text-muted/40 font-medium">
                  <Clock size={8} />
                  {item.duration_minutes >= 60
                    ? `${Math.floor(item.duration_minutes / 60)}h${item.duration_minutes % 60 > 0 ? ` ${item.duration_minutes % 60}m` : ''}`
                    : `${item.duration_minutes}m`}
                </span>
              )}
              {(item.tags || []).map((tag: string) => (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-1 text-[9.5px] font-medium px-1 py-0.5 rounded bg-white/5 border border-white/5 transition-all opacity-70 ${
                    tag.toLowerCase() === 'finanse' || tag.toLowerCase() === 'zdrowie'
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : tag.toLowerCase() === 'projekt'
                      ? 'text-indigo-400 bg-indigo-500/10'
                      : tag.toLowerCase() === 'egzamin'
                      ? 'text-pink-400 bg-pink-500/10'
                      : 'text-text-muted bg-white/5'
                  }`}
                >
                  <Tag size={9} className="shrink-0" />
                  <span>{tag}</span>
                </span>
              ))}
              {isLinkedToPlan && (
                <span className="flex items-center gap-0.5 text-[9.5px] text-primary/50">
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
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-wide transition-all ${chipBg}`}>
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

          {/* Hover Quick Actions */}
          {!isDone && (
            <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ml-2">
              <button
                onClick={e => {
                  e.stopPropagation();
                  onEditStart(item.title);
                }}
                className="p-1 text-text-muted hover:text-text-primary hover:bg-text-primary/[0.04] rounded-lg transition-colors cursor-pointer"
                title="Edytuj zadanie (Ctrl E)"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  onShowContextMenu(item, rect.left, rect.bottom + 5);
                }}
                className="p-1 text-text-muted hover:text-text-primary hover:bg-text-primary/[0.04] rounded-lg transition-colors cursor-pointer"
                title="Ustaw termin (T)"
              >
                <Calendar size={13} />
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  onToggleExpand(item.id);
                }}
                className="p-1 text-text-muted hover:text-text-primary hover:bg-text-primary/[0.04] rounded-lg transition-colors cursor-pointer"
                title="Szczegóły i komentarze"
              >
                <MessageSquare size={13} />
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  onShowContextMenu(item, rect.left, rect.bottom + 5);
                }}
                className="p-1 text-text-muted hover:text-text-primary hover:bg-text-primary/[0.04] rounded-lg transition-colors cursor-pointer"
                title="Więcej opcji"
              >
                <MoreHorizontal size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Expanded */}
        <div
          style={{
            display: 'grid',
            gridTemplateRows: expanded ? '1fr' : '0fr',
            transition: 'grid-template-rows 260ms cubic-bezier(0.4,0,0.2,1)',
            overflow: transitionCompleted ? 'visible' : 'hidden'
          }}
        >
          <div style={{ overflow: transitionCompleted ? 'visible' : 'hidden' }}>
            {expandMounted && (
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
                {onAddChildTask && (
                  <div className="border-t border-border-custom/20 pt-2.5 flex flex-col gap-2">
                    {childTasks.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        {childTasks.map((child) => (
                          <div
                            key={child.id}
                            className="flex items-center gap-2 rounded-xl border border-border-custom/30 bg-surface-solid/25 px-2.5 py-1"
                          >
                            <button onClick={() => onToggleChildTask?.(child)} className="shrink-0 btn-press">
                              <div
                                className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center transition-all ${
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
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        placeholder="Nowe podzadanie…"
                        value={newChildTask}
                        onChange={e => setNewChildTask(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newChildTask.trim()) {
                            onAddChildTask(newChildTask);
                            setNewChildTask('');
                          }
                        }}
                        className="min-w-0 flex-1 rounded-xl border border-border-custom/50 bg-surface-solid/40 px-2.5 py-1 text-[11px] text-text-primary outline-none placeholder:text-text-muted/30 focus:border-primary/30"
                      />
                      <button
                        onClick={() => {
                          if (newChildTask.trim()) {
                            onAddChildTask(newChildTask);
                            setNewChildTask('');
                          }
                        }}
                        disabled={!newChildTask.trim()}
                        className="rounded-xl bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary disabled:opacity-30 hover:bg-primary/20 transition-colors btn-press"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
