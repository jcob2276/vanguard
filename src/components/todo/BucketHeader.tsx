import { Pressable, ControlInput } from '../ui/ControlPrimitives';
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
      className={`relative flex w-full items-center gap-2 py-1.5 transition-all duration-[var(--motion-medium)] group/hdr ${
        isDropTarget ? 'text-primary' : 'text-text-primary'
      }`}
    >
      {renaming ? (
        <div className="flex flex-1 min-w-0 items-center gap-1.5">
          {icon && <span className="text-sm leading-none shrink-0 select-none">{icon}</span>}
          <ControlInput
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setRenaming(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="min-w-0 flex-1 rounded-md border border-primary/40 bg-surface-solid px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-primary outline-none"
          />
          <Pressable onClick={commitRename} className="p-1 text-success hover:text-success-hover shrink-0" title="Zapisz">
            <Check size={12} />
          </Pressable>
          <Pressable onClick={() => setRenaming(false)} className="p-1 text-text-muted/40 hover:text-text-primary shrink-0" title="Anuluj">
            <X size={12} />
          </Pressable>
        </div>
      ) : (
        <Pressable
          onClick={onToggle}
          className="flex flex-1 min-w-0 items-center gap-2 text-left transition-all duration-[var(--motion-medium)] cursor-pointer"
        >
          <ChevronRight
            size={12}
            className={`text-text-muted/60 shrink-0 transition-transform duration-[var(--motion-medium)] ${
              collapsed ? '' : 'rotate-90'
            }`}
          />
          {icon && <span className="text-lg leading-none shrink-0 select-none">{icon}</span>}
          <span
            className={`text-lg font-bold text-text-primary tracking-tight truncate transition-colors ${
              isDropTarget ? 'text-primary' : ''
            }`}
          >
            {title}
          </span>
          {count > 0 && (
            <span
              className="text-xs font-semibold text-text-muted/60 tabular-nums shrink-0 ml-1.5"
            >
              {count}
            </span>
          )}
        </Pressable>
      )}

      {!renaming && (onRename || onDelete) && (
        <div className="flex items-center gap-0.5 shrink-0 opacity-[var(--opacity-0)] group-hover/hdr:opacity-[var(--opacity-100)] transition-opacity duration-[var(--motion-medium)]">
          {onRename && (
            <Pressable
              onClick={(e) => {
                e.stopPropagation();
                setDraft(title);
                setRenaming(true);
              }}
              className="p-1 text-text-muted/40 hover:text-primary transition-colors cursor-pointer"
              title="Zmień nazwę sekcji"
            >
              <Pencil size={11} />
            </Pressable>
          )}
          {onDelete && (
            <Pressable
              onClick={(e) => {
                e.stopPropagation();
                setConfirmingDelete(true);
              }}
              className="p-1 text-text-muted/40 hover:text-danger transition-colors cursor-pointer"
              title="Usuń sekcję"
            >
              <Trash2 size={11} />
            </Pressable>
          )}
        </div>
      )}

      {confirmingDelete && (
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full z-[var(--z-popover)] mt-1 w-64 rounded-2xl border border-border-custom bg-surface/95 p-3 shadow-2xl backdrop-blur-[var(--blur-xl)]"
        >
          <p className="text-xs font-semibold text-text-primary leading-snug">
            Usunąć sekcję <span className="font-black">„{title}”</span>?
          </p>
          <p className="mt-0.5 text-xs text-text-muted">Zadania w niej wrócą do skrzynki.</p>
          <div className="mt-2.5 flex justify-end gap-2">
            <Pressable
              onClick={() => setConfirmingDelete(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-text-muted hover:bg-surface-solid/80 transition-colors"
            >
              Anuluj
            </Pressable>
            <Pressable
              onClick={() => {
                setConfirmingDelete(false);
                onDelete?.();
              }}
              className="rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-bold text-danger hover:bg-danger/20 transition-colors"
            >
              Usuń
            </Pressable>
          </div>
        </div>
      )}
    </div>
  );
}
