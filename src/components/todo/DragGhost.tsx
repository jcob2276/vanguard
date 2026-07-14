import React, { useEffect, useRef } from 'react';
import { splitEmoji, PRIORITY } from './todoUtils';
import type { TodoItemRow } from '../../lib/todo/todo';

export interface DragGhostProps {
  item: TodoItemRow;
  posRef: React.MutableRefObject<{ x: number; y: number }>;
}

export default function DragGhost({ item, posRef }: DragGhostProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf: number;
    const tick = () => {
      if (ref.current && posRef.current) {
        const { x, y } = posRef.current;
        ref.current.style.transform = `translate(${x - 155}px, ${y - 24}px) rotate(-2deg) scale(1.05)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [posRef]);

  const { icon, label } = splitEmoji(item.title);
  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: 'var(--legacy-inline-style-039)',
        top: 'var(--legacy-inline-style-082)',
        width: 'var(--legacy-inline-style-098)',
        maxWidth: 'var(--legacy-inline-style-057)',
        zIndex: 'var(--legacy-inline-style-102)',
        pointerEvents: 'none',
        willChange: 'transform',
        opacity: 'var(--legacy-inline-style-067)'
      }}
      className="rounded-2xl border border-primary/30 bg-surface/95 shadow-2xl px-4 py-3 backdrop-blur-[var(--blur-xl)]"
    >
      <div className="flex items-center gap-3">
        {icon ? (
          <span className="text-xl leading-none">{icon}</span>
        ) : (
          <div className={`h-4 w-4 rounded-full border-2 shrink-0 ${PRIORITY[item.priority]?.ring ?? 'border-info'}`} />
        )}
        <p className="text-sm font-semibold text-text-primary truncate">{label}</p>
      </div>
    </div>
  );
}
