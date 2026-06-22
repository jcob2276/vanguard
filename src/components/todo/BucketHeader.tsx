import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface BucketHeaderProps {
  icon: string;
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  isDropTarget: boolean;
}

export default function BucketHeader({
  icon,
  title,
  count,
  collapsed,
  onToggle,
  isDropTarget
}: BucketHeaderProps) {
  return (
    <button
      onClick={onToggle}
      className={`flex w-full items-center gap-2.5 py-3 transition-all duration-200 hover:scale-[1.01] active:scale-95 text-left ${
        isDropTarget ? 'text-primary' : 'text-text-primary'
      }`}
    >
      {icon && <span className="text-[14px] leading-none shrink-0 select-none">{icon}</span>}
      <span
        className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${
          isDropTarget ? 'text-primary' : 'text-text-secondary'
        }`}
      >
        {title}
      </span>
      {count > 0 && (
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold bg-surface-solid border border-border-custom/60 text-text-muted tabular-nums transition-all ${
            isDropTarget ? 'text-primary border-primary/20 bg-primary/5' : ''
          }`}
        >
          {count}
        </span>
      )}
      <div className="flex-1" />
      {collapsed && <ChevronRight size={11} className="text-text-muted/30 shrink-0 transition-transform duration-200" />}
    </button>
  );
}
