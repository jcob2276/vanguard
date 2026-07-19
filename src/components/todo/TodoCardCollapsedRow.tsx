/* eslint-disable max-lines-per-function */
import React from 'react';
import { Check, Repeat2, Link2, Pencil, GripVertical, Clock, Tag, Calendar, MessageSquare, MoreHorizontal } from 'lucide-react';
import { Pressable, ControlInput } from '../ui/ControlPrimitives';
import { GOAL_ICON, RECURRENCE_LABELS } from './todoUtils';
import type { TodoItemRow } from '../../lib/todo/todo';

interface TodoCardCollapsedRowProps {
  item: TodoItemRow;
  busy: boolean;
  isDone: boolean;
  icon: string | null;
  label: string;
  dateInfo: { text: string; color: string } | null;
  today: string;
  isEditing: boolean;
  editingTitle: string;
  onEditChange: (val: string) => void;
  onEditSave: () => void;
  expanded: boolean;
  onEditStart: (t: string) => void;
  totalSubtaskCount: number;
  doneSubtaskCount: number;
  sectionGoalKey?: string | null;
  isLinkedToPlan: boolean;
  sectionName?: string | null;
  dreamTitle?: string | null;
  swipe: {
    completing: boolean;
    handleComplete: () => void;
    handleContentMouseDown: (e: React.MouseEvent) => void;
    onGripTouchStart: (e: React.TouchEvent) => void;
    onGripTouchEnd: (e: React.TouchEvent) => void;
    onGripTouchMove: (e: React.TouchEvent) => void;
    onGripMouseDown: (e: React.MouseEvent) => void;
  };
  onShowContextMenu: (item: TodoItemRow, clientX: number, clientY: number) => void;
  onToggleExpand: (id: string) => void;
}

export default function TodoCardCollapsedRow({
  item,
  busy,
  isDone,
  icon,
  label,
  dateInfo,
  today,
  isEditing,
  editingTitle,
  onEditChange,
  onEditSave,
  expanded,
  onEditStart,
  totalSubtaskCount,
  doneSubtaskCount,
  sectionGoalKey,
  isLinkedToPlan,
  sectionName,
  dreamTitle,
  swipe,
  onShowContextMenu,
  onToggleExpand,
}: TodoCardCollapsedRowProps) {
  return (
    <div className="flex items-start gap-3">
      {/* Drag grip */}
      <div
        data-no-view-swipe
        onTouchStart={swipe.onGripTouchStart}
        onTouchEnd={swipe.onGripTouchEnd}
        onTouchMove={swipe.onGripTouchMove}
        onMouseDown={swipe.onGripMouseDown}
        className="mt-0.5 shrink-0 touch-none cursor-grab text-text-muted/40 opacity-[var(--opacity-0)] group-hover:opacity-[var(--opacity-100)] transition-opacity duration-[var(--motion-medium)] select-none"
      >
        <GripVertical size={13} />
      </div>

      {/* Emoji icon OR priority circle checkbox */}
      {icon ? (
        <Pressable
          onClick={e => {
            e.stopPropagation();
            swipe.handleComplete();
          }}
          disabled={busy}
          className="shrink-0 mt-0.5 btn-press"
        >
          <span
            className={`flex h-[var(--ds-h-18px)] w-[var(--ds-w-18px)] items-center justify-center text-sm leading-none transition-all ${
              isDone ? 'grayscale opacity-[var(--opacity-40)]' : ''
            }`}
          >
            {icon}
          </span>
        </Pressable>
      ) : (
        <Pressable
          onClick={e => {
            e.stopPropagation();
            swipe.handleComplete();
          }}
          disabled={busy}
          aria-label={`${isDone ? 'Oznacz jako niewykonane' : 'Oznacz jako wykonane'}: ${item.title}`}
          className="mt-0.5 shrink-0 btn-press cursor-pointer"
        >
          <div
            className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all duration-[var(--motion-medium)] ${
              swipe.completing || isDone
                ? 'bg-success border-success scale-100'
                : item.priority === 'urgent'
                ? 'border-danger hover:bg-danger/10'
                : item.priority === 'high'
                ? 'border-warning hover:bg-warning/10'
                : item.priority === 'normal'
                ? 'border-info hover:bg-info/10'
                : 'border-border-custom hover:bg-surface-2/10'
            }`}
          >
            {(swipe.completing || isDone) && <Check size={9} className="text-on-accent" strokeWidth={3.5} />}
          </div>
        </Pressable>
      )}

      {/* Content */}
      <div
        className="min-w-0 flex-1 cursor-pointer"
        onMouseDown={swipe.handleContentMouseDown}
      >
        {isEditing ? (
          <ControlInput
            autoFocus
            value={editingTitle}
            onChange={e => onEditChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'Escape') onEditSave();
            }}
            onBlur={onEditSave}
            onClick={e => e.stopPropagation()}
            className="w-full rounded-xl border border-primary/30 bg-surface-solid px-3 py-1.5 text-sm font-semibold text-text-primary outline-none ring-2 ring-primary/15"
          />
        ) : (
          <div className="group/title flex items-center gap-1.5">
            <p
              className={`text-sm font-semibold leading-snug transition-colors ${
                isDone ? 'line-through text-text-muted/50' : 'text-text-primary'
              }`}
            >
              {label}
            </p>
            {expanded && (
              <Pencil size={10} className="text-text-muted opacity-[var(--opacity-0)] group-hover/title:opacity-[var(--opacity-100)] transition-opacity shrink-0" />
            )}
          </div>
        )}

        {/* Metadata */}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {dateInfo && !isDone && <span className={`text-2xs font-medium ${dateInfo.color}`}>{dateInfo.text}</span>}
          {item.deadline_date && !isDone && (
            <span className={`text-2xs font-semibold ${item.deadline_date <= today ? 'text-danger' : 'text-warning'}`}>
              do {item.deadline_date}
            </span>
          )}
          {item.recurrence && (
            <span className="flex items-center gap-0.5 text-2xs text-primary/40">
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
              <span className="text-2xs text-text-muted/45 font-medium">{doneSubtaskCount}/{totalSubtaskCount}</span>
            </div>
          )}
          {item.duration_minutes != null && item.duration_minutes > 0 && !isDone && (
            <span className="flex items-center gap-0.5 text-2xs text-text-muted/40 font-medium">
              <Clock size={8} />
              {item.duration_minutes >= 60
                ? `${Math.floor(item.duration_minutes / 60)}h${item.duration_minutes % 60 > 0 ? ` ${item.duration_minutes % 60}m` : ''}`
                : `${item.duration_minutes}m`}
            </span>
          )}
          {(item.tags || []).map((tag: string) => (
            <span
              key={tag}
              className={`inline-flex items-center gap-1 text-2xs font-medium px-1 py-0.5 rounded bg-on-accent/5 border border-on-accent/5 transition-all opacity-[var(--opacity-70)] ${
                tag.toLowerCase() === 'finanse' || tag.toLowerCase() === 'zdrowie'
                  ? 'text-success bg-success/10'
                  : tag.toLowerCase() === 'projekt'
                  ? 'text-primary bg-primary/10'
                  : tag.toLowerCase() === 'egzamin'
                  ? 'text-primary bg-primary/10'
                  : 'text-text-muted bg-on-accent/5'
              }`}
            >
              <Tag size={9} className="shrink-0" />
              <span>{tag}</span>
            </span>
          ))}
          {isLinkedToPlan && (
            <span className="flex items-center gap-0.5 text-2xs text-primary/50">
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
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-semibold tracking-wide transition-all ${chipBg}`}>
                  {GoalIcon && <GoalIcon size={8} />}
                  <span className="uppercase">{sectionName}</span>
                  {dreamTitle && (
                    <span className="opacity-[var(--opacity-60)] truncate max-w-[var(--ds-maxw-80px)]">· {dreamTitle}</span>
                  )}
                </span>
              );
            })()}
        </div>
      </div>

      {/* Hover Quick Actions */}
      {!isDone && (
        <div className="shrink-0 flex items-center gap-1 opacity-[var(--opacity-0)] group-hover:opacity-[var(--opacity-100)] transition-opacity duration-[var(--motion-medium)] ml-2">
          <Pressable
            onClick={e => {
              e.stopPropagation();
              onEditStart(item.title);
            }}
            className="p-1 text-text-muted hover:text-text-primary hover:bg-text-primary/[0.04] rounded-lg transition-colors cursor-pointer"
            title="Edytuj zadanie (Ctrl E)"
          >
            <Pencil size={13} />
          </Pressable>
          <Pressable
            onClick={e => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              onShowContextMenu(item, rect.left, rect.bottom + 5);
            }}
            className="p-1 text-text-muted hover:text-text-primary hover:bg-text-primary/[0.04] rounded-lg transition-colors cursor-pointer"
            title="Ustaw termin (T)"
          >
            <Calendar size={13} />
          </Pressable>
          <Pressable
            onClick={e => {
              e.stopPropagation();
              onToggleExpand(item.id);
            }}
            className="p-1 text-text-muted hover:text-text-primary hover:bg-text-primary/[0.04] rounded-lg transition-colors cursor-pointer"
            title="Szczegóły i komentarze"
          >
            <MessageSquare size={13} />
          </Pressable>
          <Pressable
            onClick={e => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              onShowContextMenu(item, rect.left, rect.bottom + 5);
            }}
            className="p-1 text-text-muted hover:text-text-primary hover:bg-text-primary/[0.04] rounded-lg transition-colors cursor-pointer"
            title="Więcej opcji"
          >
            <MoreHorizontal size={13} />
          </Pressable>
        </div>
      )}
    </div>
  );
}
