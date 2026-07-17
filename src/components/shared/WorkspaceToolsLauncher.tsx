import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Calendar, LayoutGrid, ListTodo, Sparkles, StickyNote, X } from 'lucide-react';
import { Pressable } from '../ui/ControlPrimitives';
import './workspaceToolsLauncher.css';

const TOOLS = [
  { id: 'dzis', label: 'Vanguard', icon: Sparkles },
  { id: 'keep', label: 'Notatki', icon: StickyNote },
  { id: 'todo', label: 'Zadania', icon: ListTodo },
  { id: 'kalendarz', label: 'Kalendarz', icon: Calendar },
  { id: 'links', label: 'Pocket', icon: BookOpen },
] as const;

interface Props {
  active?: string;
  onNavigate?: (destination: string) => void;
  placement?: 'header' | 'bottom';
  badgeCount?: number;
}

export default function WorkspaceToolsLauncher({ active, onNavigate, placement = 'bottom', badgeCount = 0 }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const trigger = placement === 'header' ? (
    <Pressable
      onClick={() => setOpen(true)}
      className="relative shrink-0 rounded-full border border-border-custom bg-surface-solid/5 p-2.5 text-text-muted hover:bg-surface-solid/15 active:scale-90"
      title="Narzędzia"
    >
      <LayoutGrid size={15} />
      {badgeCount > 0 && <span className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full bg-warning px-1 text-3xs font-bold leading-4 text-white">{badgeCount}</span>}
    </Pressable>
  ) : (
    <Pressable onClick={() => setOpen(true)} className="min-h-14 w-full flex-row gap-2 rounded-none text-sm font-semibold text-primary" icon={<LayoutGrid size={20} />}>
      Narzędzia
    </Pressable>
  );

  return (
    <>
      {trigger}
      {open && createPortal(
        <div className="workspace-tools-layer" onPointerDown={event => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section className="workspace-tools-sheet" role="dialog" aria-modal="true" aria-label="Narzędzia">
            <div className="flex items-center justify-between px-1 pb-4">
              <div>
                <p className="text-lg font-bold tracking-tight text-text-primary">Narzędzia</p>
                <p className="text-xs text-text-muted">Wszystko pod ręką, bez zaśmiecania nawigacji.</p>
              </div>
              <Pressable variant="ghost" size="sm" onClick={() => setOpen(false)} aria-label="Zamknij"><X size={18} /></Pressable>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {TOOLS.map(({ id, label, icon: Icon }) => (
                <Pressable
                  key={id}
                  onClick={() => { setOpen(false); onNavigate?.(id); }}
                  className={`workspace-tool-tile flex-col gap-2 ${active === id ? 'is-active' : ''}`}
                  icon={<Icon size={22} />}
                >
                  {label}
                </Pressable>
              ))}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
