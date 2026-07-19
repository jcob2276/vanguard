/**
 * @component TodoCard
 * @role Prezentacyjna powłoka karty (collapsed row, attachments) — logikę dostarcza TodoCardConnected.
 * @composes TodoCardCollapsedRow (renderuje collapsed view)
 * @composes TodoCardExpandedPanel (renderowany gdy expanded=true)
 * @usedBy TodoCardConnected (jedyny konsument)
 */
import React, { useState, useEffect } from 'react';
import { splitEmoji, relativeDate } from './todoUtils';
import TodoCardExpandedPanel from './TodoCardExpandedPanel';
import TodoCardCollapsedRow from './TodoCardCollapsedRow';
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
  onSetSchedule: (patch: { due_date?: string | null; scheduled_time?: string | null }) => void;
  onSetRecurrence: (r: string | null) => void;
  onSetDeadline: (date: string | null) => void;
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
  onSetSchedule,
  onSetRecurrence,
  onSetDeadline,
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
    isDone: item.status === 'done',
    onToggle,
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
      className={`group relative ${isDone ? 'opacity-[var(--opacity-40)]' : ''} ${isDragging ? 'opacity-[var(--opacity-0)] pointer-events-none' : ''}`}
      style={
        swipe.completingOut
          ? {
              transform: 'translateX(28px)',
              opacity: 0,
              pointerEvents: 'none',
              transition: 'var(--motion-todo-dismiss)'
            }
          : { transition: 'opacity 0.15s' }
      }
    >
      {/* Row */}
      <div
        onContextMenu={e => {
          e.preventDefault();
          onShowContextMenu(item, e.clientX, e.clientY);
        }}
        onClick={e => e.stopPropagation()}
        className={`relative border-b border-border-custom/15 pr-2 py-4 pl-1 transition-all duration-[var(--motion-medium)] ease-[var(--ease-out)] group-hover:bg-text-primary/[0.015] ${leftBorder}`}
      >
        <TodoCardCollapsedRow
          item={item}
          busy={busy}
          isDone={isDone}
          icon={icon}
          label={label}
          dateInfo={dateInfo}
          today={today}
          isEditing={isEditing}
          editingTitle={editingTitle}
          onEditChange={onEditChange}
          onEditSave={onEditSave}
          expanded={expanded}
          onEditStart={onEditStart}
          totalSubtaskCount={totalSubtaskCount}
          doneSubtaskCount={doneSubtaskCount}
          sectionGoalKey={sectionGoalKey}
          isLinkedToPlan={isLinkedToPlan}
          sectionName={sectionName}
          dreamTitle={dreamTitle}
          swipe={swipe}
          onShowContextMenu={onShowContextMenu}
          onToggleExpand={onToggleExpand}
        />

        {/* Expanded Panel */}
        <div
          style={{
            display: 'grid',
            gridTemplateRows: expanded ? '1fr' : '0fr',
            transition: 'var(--ds-inline-style-grid-template-rows-260ms-cubic-bezier-0-4-0-0-2-1)',
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
                onSetSchedule={onSetSchedule}
                onSetRecurrence={onSetRecurrence}
                onSetDeadline={onSetDeadline}
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
