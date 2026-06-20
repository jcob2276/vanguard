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
  icon: _icon,
  title,
  count,
  collapsed,
  onToggle,
  isDropTarget
}: BucketHeaderProps) {
  return (
    <button onClick={onToggle} className="flex w-full items-center gap-2 py-2.5 transition-all duration-200">
      <span
        className={`text-[10px] font-black uppercase tracking-widest transition-colors ${
          isDropTarget ? 'text-primary' : 'text-text-muted/45'
        }`}
      >
        {title}
      </span>
      {count > 0 && (
        <span
          className={`text-[10px] font-medium tabular-nums transition-colors ${
            isDropTarget ? 'text-primary/60' : 'text-text-muted/25'
          }`}
        >
          {count}
        </span>
      )}
      <div className="flex-1" />
      {collapsed && <ChevronRight size={10} className="text-text-muted/25 shrink-0" />}
    </button>
  );
}
