import React, { useState, useEffect } from 'react';
import { Check, Repeat2, Link2, Pencil, X, GripVertical, Clock, Tag, Calendar, MessageSquare, MoreHorizontal } from 'lucide-react';
import {
  GOAL_ICON,
  splitEmoji,
  relativeDate,
  RECURRENCE_LABELS
} from './todoUtils';
import TodoCardExpandedPanel from './TodoCardExpandedPanel';
import { useTodoCardAttachments } from './useTodoCardAttachments';
import { useTodoCardSwipe } from './useTodoCardSwipe';
import type { TodoItemRow } from '../../lib/todo/todo';

export interface TodoCardProps {
  item: TodoItemRow;
  onToggle: () => void;
  onDrop: () => void;
  onSetPriority: (p: string) => void;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
  busy: boolean;
  today: string;
  isLinkedToPlan: boolean;
  sections: { id: string; name: string }[];
  onMoveSection: (sId: string | null) => void;
  isEditing: boolean;
  editingTitle: string;
  onEditStart: (t: string) => void;
  onEditChange: (val: string) => void;
  onEditSave: () => void;
  sectionName?: string | null;
  sectionGoalKey?: string | null;
  onDragStart?: (item: TodoItemRow, clientX: number, clientY: number) => void;
  isDragging: boolean;
  onShowContextMenu: (item: TodoItemRow, clientX: number, clientY: number) => void;
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
  childTasks?: TodoItemRow[];
  onAddChildTask?: (title: string) => void;
  onToggleChildTask?: (child: TodoItemRow) => void;
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
  onSetDueDate,
  dreamTitle,
  onSetReminder,
  onSetTags,
  onSetNotes,
  childTasks = [],
  onAddChildTask,
  onToggleChildTask,
}: TodoCardProps) {
  const { attachments, uploadingFile, fileInputRef, handleFileUpload, handleDeleteAttachment } = useTodoCardAttachments(expanded, item.id, item.user_id);

  const swipe = useTodoCardSwipe({
    isDragging,
    isDone: item.status === 'done',
    onToggle,
    onDrop,
    onShowContextMenu,
    item,
    onDragStart,
    expanded,
    isEditing,
    onEditStart,
    onToggleExpand,
  });

  const [transitionCompleted, setTransitionCompleted] = useState(false);
  const [expandMounted, setExpandMounted] = useState(false);

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

  const totalSubtaskCount = childTasks.length;
  const doneSubtaskCount = childTasks.filter((c) => c.status === 'done').length;
  const isDone = item.status === 'done';

  const leftBorder = '';
  const { icon, label } = splitEmoji(item.title);
  const dateInfo = relativeDate(item.due_date, today);

  return (
    <div
      className={`group relative ${isDone ? 'opacity-40' : ''} ${isDragging ? 'opacity-0 pointer-events-none' : ''}`}
      style={
        swipe.completingOut
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
        className={`absolute inset-0 flex items-center justify-start pl-3 text-success pointer-events-none transition-opacity duration-150 ${
          swipe.swipeDir === 'right' ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <Check size={15} strokeWidth={3} />
      </div>
      <div
        className={`absolute inset-0 flex items-center justify-end pr-3 text-danger pointer-events-none transition-opacity duration-150 ${
          swipe.swipeDir === 'left' ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <X size={15} />
      </div>

      {/* Row */}
      <div
        onTouchStart={swipe.onTouchStart}
        onTouchMove={swipe.onTouchMove}
        onTouchEnd={swipe.onTouchEnd}
        onContextMenu={e => {
          e.preventDefault();
          onShowContextMenu(item, e.clientX, e.clientY);
        }}
        style={{ transform: `translateX(${swipe.swipeOffset}px)` }}
        onClick={e => e.stopPropagation()}
        className={`relative border-b border-border-custom/15 pr-2 py-4 pl-1 transition-all duration-200 ease-out group-hover:bg-text-primary/[0.015] ${leftBorder}`}
      >
        <div className="flex items-start gap-3">
          {/* Drag grip */}
          <div
            onTouchStart={swipe.onGripTouchStart}
            onTouchEnd={swipe.onGripTouchEnd}
            onTouchMove={swipe.onGripTouchMove}
            onMouseDown={swipe.onGripMouseDown}
            className="mt-0.5 shrink-0 touch-none cursor-grab text-text-muted/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150 select-none"
          >
            <GripVertical size={13} />
          </div>

          {/* Emoji icon OR priority circle checkbox */}
          {icon ? (
            <button
              onClick={e => {
                e.stopPropagation();
                swipe.handleComplete();
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
                swipe.handleComplete();
              }}
              disabled={busy}
              className="mt-0.5 shrink-0 btn-press cursor-pointer"
            >
              <div
                className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all duration-150 ${
                  swipe.completing || isDone
                    ? 'bg-success border-success scale-100'
                    : item.priority === 'urgent'
                    ? 'border-danger hover:bg-danger/10'
                    : item.priority === 'high'
                    ? 'border-warning hover:bg-warning/10'
                    : item.priority === 'normal'
                    ? 'border-info hover:bg-info/10'
                    : 'border-slate-400 hover:bg-slate-400/10'
                }`}
              >
                {(swipe.completing || isDone) && <Check size={9} className="text-white" strokeWidth={3.5} />}
              </div>
            </button>
          )}

          {/* Content */}
          <div
            className="min-w-0 flex-1 cursor-pointer"
            onMouseDown={swipe.handleContentMouseDown}
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
                          ? 'bg-success'
                          : sectionGoalKey === 'duch'
                          ? 'bg-primary'
                          : sectionGoalKey === 'konto'
                          ? 'bg-warning'
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
                      ? 'text-success bg-success/10'
                      : tag.toLowerCase() === 'projekt'
                      ? 'text-primary bg-primary/10'
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
                    ? 'bg-success/8 border-success/15 text-success dark:text-success'
                    : sectionGoalKey === 'duch'
                    ? 'bg-primary/8 border-primary/15 text-primary dark:text-primary'
                    : sectionGoalKey === 'konto'
                    ? 'bg-warning/8 border-warning/15 text-warning dark:text-warning'
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
              <TodoCardExpandedPanel
                item={item}
                isEditing={isEditing}
                editingTitle={editingTitle}
                onEditStart={onEditStart}
                onEditChange={onEditChange}
                onEditSave={onEditSave}
                onSetNotes={onSetNotes}
                onSetDueDate={onSetDueDate}
                onSetPriority={onSetPriority}
                onSetReminder={onSetReminder}
                onSetTags={onSetTags}
                onMoveSection={onMoveSection}
                onDrop={onDrop}
                onToggleExpand={onToggleExpand}
                sections={sections}
                today={today}
                childTasks={childTasks}
                onAddChildTask={onAddChildTask}
                onToggleChildTask={onToggleChildTask}
                attachments={attachments}
                uploadingFile={uploadingFile}
                fileInputRef={fileInputRef}
                handleFileUpload={handleFileUpload}
                handleDeleteAttachment={handleDeleteAttachment}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
