import React from 'react';

interface EmptyStateProps {
  icon: string;
  label: string;
  isDragOver?: boolean;
  dragColor?: 'orange' | 'primary';
}

export default function EmptyState({
  icon,
  label,
  isDragOver = false,
  dragColor = 'primary',
}: EmptyStateProps) {
  const activeClass =
    dragColor === 'orange'
      ? 'border-warning bg-warning/5 text-warning scale-[1.01] shadow-lg shadow-warning/5'
      : 'border-primary bg-primary/5 text-primary scale-[1.01] shadow-lg shadow-primary/5';

  const inactiveClass =
    dragColor === 'orange'
      ? 'border-warning/25 text-warning/40 bg-surface-solid/10'
      : 'border-border-custom/25 text-text-muted/30 bg-surface-solid/10';

  return (
    <div
      className={`mx-1 my-2 rounded-xl border border-dashed p-6 text-center transition-all duration-200 ${
        isDragOver ? activeClass : inactiveClass
      }`}
    >
      <span className="block text-[14px] mb-1">{icon}</span>
      <span className="text-[11px] font-bold tracking-wide">{label}</span>
    </div>
  );
}
