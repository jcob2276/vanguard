import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import IconButton from './IconButton';
import { IOS_SPRING, shouldCommitGesture } from '../../lib/motion/iosMotion';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  side?: 'left' | 'right' | 'bottom';
}

function Sheet({ open, onOpenChange, title, children, side = 'right' }: SheetProps) {
  const panelRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onOpenChange(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open, onOpenChange]);

  const placement = side === 'bottom'
    ? 'inset-x-0 bottom-0 max-h-[var(--ds-arbitrary-85svh)] rounded-t-[var(--radius-xl)]'
    : `${side === 'left' ? 'left-0' : 'right-0'} inset-y-0 w-full max-w-md`;

  const initial = side === 'bottom' ? { y: '100%' } : { x: side === 'left' ? '-100%' : '100%' };
  const exit = initial;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[var(--z-overlay)] bg-scrim/35 backdrop-blur-[var(--blur-overlay)]"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) onOpenChange(false); }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.section
            ref={panelRef}
            className={`absolute flex flex-col overflow-hidden bg-surface-1 shadow-float ${placement}`}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            initial={reduceMotion ? { opacity: 0 } : initial}
            animate={reduceMotion ? { opacity: 1 } : { x: 0, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : exit}
            transition={reduceMotion ? { duration: 0.12 } : IOS_SPRING.sheet}
            drag={side === 'bottom' && !reduceMotion ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.02, bottom: 0.55 }}
            onDragEnd={(_, info) => {
              const height = panelRef.current?.getBoundingClientRect().height ?? window.innerHeight;
              if (info.offset.y > 0 && shouldCommitGesture({
                distance: info.offset.y,
                velocity: info.velocity.y,
                dimension: height,
              })) onOpenChange(false);
            }}
          >
        {side === 'bottom' && (
          <div
            aria-label="Przeciągnij, aby zamknąć"
            className="mx-auto mt-2 h-1.5 w-9 shrink-0 rounded-full bg-text-muted/30"
          />
        )}
        <header className="flex min-h-[var(--toolbar-height)] items-center justify-between border-b border-border-custom/40 px-[var(--space-5)]">
          <h2 className="text-lg font-bold tracking-tight text-text-primary">{title}</h2>
          <IconButton icon={<X size={18} />} label="Zamknij" onClick={() => onOpenChange(false)} />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-[var(--space-5)]">{children}</div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Sheet;
