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
        left: 0,
        top: 0,
        width: '80vw',
        maxWidth: '310px',
        zIndex: 9999,
        pointerEvents: 'none',
        willChange: 'transform',
        opacity: 0.93
      }}
      className="rounded-2xl border border-primary/30 bg-surface/95 shadow-2xl px-4 py-3 backdrop-blur-xl"
    >
      <div className="flex items-center gap-3">
        {icon ? (
          <span className="text-[20px] leading-none">{icon}</span>
        ) : (
          <div className={`h-4 w-4 rounded-full border-2 shrink-0 ${PRIORITY[item.priority]?.ring ?? 'border-sky-400'}`} />
        )}
        <p className="text-[13px] font-semibold text-text-primary truncate">{label}</p>
      </div>
    </div>
  );
}
