import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import IconButton from './IconButton';
import { IOS_SPRING, shouldCommitGesture } from '../../lib/motion/iosMotion';
import { useHaptics } from '../../hooks/useHaptics';

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
  const { light } = useHaptics();

  useEffect(() => {
    if (!open) return;
    light();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        light();
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open, onOpenChange, light]);

  const placement = side === 'bottom'
    ? 'inset-x-0 bottom-0 max-h-[85svh] rounded-t-[28px] border-t border-black/10 dark:border-white/12'
    : `${side === 'left' ? 'left-0' : 'right-0'} inset-y-0 w-full max-w-md border-x border-black/10 dark:border-white/10`;

  const initial = side === 'bottom' ? { y: '100%' } : { x: side === 'left' ? '-100%' : '100%' };
  const exit = initial;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[var(--z-overlay)] bg-black/40 dark:bg-black/70 backdrop-blur-[20px] saturate(180%)"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              light();
              onOpenChange(false);
            }
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.section
            ref={panelRef}
            className={`absolute flex flex-col overflow-hidden bg-surface-1 dark:bg-surface-solid shadow-2xl ${placement}`}
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
              })) {
                light();
                onOpenChange(false);
              }
            }}
          >
            {side === 'bottom' && (
              <div
                aria-label="Przeciągnij, aby zamknąć"
                className="ios-sheet-handle"
              />
            )}
            <header className="flex min-h-[52px] items-center justify-between border-b border-black/8 dark:border-white/10 px-5">
              <h2 className="text-lg font-bold tracking-tight text-text-primary">{title}</h2>
              <IconButton icon={<X size={18} />} label="Zamknij" onClick={() => { light(); onOpenChange(false); }} />
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );

}


export default Sheet;

