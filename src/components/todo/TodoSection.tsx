import React from 'react';
import BucketHeader from './BucketHeader';
import type { TodoItemRow } from './useTodoData';

export interface TodoSectionProps {
  innerRef?: React.Ref<HTMLDivElement> | null;
  id: string;
  icon: string;
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  isDropTarget: boolean;
  draggingItem: TodoItemRow | null;
  items: TodoItemRow[];
  renderCard: (item: TodoItemRow) => React.ReactNode;
  dropPlaceholderIcon?: string;
  dropPlaceholderText?: string;
}

export default function TodoSection({
  innerRef,
  id,
  icon,
  title,
  count,
  collapsed,
  onToggle,
  isDropTarget,
  draggingItem,
  items,
  renderCard,
  dropPlaceholderIcon = '📂',
  dropPlaceholderText = 'Upuść tutaj, aby przypisać do sekcji',
}: TodoSectionProps) {
  const showPlaceholder = items.length === 0;
  const isToday = id === 'today';

  const containerDragClass = draggingItem !== null
    ? isDropTarget
      ? isToday
        ? 'border border-orange-500/40 bg-orange-500/10 scale-[1.01] shadow-[0_4px_25px_rgba(249,115,22,0.12)]'
        : 'border border-primary/40 bg-primary/10 scale-[1.01] shadow-[0_4px_25px_rgba(99,102,241,0.12)]'
      : isToday
        ? 'border border-dashed border-orange-500/20 bg-orange-500/5'
        : 'border border-dashed border-primary/20 bg-primary/5'
    : 'border border-transparent bg-transparent';

  const placeholderClass = isDropTarget
    ? isToday
      ? 'border-orange-500 bg-orange-500/5 text-orange-500 scale-[1.01] shadow-lg shadow-orange-500/5'
      : 'border-primary bg-primary/5 text-primary scale-[1.01] shadow-lg shadow-primary/5'
    : isToday
      ? 'border-orange-500/25 text-orange-500/40 bg-surface-solid/10'
      : 'border-border-custom/25 text-text-muted/30 bg-surface-solid/10';

  return (
    <div
      ref={innerRef || undefined}
      className={`rounded-2xl p-2 transition-all duration-200 ${containerDragClass}`}
    >
      <BucketHeader
        icon={icon}
        title={title}
        count={count}
        collapsed={collapsed}
        onToggle={onToggle}
        isDropTarget={isDropTarget}
      />
      {!collapsed && (
        <div className="pt-1">
          {showPlaceholder ? (
            <div className={`mx-1 my-2 rounded-xl border border-dashed p-6 text-center transition-all duration-200 ${placeholderClass}`}>
              <span className="block text-[14px] mb-1">{dropPlaceholderIcon}</span>
              <span className="text-[11px] font-bold tracking-wide">{dropPlaceholderText}</span>
            </div>
          ) : (
            items.map((item) => renderCard(item))
          )}
        </div>
      )}
    </div>
  );
}
