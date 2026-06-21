import React, { useEffect, useRef, ReactNode } from 'react';
import { splitEmoji } from './todoUtils';

export interface ContextMenuProps {
  x: number;
  y: number;
  item: any;
  today: string;
  sections: any[];
  onClose: () => void;
  onComplete: () => void;
  onDrop: () => void;
  onMoveToToday: () => void;
  onClearDueDate: () => void;
  onMoveSection: (sId: string | null) => void;
}

export default function ContextMenu({
  x,
  y,
  item,
  today,
  sections,
  onClose,
  onComplete,
  onDrop,
  onMoveToToday,
  onClearDueDate,
  onMoveSection
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const closeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const t = setTimeout(() => {
      document.addEventListener('mousedown', close);
      document.addEventListener('touchstart', close);
      document.addEventListener('keydown', closeKey);
    }, 10);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', closeKey);
    };
  }, [onClose]);

  // Keep menu inside viewport
  const left = Math.min(x, window.innerWidth - 220);
  const top = Math.min(y, window.innerHeight - 300);

  const MenuItem = ({
    icon,
    label,
    onClick,
    danger = false
  }: {
    icon: ReactNode;
    label: ReactNode;
    onClick: () => void;
    danger?: boolean;
  }) => (
    <button
      onClick={() => {
        onClick();
        onClose();
      }}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-[12px] font-semibold transition-colors hover:bg-surface-solid/80 ${
        danger ? 'text-rose-400 hover:bg-rose-500/10' : 'text-text-primary'
      }`}
    >
      <span className="text-[14px] leading-none">{icon}</span>
      {label}
    </button>
  );

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left, top, zIndex: 10000, minWidth: 220 }}
      className="max-h-[350px] overflow-y-auto rounded-2xl border border-border-custom bg-surface/95 shadow-2xl backdrop-blur-xl"
    >
      <div className="border-b border-border-custom/40 px-4 py-2">
        <p className="truncate text-[10px] font-black uppercase tracking-widest text-text-muted">
          {splitEmoji(item.title).label || item.title}
        </p>
      </div>
      <div className="py-1">
        <MenuItem
          icon={item.status === 'done' ? '↩️' : '✅'}
          label={item.status === 'done' ? 'Cofnij ukończenie' : 'Oznacz jako gotowe'}
          onClick={onComplete}
        />
        <div className="mx-3 my-1 border-t border-border-custom/30" />
        <MenuItem icon="🔥" label="Przenieś na Dziś" onClick={onMoveToToday} />
        {item.due_date && <MenuItem icon="❌" label="Usuń termin" onClick={onClearDueDate} />}

        <div className="mx-3 my-1 border-t border-border-custom/30" />
        <p className="px-4 py-1 text-[9px] font-bold uppercase tracking-wider text-text-muted/65">Sekcja</p>
        <MenuItem icon="📥" label="Skrzynka (brak sekcji)" onClick={() => onMoveSection(null)} />
        {sections.map(s => (
          <MenuItem key={s.id} icon="📂" label={s.name} onClick={() => onMoveSection(s.id)} />
        ))}

        <div className="mx-3 my-1 border-t border-border-custom/30" />
        <MenuItem icon="🗑" label="Odpuść zadanie" onClick={onDrop} danger />
      </div>
    </div>
  );
}
