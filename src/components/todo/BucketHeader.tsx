import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, Pencil, Trash2, Check, X } from 'lucide-react';

export interface BucketHeaderProps {
  icon: string;
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  isDropTarget: boolean;
  onRename?: (newName: string) => void;
  onDelete?: () => void;
}

export default function BucketHeader({
  icon,
  title,
  count,
  collapsed,
  onToggle,
  isDropTarget,
  onRename,
  onDelete,
}: BucketHeaderProps) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirmingDelete) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setConfirmingDelete(false);
    };
    const t = setTimeout(() => {
      document.addEventListener('mousedown', close);
      document.addEventListener('touchstart', close);
    }, 10);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [confirmingDelete]);

  const commitRename = () => {
    const next = draft.trim();
    if (next && next !== title) onRename?.(next);
    setRenaming(false);
  };

  return (
    <div
      className={`relative flex w-full items-center gap-2 py-2.5 transition-all duration-200 group/hdr ${
        isDropTarget ? 'text-primary' : 'text-text-primary'
      }`}
    >
      {renaming ? (
        <div className="flex flex-1 min-w-0 items-center gap-1.5">
          {icon && <span className="text-[14px] leading-none shrink-0 select-none">{icon}</span>}
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setRenaming(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="min-w-0 flex-1 rounded-md border border-primary/40 bg-surface-solid px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary outline-none"
          />
          <button onClick={commitRename} className="p-1 text-emerald-400 hover:text-emerald-300 shrink-0" title="Zapisz">
            <Check size={13} />
          </button>
          <button onClick={() => setRenaming(false)} className="p-1 text-text-muted/40 hover:text-text-primary shrink-0" title="Anuluj">
            <X size={13} />
          </button>
        </div>
      ) : (
        <button
          onClick={onToggle}
          className="flex flex-1 min-w-0 items-center gap-2 text-left transition-all duration-200 cursor-pointer"
        >
          <ChevronRight
            size={14}
            className={`text-text-muted/60 shrink-0 transition-transform duration-200 ${
              collapsed ? '' : 'rotate-90'
            }`}
          />
          {icon && <span className="text-[14px] leading-none shrink-0 select-none">{icon}</span>}
          <span
            className={`text-[14px] font-bold text-text-primary tracking-tight truncate transition-colors ${
              isDropTarget ? 'text-primary' : ''
            }`}
          >
            {title}
          </span>
          {count > 0 && (
            <span
              className="text-[11px] font-semibold text-text-muted/60 tabular-nums shrink-0 ml-1.5"
            >
              {count}
            </span>
          )}
        </button>
      )}

      {!renaming && (onRename || onDelete) && (
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/hdr:opacity-100 transition-opacity">
          {onRename && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDraft(title);
                setRenaming(true);
              }}
              className="p-1 text-text-muted/40 hover:text-primary transition-colors cursor-pointer"
              title="Zmień nazwę sekcji"
            >
              <Pencil size={11} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmingDelete(true);
              }}
              className="p-1 text-text-muted/40 hover:text-rose-400 transition-colors cursor-pointer"
              title="Usuń sekcję"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      )}

      {confirmingDelete && (
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full z-20 mt-1 w-64 rounded-2xl border border-border-custom bg-surface/95 p-3 shadow-2xl backdrop-blur-xl"
        >
          <p className="text-[11px] font-semibold text-text-primary leading-snug">
            Usunąć sekcję <span className="font-black">„{title}”</span>?
          </p>
          <p className="mt-0.5 text-[10px] text-text-muted">Zadania w niej wrócą do skrzynki.</p>
          <div className="mt-2.5 flex justify-end gap-2">
            <button
              onClick={() => setConfirmingDelete(false)}
              className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-text-muted hover:bg-surface-solid/80 transition-colors"
            >
              Anuluj
            </button>
            <button
              onClick={() => {
                setConfirmingDelete(false);
                onDelete?.();
              }}
              className="rounded-lg bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-400 hover:bg-rose-500/20 transition-colors"
            >
              Usuń
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
