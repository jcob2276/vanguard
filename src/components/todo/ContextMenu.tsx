import React, { useEffect, useRef } from 'react';
import { Pencil, Calendar, Sun, CalendarDays, MoreHorizontal, Flag, FolderInput, Copy, Trash2, ChevronRight } from 'lucide-react';
import { shiftDateStr } from '../../lib/date';
import type { TodoItemRow } from '../../lib/todo/todo';

export interface ContextMenuProps {
  x: number;
  y: number;
  item: TodoItemRow;
  today: string;
  sections: { id: string; name: string }[];
  onClose: () => void;
  onDelete: () => void;
  onSetDueDate: (date: string | null) => void;
  onMoveSection: (sId: string | null) => void;
  onEditStart: () => void;
  onSetPriority: (priority: string) => void;
  onDuplicate: () => void;
}

export default function ContextMenu({
  x,
  y,
  item,
  today,
  sections,
  onClose,
  onDelete,
  onSetDueDate,
  onMoveSection,
  onEditStart,
  onSetPriority,
  onDuplicate,
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
  const left = Math.min(x, window.innerWidth - 240);
  const top = Math.min(y, window.innerHeight - 380);

  // Helper for tomorrow
  const getTomorrowDate = () => shiftDateStr(today, 1);

  // Helper for next weekend (Saturday)
  const getNextWeekend = () => {
    const [y_val, m_val, d_val] = today.split('-').map(Number);
    const date = new Date(Date.UTC(y_val, m_val - 1, d_val));
    const day = date.getUTCDay(); // 0 is Sunday, 6 is Saturday
    const daysToAdd = day === 0 ? 6 : 6 - day + (day === 6 ? 7 : 0);
    return shiftDateStr(today, daysToAdd);
  };

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left, top, zIndex: 10000, minWidth: 230 }}
      className="max-h-[420px] w-60 overflow-y-auto rounded-2xl border border-border-custom bg-surface/95 p-1.5 shadow-2xl backdrop-blur-xl flex flex-col gap-0.5 text-[12px] text-text-secondary select-none"
    >
      {/* 1. Edytuj */}
      <button
        onClick={() => {
          onEditStart();
          onClose();
        }}
        className="flex w-full items-center justify-between px-3 py-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-text-primary/[0.04] transition-colors cursor-pointer font-semibold"
      >
        <div className="flex items-center gap-2.5">
          <Pencil size={14} className="text-text-muted/60" />
          <span>Edytuj</span>
        </div>
        <span className="text-[9px] text-text-muted/40 font-mono tracking-wider">Ctrl E</span>
      </button>

      <div className="mx-2 my-0.5 border-t border-border-custom/40" />

      {/* 2. Termin picker container */}
      <div className="px-3 py-1.5 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-text-muted/50">
          <span>Termin</span>
          <span className="font-mono">T</span>
        </div>
        <div className="flex gap-1">
          {/* Dziś */}
          <button
            onClick={() => {
              onSetDueDate(today);
              onClose();
            }}
            className="flex-1 h-8 rounded-lg border border-border-custom/80 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-text-primary/[0.04] hover:border-text-primary/10 transition-all cursor-pointer"
            title="Dziś"
          >
            <Calendar size={14} className="text-emerald-500" />
          </button>
          {/* Jutro */}
          <button
            onClick={() => {
              onSetDueDate(getTomorrowDate());
              onClose();
            }}
            className="flex-1 h-8 rounded-lg border border-border-custom/80 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-text-primary/[0.04] hover:border-text-primary/10 transition-all cursor-pointer"
            title="Jutro"
          >
            <Sun size={14} className="text-amber-500" />
          </button>
          {/* Następny weekend */}
          <button
            onClick={() => {
              onSetDueDate(getNextWeekend());
              onClose();
            }}
            className="flex-1 h-8 rounded-lg border border-border-custom/80 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-text-primary/[0.04] hover:border-text-primary/10 transition-all cursor-pointer"
            title="Następny weekend"
          >
            <CalendarDays size={14} className="text-sky-500" />
          </button>
          {/* Wyczyść termin */}
          <button
            onClick={() => {
              onSetDueDate(null);
              onClose();
            }}
            className="flex-1 h-8 rounded-lg border border-border-custom/80 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-text-primary/[0.04] hover:border-text-primary/10 transition-all cursor-pointer"
            title="Brak terminu"
          >
            <MoreHorizontal size={14} className="text-text-muted/60" />
          </button>
        </div>
      </div>

      <div className="mx-2 my-0.5 border-t border-border-custom/40" />

      {/* 3. Priorytet picker container */}
      <div className="px-3 py-1.5 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-text-muted/50">
          <span>Priorytet</span>
          <span className="font-mono">Y</span>
        </div>
        <div className="flex gap-1">
          {['urgent', 'high', 'normal', 'low'].map((p) => {
            const active = item.priority === p;
            const flagColor = p === 'urgent' ? 'text-rose-500' : p === 'high' ? 'text-amber-500' : p === 'normal' ? 'text-sky-500' : 'text-text-muted/40';
            const borderActive = active ? 'border-primary bg-primary/5' : 'border-border-custom/80';
            return (
              <button
                key={p}
                onClick={() => {
                  onSetPriority(p);
                  onClose();
                }}
                className={`flex-1 h-8 rounded-lg border ${borderActive} flex items-center justify-center hover:bg-text-primary/[0.04] hover:border-text-primary/10 transition-all cursor-pointer`}
                title={p === 'urgent' ? 'P1' : p === 'high' ? 'P2' : p === 'normal' ? 'P3' : 'P4'}
              >
                <Flag size={14} className={flagColor} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-2 my-0.5 border-t border-border-custom/40" />

      {/* 4. Przenieś do, Duplikuj */}
      <div className="relative group/submenu">
        <button className="flex w-full items-center justify-between px-3 py-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-text-primary/[0.04] transition-colors cursor-pointer font-semibold">
          <div className="flex items-center gap-2.5">
            <FolderInput size={14} className="text-text-muted/60" />
            <span>Przenieś do...</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-text-muted/40 font-mono tracking-wider">V</span>
            <ChevronRight size={11} className="text-text-muted/45" />
          </div>
        </button>

        {/* Submenu for sections picker */}
        <div className="absolute left-full top-0 ml-1 hidden group-hover/submenu:flex flex-col bg-surface border border-border-custom rounded-2xl p-1 shadow-2xl min-w-[160px] max-h-[200px] overflow-y-auto">
          <button
            onClick={() => {
              onMoveSection(null);
              onClose();
            }}
            className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[11px] font-semibold hover:bg-text-primary/[0.04] text-text-secondary hover:text-text-primary cursor-pointer"
          >
            <span>📥 Skrzynka</span>
          </button>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                onMoveSection(s.id);
                onClose();
              }}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[11px] font-semibold hover:bg-text-primary/[0.04] text-text-secondary hover:text-text-primary cursor-pointer"
            >
              <span>📂 {s.name}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => {
          onDuplicate();
          onClose();
        }}
        className="flex w-full items-center justify-between px-3 py-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-text-primary/[0.04] transition-colors cursor-pointer font-semibold"
      >
        <div className="flex items-center gap-2.5">
          <Copy size={14} className="text-text-muted/60" />
          <span>Duplikuj zadanie</span>
        </div>
      </button>

      <div className="mx-2 my-0.5 border-t border-border-custom/40" />

      {/* 5. Usuń */}
      <button
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="flex w-full items-center justify-between px-3 py-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer font-semibold"
      >
        <div className="flex items-center gap-2.5">
          <Trash2 size={14} className="text-rose-500" />
          <span>Usuń</span>
        </div>
        <span className="text-[9px] text-rose-400/40 font-mono tracking-wider">↑ Usuń</span>
      </button>
    </div>
  );
}
