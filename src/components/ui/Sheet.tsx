import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import IconButton from './IconButton';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  side?: 'left' | 'right' | 'bottom';
}

export function Sheet({ open, onOpenChange, title, children, side = 'right' }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onOpenChange(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open, onOpenChange]);

  if (!open) return null;
  const placement = side === 'bottom'
    ? 'inset-x-0 bottom-0 max-h-[var(--legacy-arbitrary-059)] rounded-t-[var(--radius-xl)]'
    : `${side === 'left' ? 'left-0' : 'right-0'} inset-y-0 w-full max-w-md`;

  return (
    <div className="fixed inset-0 z-[var(--z-overlay)] bg-scrim/35 backdrop-blur-[var(--blur-overlay)]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onOpenChange(false); }}>
      <section className={`absolute flex flex-col overflow-hidden bg-surface-1 shadow-float ${placement}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <header className="flex min-h-[var(--toolbar-height)] items-center justify-between border-b border-border-custom/40 px-[var(--space-5)]">
          <h2 className="text-lg font-bold tracking-tight text-text-primary">{title}</h2>
          <IconButton icon={<X size={18} />} label="Zamknij" onClick={() => onOpenChange(false)} />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-[var(--space-5)]">{children}</div>
      </section>
    </div>
  );
}

export default Sheet;
