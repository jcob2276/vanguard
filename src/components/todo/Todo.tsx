import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  GripVertical,
  History,
  Link2,
  ListTodo,
  Pencil,
  Plus,
  Repeat2,
  Settings2,
  Shield,
  StickyNote,
  Sparkles,
  Tag,
  Trash2,
  Wallet,
  X,
  Zap,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RECURRENCE_LABELS: Record<string, string> = { daily: 'Codziennie', weekly: 'Co tydzień', monthly: 'Co miesiąc' };
const RECURRENCE_CYCLE = ['', 'daily', 'weekly', 'monthly'] as const;

function nextOccurrenceDate(baseDateStr: string | null, recurrence: string, today: string): string {
  const base = baseDateStr || today;
  const d = new Date(base + 'T00:00:00');
  if (recurrence === 'daily') d.setDate(d.getDate() + 1);
  else if (recurrence === 'weekly') d.setDate(d.getDate() + 7);
  else if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
}
import DataStateNotice from '../core/DataStateNotice';
import {
  createTodoItem,
  listTodoItems,
  listTodoSections,
  setTodoStatus,
  updateTodoItem,
} from '../../lib/todo';
import { listProjects } from '../../lib/projects';
import { parseTodoQuickInput } from '../../lib/todoParser';
import { supabase } from '../../lib/supabase';
import type { ReactNode } from 'react';

// ─── Constants ───────────────────────────────────────────────────────────────

const GOAL_ICON: Record<string, typeof Shield> = { cialo: Shield, duch: Zap, konto: Wallet };
const GOAL_COLOR: Record<string, string> = {
  cialo: 'text-emerald-500/50',
  duch:  'text-indigo-500/50',
  konto: 'text-amber-500/50',
};

const PRIORITY_ORDER = ['low', 'normal', 'high', 'urgent'];

const PRIORITY: Record<string, { ring: string; fill: string; chip: string; label: string }> = {
  low:    { ring: 'border-emerald-400', fill: 'bg-emerald-500', chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: 'Quick Win' },
  normal: { ring: 'border-sky-400',     fill: 'bg-sky-500',     chip: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',            label: 'Focus' },
  high:   { ring: 'border-violet-500',  fill: 'bg-violet-500',  chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',   label: 'Deep Work' },
  urgent: { ring: 'border-rose-500',    fill: 'bg-rose-500',    chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',         label: 'Urgent' },
};


// Detect leading emoji in task title (e.g. "🏃 Bieganie" → icon="🏃", label="Bieganie")
const EMOJI_RE = /^(\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|️|‍\p{Extended_Pictographic})*)\s*/u;
function splitEmoji(title: string) {
  const m = title.match(EMOJI_RE);
  return m ? { icon: m[1], label: title.slice(m[0].length) } : { icon: null, label: title };
}

function relativeDate(dateStr: string | null | undefined, today: string) {
  if (!dateStr) return null;
  if (dateStr === today) return { text: 'Dziś', color: 'text-emerald-500' };
  const diff = Math.round((new Date(dateStr + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000);
  if (diff < 0) return { text: `${Math.abs(diff)}d po terminie`, color: 'text-rose-500 font-black' };
  if (diff === 1) return { text: 'Jutro', color: 'text-sky-500' };
  if (diff <= 7) return { text: `za ${diff} dni`, color: 'text-text-muted' };
  return { text: format(new Date(dateStr + 'T00:00:00'), 'd MMM'), color: 'text-text-muted' };
}

const parseSubtasks = (notes: string | null) => {
  if (!notes) return { description: '', subtasks: [] };
  const subtasks: Array<{ id: number; checked: boolean; text: string }> = [];
  const descLines: string[] = [];
  notes.split('\n').forEach((line, index) => {
    const m = line.match(/^\s*[-*]\s+\[([ xX])\]\s*(.*)$/);
    if (m) subtasks.push({ id: index, checked: m[1].toLowerCase() === 'x', text: m[2].trim() });
    else descLines.push(line);
  });
  return { description: descLines.join('\n').trim(), subtasks };
};

const serializeSubtasks = (description: string, subtasks: Array<{ checked: boolean; text: string }>) => {
  const d = description.trim();
  const s = subtasks.map(st => `- [${st.checked ? 'x' : ' '}] ${st.text}`).join('\n');
  if (d && s) return `${d}\n\n${s}`;
  return d || s;
};

// ─── ContextMenu ─────────────────────────────────────────────────────────────

interface ContextMenuProps {
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

function ContextMenu({ x, y, item, today, sections, onClose, onComplete, onDrop, onMoveToToday, onClearDueDate, onMoveSection }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const closeKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => {
      document.addEventListener('mousedown', close);
      document.addEventListener('touchstart', close);
      document.addEventListener('keydown', closeKey);
    }, 10);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', closeKey);
    };
  }, [onClose]);

  // Keep menu inside viewport
  const left = Math.min(x, window.innerWidth - 220);
  const top = Math.min(y, window.innerHeight - 300);

  const MenuItem = ({ icon, label, onClick, danger = false }: { icon: ReactNode; label: ReactNode; onClick: () => void; danger?: boolean }) => (
    <button
      onClick={() => { onClick(); onClose(); }}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-[12px] font-semibold transition-colors hover:bg-surface-solid/80 ${danger ? 'text-rose-400 hover:bg-rose-500/10' : 'text-text-primary'}`}
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
        <MenuItem icon={item.status === 'done' ? '↩️' : '✅'} label={item.status === 'done' ? 'Cofnij ukończenie' : 'Oznacz jako gotowe'} onClick={onComplete} />
        <div className="mx-3 my-1 border-t border-border-custom/30" />
        <MenuItem icon="🔥" label="Przenieś na Dziś" onClick={onMoveToToday} />
        {item.due_date && <MenuItem icon="❌" label="Usuń termin" onClick={onClearDueDate} />}
        
        <div className="mx-3 my-1 border-t border-border-custom/30" />
        <p className="px-4 py-1 text-[9px] font-bold uppercase tracking-wider text-text-muted/65">Sekcja</p>
        <MenuItem icon="📥" label="Skrzynka (brak sekcji)" onClick={() => onMoveSection(null)} />
        {sections.map((s) => (
          <MenuItem key={s.id} icon="📂" label={s.name} onClick={() => onMoveSection(s.id)} />
        ))}
        
        <div className="mx-3 my-1 border-t border-border-custom/30" />
        <MenuItem icon="🗑" label="Odpuść zadanie" onClick={onDrop} danger />
      </div>
    </div>
  );
}

// ─── DragGhost ────────────────────────────────────────────────────────────────

interface DragGhostProps {
  item: any;
  posRef: React.MutableRefObject<{ x: number; y: number }>;
}

function DragGhost({ item, posRef }: DragGhostProps) {
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
      style={{ position: 'fixed', left: 0, top: 0, width: '80vw', maxWidth: '310px', zIndex: 9999, pointerEvents: 'none', willChange: 'transform', opacity: 0.93 }}
      className="rounded-2xl border border-primary/30 bg-surface/95 shadow-2xl px-4 py-3 backdrop-blur-xl"
    >
      <div className="flex items-center gap-3">
        {icon
          ? <span className="text-[20px] leading-none">{icon}</span>
          : <div className={`h-4 w-4 rounded-full border-2 shrink-0 ${PRIORITY[item.priority]?.ring ?? 'border-sky-400'}`} />
        }
        <p className="text-[13px] font-semibold text-text-primary truncate">{label}</p>
      </div>
    </div>
  );
}

// ─── BucketHeader ─────────────────────────────────────────────────────────────

interface BucketHeaderProps {
  icon: string;
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  isDropTarget: boolean;
}

function BucketHeader({ icon, title, count, collapsed, onToggle, isDropTarget }: BucketHeaderProps) {
  return (
    <button
      onClick={onToggle}
      className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 transition-all duration-200 ${
        isDropTarget ? 'bg-primary/12 ring-2 ring-primary/20 scale-[1.01]' : 'hover:bg-surface-solid/40'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[16px] leading-none">{icon}</span>
        <span className={`text-[15px] font-semibold transition-colors ${isDropTarget ? 'text-primary' : 'text-text-primary'}`}>
          {title}
        </span>
        {count > 0 && (
          <span className="rounded-full bg-text-primary/[0.07] px-2 py-0.5 text-[12px] font-semibold tabular-nums text-text-secondary">
            {count}
          </span>
        )}
      </div>
      {collapsed
        ? <ChevronRight size={14} className="text-text-muted/40 shrink-0" />
        : <ChevronDown size={14} className="text-text-muted/40 shrink-0" />}
    </button>
  );
}

// ─── TodoCard ────────────────────────────────────────────────────────────────

interface TodoCardProps {
  item: any;
  onToggle: () => void;
  onDrop: () => void;
  onSetPriority: (p: string) => void;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
  onToggleSubtask: (index: number) => void;
  onAddSubtask: (text: string) => void;
  onDeleteSubtask: (index: number) => void;
  busy: boolean;
  today: string;
  isLinkedToPlan: boolean;
  sections: any[];
  onMoveSection: (sId: string | null) => void;
  isEditing: boolean;
  editingTitle: string;
  onEditStart: (t: string) => void;
  onEditChange: (val: string) => void;
  onEditSave: () => void;
  sectionName?: string | null;
  sectionGoalKey?: string | null;
  onDragStart?: (item: any, clientX: number, clientY: number) => void;
  isDragging: boolean;
  onShowContextMenu: (item: any, clientX: number, clientY: number) => void;
  onMoveToToday?: () => void;
  onSetRecurrence: (r: string | null) => void;
  dreamTitle?: string | null;
}

function TodoCard({
  item, onToggle, onDrop, onSetPriority,
  expanded, onToggleExpand,
  onToggleSubtask, onAddSubtask, onDeleteSubtask,
  busy, today,
  isLinkedToPlan, sections, onMoveSection,
  isEditing, editingTitle, onEditStart, onEditChange, onEditSave,
  sectionName, sectionGoalKey, onDragStart, isDragging,
  onShowContextMenu,
  onMoveToToday, onSetRecurrence,
  dreamTitle,
}: TodoCardProps) {
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null);
  const [newSubtask, setNewSubtask] = useState('');
  const [completing, setCompleting] = useState(false);
  const longPressTimer = useRef<any>(null);
  const gripLongPressTimer = useRef<any>(null);

  const { description, subtasks } = useMemo(() => parseSubtasks(item.notes), [item.notes]);
  const doneCount = subtasks.filter(s => s.checked).length;
  const p = PRIORITY[item.priority] ?? PRIORITY.normal;
  const isDone = item.status === 'done';
  const { icon, label } = splitEmoji(item.title);
  const dateInfo = relativeDate(item.due_date, today);

  // ── Touch swipe (card body) ──
  const onTouchStart = (e: React.TouchEvent) => {
    if (isDragging) return;
    const t = e.targetTouches[0];
    setTouchStartX(t.clientX);
    setTouchStartY(t.clientY);
    // Long press on card body → context menu
    longPressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(20);
      onShowContextMenu(item, t.clientX, t.clientY);
    }, 600);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    clearTimeout(longPressTimer.current);
    if (isDragging) return;
    const dx = e.targetTouches[0].clientX - touchStartX;
    const dy = Math.abs(e.targetTouches[0].clientY - touchStartY);
    if (dy > 12) return; // vertical scroll, ignore
    setSwipeOffset(Math.max(-130, Math.min(130, dx)));
    setSwipeDir(dx > 40 ? 'right' : dx < -40 ? 'left' : null);
  };
  const onTouchEnd = () => {
    clearTimeout(longPressTimer.current);
    if (!isDragging) {
      if (swipeOffset > 100) handleComplete();
      else if (swipeOffset < -100) onDrop();
    }
    setSwipeOffset(0); setSwipeDir(null);
  };

  const handleComplete = () => {
    if (isDone) { onToggle(); return; }
    setCompleting(true);
    setTimeout(() => { onToggle(); setCompleting(false); }, 300);
  };

  // ── Grip: long press (mobile) / mousedown (desktop) ──
  const onGripTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    const t = e.touches[0];
    gripLongPressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(35);
      onDragStart?.(item, t.clientX, t.clientY);
    }, 350);
  };
  const onGripTouchEnd = (e: React.TouchEvent) => { e.stopPropagation(); clearTimeout(gripLongPressTimer.current); };
  const onGripTouchMove = (e: React.TouchEvent) => { e.stopPropagation(); clearTimeout(gripLongPressTimer.current); };
  const onGripMouseDown = (e: React.MouseEvent) => { e.preventDefault(); onDragStart?.(item, e.clientX, e.clientY); };

  return (
    <div
      className={`group relative overflow-hidden rounded-[18px] transition-all duration-250 mb-2 ${completing ? 'scale-[0.96] opacity-0 duration-300' : ''} ${isDone ? 'opacity-50' : ''}`}
    >
      {/* Swipe hint overlays */}
      <div className={`absolute inset-0 flex items-center justify-start pl-5 text-emerald-500 pointer-events-none transition-opacity duration-150 ${swipeDir === 'right' ? 'opacity-100' : 'opacity-0'}`}>
        <Check size={18} strokeWidth={3} />
      </div>
      <div className={`absolute inset-0 flex items-center justify-end pr-5 text-rose-400 pointer-events-none transition-opacity duration-150 ${swipeDir === 'left' ? 'opacity-100' : 'opacity-0'}`}>
        <X size={18} />
      </div>

      {/* Card */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onContextMenu={(e) => { e.preventDefault(); onShowContextMenu(item, e.clientX, e.clientY); }}
        style={{ transform: `translateX(${swipeOffset}px)` }}
        className="relative rounded-[18px] px-4 py-3.5 bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.07),0_2px_14px_rgba(0,0,0,0.04)] transition-all duration-150 ease-out
          hover:shadow-[0_3px_14px_rgba(0,0,0,0.10)] dark:shadow-[0_1px_6px_rgba(0,0,0,0.25),0_2px_18px_rgba(0,0,0,0.18)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
      >
        <div className="flex items-start gap-3">

          {/* Drag grip */}
          <div
            onTouchStart={onGripTouchStart}
            onTouchEnd={onGripTouchEnd}
            onTouchMove={onGripTouchMove}
            onMouseDown={onGripMouseDown}
            className="mt-0.5 shrink-0 touch-none cursor-grab text-text-muted/15 group-hover:text-text-muted/35 transition-colors select-none"
          >
            <GripVertical size={14} />
          </div>

          {/* Emoji icon OR priority circle checkbox */}
          {icon ? (
            <button onClick={(e) => { e.stopPropagation(); handleComplete(); }} disabled={busy} className="shrink-0 mt-0.5">
              <span className={`flex h-[26px] w-[26px] items-center justify-center rounded-xl text-[18px] leading-none transition-all ${isDone ? 'grayscale opacity-40' : ''}`}>
                {icon}
              </span>
            </button>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); handleComplete(); }} disabled={busy} className="mt-0.5 shrink-0">
              <div className={`h-[22px] w-[22px] rounded-full border-[2px] flex items-center justify-center transition-all duration-250 ${
                isDone ? `${p.fill} border-transparent` : `${p.ring} bg-transparent`
              }`}>
                {isDone && <Check size={11} className="text-white" strokeWidth={3} />}
              </div>
            </button>
          )}

          {/* Content */}
          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onToggleExpand(item.id)}>
            <p className={`text-[15px] font-medium leading-snug transition-colors ${isDone ? 'line-through text-text-muted' : 'text-text-primary'}`}>
              {label}
            </p>

            {/* Metadata */}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {dateInfo && (
                <span className={`flex items-center gap-1 text-[11px] font-medium ${dateInfo.color}`}>
                  <Calendar size={9} />
                  {dateInfo.text}
                </span>
              )}
              {item.recurrence && (
                <span className="flex items-center gap-0.5 text-[10px] font-medium text-primary/60">
                  <Repeat2 size={9} /> {RECURRENCE_LABELS[item.recurrence]}
                </span>
              )}
              {subtasks.length > 0 && (
                <span className="text-[11px] font-medium text-text-muted/60">
                  {doneCount}/{subtasks.length}
                </span>
              )}
              {(item.tags || []).map((tag: string) => (
                <span key={tag} className="text-[10px] font-medium text-text-muted/50">#{tag}</span>
              ))}
              {isLinkedToPlan && (
                <span className="flex items-center gap-0.5 text-[10px] font-medium text-primary/70">
                  <Link2 size={8} /> Plan
                </span>
              )}
              {sectionName && (() => {
                const GoalIcon = sectionGoalKey ? GOAL_ICON[sectionGoalKey] : null;
                return (
                  <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span className="flex items-center gap-1">
                      {GoalIcon && <GoalIcon size={8} className={GOAL_COLOR[sectionGoalKey!]} />}
                      <span className="text-[10px] font-medium text-text-muted/30 uppercase tracking-wider">{sectionName}</span>
                    </span>
                    {dreamTitle && (
                      <span className="text-[10px] font-semibold text-primary/45 truncate max-w-[150px]" title={`Marzenie: ${dreamTitle}`}>
                        ↳ {dreamTitle}
                      </span>
                    )}
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Quick "→ Dziś" action */}
          {onMoveToToday && !isDone && (
            <div className="mt-2 flex justify-end">
              <button
                onClick={(e) => { e.stopPropagation(); onMoveToToday(); }}
                className="flex items-center gap-1 rounded-full bg-orange-500/10 px-3 py-1 text-[11px] font-semibold text-orange-500 hover:bg-orange-500/20 transition-colors"
              >
                🔥 Przesuń na dziś
              </button>
            </div>
          )}
        </div>

        {/* Expanded */}
        {expanded && (
          <div className="mt-3.5 space-y-3.5 border-t border-border-custom/40 pt-3.5" onClick={(e) => e.stopPropagation()}>

            {/* Inline title edit */}
            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-text-muted">Tytuł</p>
              {isEditing ? (
                <input
                  autoFocus value={editingTitle}
                  onChange={(e) => onEditChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') onEditSave(); }}
                  onBlur={onEditSave}
                  className="w-full rounded-xl border border-primary/30 bg-surface-solid px-3 py-2 text-[13px] font-semibold text-text-primary outline-none ring-2 ring-primary/15"
                />
              ) : (
                <button
                  onClick={() => onEditStart(item.title)}
                  className="group/ed flex w-full items-center justify-between gap-2 rounded-xl border border-transparent px-3 py-2 text-left hover:border-border-custom hover:bg-surface-solid transition-colors"
                >
                  <span className="text-[13px] font-semibold text-text-primary">{item.title}</span>
                  <Pencil size={11} className="shrink-0 text-text-muted opacity-0 group-hover/ed:opacity-100" />
                </button>
              )}
            </div>

            {description && (
              <p className="rounded-xl border border-border-custom/40 bg-surface-solid/50 px-3 py-2.5 text-[11px] leading-relaxed text-text-secondary whitespace-pre-wrap">{description}</p>
            )}

            {/* Priority grid */}
            <div>
              <p className="mb-1.5 text-[8px] font-black uppercase tracking-widest text-text-muted">Priorytet</p>
              <div className="grid grid-cols-4 gap-1">
                {PRIORITY_ORDER.map((pid) => {
                  const pr = PRIORITY[pid];
                  const active = item.priority === pid;
                  return (
                    <button
                      key={pid}
                      onClick={() => onSetPriority(pid)}
                      className={`rounded-xl border py-2 text-[8px] font-black uppercase tracking-wide transition-all ${
                        active ? `${pr.chip} border-transparent scale-[1.02]` : 'border-border-custom/50 text-text-muted hover:border-border-custom'
                      }`}
                    >
                      {pr.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recurrence */}
            {onSetRecurrence && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-text-muted">Powtarzanie</p>
                <div className="flex gap-1.5">
                  {(['', 'daily', 'weekly', 'monthly'] as const).map((r) => (
                    <button
                      key={r || 'none'}
                      onClick={() => onSetRecurrence(r)}
                      className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                        (item.recurrence || '') === r
                          ? 'border-primary/20 bg-primary/10 text-primary'
                          : 'border-border-custom/50 text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {r === '' ? 'Nie' : r === 'daily' ? '↺ Dzień' : r === 'weekly' ? '↺ Tydzień' : '↺ Miesiąc'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Section picker */}
            {sections.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-text-muted">Sekcja</p>
                <div className="flex flex-wrap gap-1.5">
                  {sections.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => onMoveSection(s.id)}
                      className={`rounded-full border px-2.5 py-1 text-[9px] font-black transition-colors ${
                        item.section_id === s.id ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border-custom bg-surface-solid text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Subtasks */}
            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-text-muted">Podzadania</p>
              <div className="space-y-1">
                {subtasks.map((st, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 rounded-xl border border-border-custom/30 bg-surface-solid/40 px-3 py-2">
                    <button onClick={() => onToggleSubtask(idx)} className="shrink-0">
                      <div className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
                        st.checked ? 'bg-emerald-500 border-emerald-500' : 'border-border-custom'
                      }`}>
                        {st.checked && <Check size={8} className="text-white" strokeWidth={3} />}
                      </div>
                    </button>
                    <span className={`min-w-0 flex-1 text-[11px] font-medium truncate ${st.checked ? 'line-through text-text-muted' : 'text-text-primary'}`}>{st.text}</span>
                    <button onClick={() => onDeleteSubtask(idx)} className="shrink-0 text-text-muted/30 hover:text-rose-400 transition-colors">
                      <X size={11} />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2 pt-0.5">
                  <input
                    placeholder="Nowe podzadanie..."
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && newSubtask.trim()) { onAddSubtask(newSubtask); setNewSubtask(''); } }}
                    className="min-w-0 flex-1 rounded-xl border border-border-custom/50 bg-surface-solid/40 px-3 py-2 text-[11px] font-medium text-text-primary outline-none placeholder:text-text-muted/35 focus:border-primary/30"
                  />
                  <button
                    onClick={() => { if (newSubtask.trim()) { onAddSubtask(newSubtask); setNewSubtask(''); } }}
                    disabled={!newSubtask.trim()}
                    className="rounded-xl bg-primary/90 px-3 py-2 text-[9px] font-black text-white disabled:opacity-30 hover:bg-primary transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={onDrop}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/15 bg-rose-500/5 py-2.5 text-[9px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 size={10} /> Odpuść zadanie
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Todo (main) ──────────────────────────────────────────────────────────────

export default function Todo({ session, onBack, onNavigateTo }: { session: any; onBack: () => void; onNavigateTo?: (dest: string) => void }) {
  const userId = session?.user?.id;
  const [sections, setSections] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [dreams, setDreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [linkedPlanIds, setLinkedPlanIds] = useState<Set<string>>(new Set());

  // Filters
  const [activeFilterTag, setActiveFilterTag] = useState<string | null>(null);
  const [activeFilterSection, setActiveFilterSection] = useState<string | null>(null);

  // Options toggling
  const [showOptions, setShowOptions] = useState(false);

  const toggleExpand = useCallback((id: string) => setExpandedId(prev => prev === id ? null : id), []);

  const goTo = (dest: 'todo' | 'keep' | 'links') => {
    if (onNavigateTo) onNavigateTo(dest);
  };
  const [form, setForm] = useState({ title: '', notes: '', priority: 'normal', tagsText: '', due_date: '', recurrence: '', section_id: '' });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: any } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const quickCaptureRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [draggingItem, setDraggingItem] = useState<any | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const dragPosRef = useRef({ x: 0, y: 0 });
  const dragItemRef = useRef<any | null>(null);
  
  const todayZoneRef = useRef<HTMLDivElement>(null);
  const inboxZoneRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const toggleSectionCollapse = (id: string) => { setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] })); };

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
  const nextWeek = (() => {
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
  })();

  const fetchAll = useCallback(async () => {
    const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    try {
      const [s, i, { data: winData }, p, { data: d }] = await Promise.all([
        listTodoSections(userId),
        listTodoItems(userId),
        supabase.from('daily_wins').select('task_1_todo_id,task_2_todo_id,task_3_todo_id,task_4_todo_id,task_5_todo_id').eq('user_id', userId).eq('date', todayDate).maybeSingle(),
        listProjects(userId),
        supabase.from('dreams').select('id, title, life_goal').eq('user_id', userId),
      ]);
      setSections(s || []);
      setItems(i || []);
      setProjects(p || []);
      setDreams(d || []);
      if (winData) {
        const winDataAny = winData as any;
        setLinkedPlanIds(new Set([1,2,3,4,5].map((n) => winDataAny[`task_${n}_todo_id`]).filter(Boolean)));
      }
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  }, [userId]);

  useEffect(() => {
    (async () => { setLoading(true); await fetchAll(); setLoading(false); })();
  }, [fetchAll]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (quickCaptureRef.current && !quickCaptureRef.current.contains(e.target as Node)) {
        if (form.title.trim() === '') {
          setIsExpanded(false);
        }
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [form.title]);

  // ── Drag tracking ──
  const getSectionAtPoint = useCallback((x: number, y: number) => {
    if (todayZoneRef.current) {
      const r = todayZoneRef.current.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return 'today';
    }
    if (inboxZoneRef.current) {
      const r = inboxZoneRef.current.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return 'inbox';
    }
    for (const sec of sections) {
      const el = sectionRefs.current[sec.id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return sec.id;
    }
    return null;
  }, [sections]);

  useEffect(() => {
    if (!draggingItem) return;
    const onMove = (e: any) => {
      e.preventDefault();
      const t = e.touches?.[0] ?? e;
      dragPosRef.current = { x: t.clientX, y: t.clientY };
      const b = getSectionAtPoint(t.clientX, t.clientY);
      setDragTarget((prev) => prev !== b ? b : prev);
    };
    const onEnd = (e: any) => {
      const t = e.changedTouches?.[0] ?? e;
      const target = getSectionAtPoint(t.clientX, t.clientY);
      const item = dragItemRef.current;
      if (target && item) {
        if (target === 'today') {
          const now = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
          setBusy(true);
          updateTodoItem(item.id, { due_date: now, ai_bucket: 'today', ai_classified_at: new Date().toISOString() })
            .then(() => fetchAll())
            .catch((err) => setError(err.message))
            .finally(() => setBusy(false));
        } else if (target === 'inbox') {
          setBusy(true);
          updateTodoItem(item.id, { section_id: null })
            .then(() => fetchAll())
            .catch((err) => setError(err.message))
            .finally(() => setBusy(false));
        } else {
          setBusy(true);
          updateTodoItem(item.id, { section_id: target })
            .then(() => fetchAll())
            .catch((err) => setError(err.message))
            .finally(() => setBusy(false));
        }
      }
      dragItemRef.current = null;
      setDraggingItem(null);
      setDragTarget(null);
    };
    document.addEventListener('mousemove', onMove, { capture: true });
    document.addEventListener('touchmove', onMove, { passive: false, capture: true });
    document.addEventListener('mouseup', onEnd, { capture: true });
    document.addEventListener('touchend', onEnd, { capture: true });
    return () => {
      document.removeEventListener('mousemove', onMove, { capture: true });
      document.removeEventListener('touchmove', onMove, { capture: true });
      document.removeEventListener('mouseup', onEnd, { capture: true });
      document.removeEventListener('touchend', onEnd, { capture: true });
    };
  }, [draggingItem, getSectionAtPoint, fetchAll]);

  // ── Derived ──
  const sectionById = useMemo(() => Object.fromEntries(sections.map((s) => [s.id, s])), [sections]);

  const sectionGoalMap = useMemo(() => {
    const result: Record<string, string> = {};
    for (const sec of sections) {
      if (!sec.project_id) continue;
      const proj = projects.find(p => p.id === sec.project_id);
      if (!proj || !proj.dream_id) continue;
      const dream = dreams.find(d => d.id === proj.dream_id);
      const goal = dream?.life_goal;
      if (goal) result[sec.id] = goal;
    }
    return result;
  }, [sections, projects, dreams]);

  const sectionDreamMap = useMemo(() => {
    const result: Record<string, string> = {};
    for (const sec of sections) {
      if (!sec.project_id) continue;
      const proj = projects.find(p => p.id === sec.project_id);
      if (!proj || !proj.dream_id) continue;
      const dream = dreams.find(d => d.id === proj.dream_id);
      if (dream?.title) result[sec.id] = dream.title;
    }
    return result;
  }, [sections, projects, dreams]);
  const parsedInput = useMemo(() => parseTodoQuickInput(form.title), [form.title]);
  const openItems = useMemo(() => items.filter((i) => i.status === 'open'), [items]);
  const doneItems = useMemo(() => items.filter((i) => i.status === 'done'), [items]);

  const allUniqueTags = useMemo(() => Array.from(new Set(openItems.flatMap(i => i.tags || []))).sort(), [openItems]);

  const applyFilter = useCallback((arr: any[]) => arr.filter(i => {
    if (activeFilterTag && !(i.tags || []).includes(activeFilterTag)) return false;
    if (activeFilterSection && i.section_id !== activeFilterSection) return false;
    return true;
  }), [activeFilterTag, activeFilterSection]);

  const { todayItems, inboxItems, sectionsWithItems } = useMemo(() => {
    const todayList = openItems.filter((i: any) => i.due_date === today || i.ai_bucket === 'today');
    const todaySet = new Set(todayList.map(i => i.id));
    const remainingItems = openItems.filter((i: any) => !todaySet.has(i.id));
    const inbox = applyFilter(remainingItems.filter((i: any) => i.section_id === null));
    const sectionsMap: Record<string, any[]> = {};
    sections.forEach(s => { sectionsMap[s.id] = []; });
    remainingItems.forEach((i: any) => {
      if (i.section_id && sectionsMap[i.section_id] !== undefined) {
        sectionsMap[i.section_id].push(i);
      }
    });
    const sectionsList = sections.map(s => ({
      ...s,
      items: applyFilter(sectionsMap[s.id] || [])
    }));
    return {
      todayItems: applyFilter(todayList),
      inboxItems: inbox,
      sectionsWithItems: sectionsList
    };
  }, [openItems, sections, today, applyFilter]);

  // ── Actions ──
  const run = async (fn: () => Promise<any> | any) => {
    setBusy(true);
    try { await fn(); await fetchAll(); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };

  const classifyInBackground = useCallback((item: any) => {
    const base = import.meta.env.VITE_SUPABASE_URL;
    fetch(`${base}/functions/v1/vanguard-todo-classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ itemId: item.id, userId, title: item.title, notes: item.notes || undefined, due_date: item.due_date || undefined, priority: item.priority !== 'normal' ? item.priority : undefined }),
    }).then(() => setTimeout(fetchAll, 200)).catch(() => {});
  }, [userId, session.access_token, fetchAll]);

  const addItem = () => {
    const title = parsedInput.title || form.title.trim();
    if (!title) return;
    run(async () => {
      const targetSectionId = form.section_id || activeFilterSection || undefined;
      const newItem = await createTodoItem(userId, {
        ...form,
        title,
        priority: parsedInput.priority || form.priority,
        due_date: parsedInput.due_date || form.due_date,
        section_id: targetSectionId,
        recurrence: form.recurrence || undefined
      });
      setForm({ title: '', notes: '', priority: 'normal', tagsText: '', due_date: '', recurrence: '', section_id: '' });
      setShowOptions(false);
      if (!parsedInput.due_date && !parsedInput.priority) classifyInBackground(newItem);
    });
  };

  const toggleSubtask = (item: any, idx: number) => {
    const { description, subtasks } = parseSubtasks(item.notes);
    run(() => updateTodoItem(item.id, { notes: serializeSubtasks(description, subtasks.map((st: any, i: number) => i === idx ? { ...st, checked: !st.checked } : st)) }));
  };
  const addSubtask = (item: any, text: string) => {
    if (!text.trim()) return;
    const { description, subtasks } = parseSubtasks(item.notes);
    run(() => updateTodoItem(item.id, { notes: serializeSubtasks(description, [...subtasks, { checked: false, text: text.trim() }]) }));
  };
  const deleteSubtask = (item: any, idx: number) => {
    const { description, subtasks } = parseSubtasks(item.notes);
    run(() => updateTodoItem(item.id, { notes: serializeSubtasks(description, subtasks.filter((_, i) => i !== idx)) }));
  };
  const saveEditTitle = (item: any) => {
    const title = editingTitle.trim();
    if (title && title !== item.title) run(() => updateTodoItem(item.id, { title }));
    setEditingId(null); setEditingTitle('');
  };

  const handleDragStart = useCallback((item: any, x: number, y: number) => {
    dragItemRef.current = item;
    dragPosRef.current = { x, y };
    setDraggingItem(item);
  }, []);

  const showContextMenu = useCallback((item: any, x: number, y: number) => {
    setContextMenu({ x, y, item });
    setExpandedId(null);
  }, []);

  const handleComplete = useCallback((item: any) => {
    const newStatus = item.status === 'done' ? 'open' : 'done';
    run(async () => {
      await setTodoStatus(item, newStatus);
      if (newStatus === 'done' && item.recurrence) {
        const nextDate = nextOccurrenceDate(item.due_date, item.recurrence, today);
        await createTodoItem(userId, {
          title: item.title, notes: item.notes, priority: item.priority,
          tagsText: (item.tags || []).join(', '), section_id: item.section_id,
          due_date: nextDate, recurrence: item.recurrence,
        });
      }
    });
  }, [today, userId]);

  const renderCard = (item: any, { inToday = false }: { inToday?: boolean } = {}) => (
    <TodoCard
      key={item.id}
      item={item}
      busy={busy}
      today={today}
      expanded={expandedId === item.id}
      onToggleExpand={toggleExpand}
      onToggle={() => handleComplete(item)}
      onSetPriority={(pid: string) => { if (pid !== item.priority) run(() => updateTodoItem(item.id, { priority: pid })); }}
      onDrop={() => run(() => setTodoStatus(item, 'dropped'))}
      onToggleSubtask={(idx: number) => toggleSubtask(item, idx)}
      onAddSubtask={(text: string) => addSubtask(item, text)}
      onDeleteSubtask={(idx: number) => deleteSubtask(item, idx)}
      isLinkedToPlan={linkedPlanIds.has(item.id)}
      sections={sections}
      onMoveSection={(sId: string | null) => { if (sId !== item.section_id) run(() => updateTodoItem(item.id, { section_id: sId })); }}
      isEditing={editingId === item.id}
      editingTitle={editingTitle}
      onEditStart={(t: string) => { setEditingId(item.id); setEditingTitle(t); }}
      onEditChange={setEditingTitle}
      onEditSave={() => saveEditTitle(item)}
      sectionName={item.section_id ? sectionById[item.section_id]?.name : null}
      sectionGoalKey={item.section_id ? sectionGoalMap[item.section_id] ?? null : null}
      dreamTitle={item.section_id ? sectionDreamMap[item.section_id] ?? null : null}
      onDragStart={handleDragStart}
      isDragging={draggingItem !== null}
      onShowContextMenu={showContextMenu}
      onMoveToToday={!inToday ? () => run(() => updateTodoItem(item.id, { due_date: today, ai_bucket: 'today', ai_classified_at: new Date().toISOString() })) : undefined}
      onSetRecurrence={(r: string | null) => run(() => updateTodoItem(item.id, { recurrence: r || undefined }))}
    />
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <DataStateNotice tone="loading" title="Zadania się ładują" detail="Pobieram otwarte zadania." />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-text-primary">
      {draggingItem && <DragGhost item={draggingItem} posRef={dragPosRef} />}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          today={today}
          sections={sections}
          onClose={() => setContextMenu(null)}
          onComplete={() => run(() => setTodoStatus(contextMenu.item, contextMenu.item.status === 'done' ? 'open' : 'done'))}
          onDrop={() => run(() => setTodoStatus(contextMenu.item, 'dropped'))}
          onMoveToToday={() => run(() => updateTodoItem(contextMenu.item.id, { due_date: today, ai_bucket: 'today', ai_classified_at: new Date().toISOString() }))}
          onClearDueDate={() => run(() => updateTodoItem(contextMenu.item.id, { due_date: null, ai_bucket: null }))}
          onMoveSection={(sId: string | null) => run(() => updateTodoItem(contextMenu.item.id, { section_id: sId }))}
        />
      )}

      {/* Sidebar */}
      <aside className="keep-sidebar">
        <p className="keep-sidebar-section-label">Workspace</p>
        <button className="keep-sidebar-item" onClick={() => goTo('keep')}>
          <StickyNote size={15} />
          <span>Notatki</span>
        </button>
        <button className="keep-sidebar-item active">
          <ListTodo size={15} />
          <span>Zadania</span>
        </button>
        <button className="keep-sidebar-item" onClick={() => goTo('links')}>
          <BookOpen size={15} />
          <span>Pocket</span>
        </button>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-custom/60 bg-background/90 px-5 py-4 backdrop-blur-xl">
          <button onClick={onBack} className="flex items-center gap-1 text-primary font-medium text-[16px]">
            <ChevronLeft size={22} strokeWidth={2.5} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[20px] font-bold text-text-primary tracking-tight">Zadania</h1>
          </div>
          <button
            onClick={() => setShowDone((v) => !v)}
            className={`rounded-full p-2 transition-colors ${showDone ? 'text-primary bg-primary/10' : 'text-text-muted hover:text-text-primary hover:bg-surface'}`}
            title="Historia"
          >
            <History size={17} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[600px] mx-auto space-y-4 px-6 py-5 pb-24">
            {error && <DataStateNotice tone="warning" title="Błąd" detail={error} />}

            {/* Quick capture */}
            <div ref={quickCaptureRef} className="rounded-[18px] bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.07),0_2px_14px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_6px_rgba(0,0,0,0.25),0_2px_18px_rgba(0,0,0,0.18)] p-4">
              <div className="flex items-center gap-2">
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
                  onFocus={() => setIsExpanded(true)}
                  placeholder="Dodaj zadanie..."
                  className="min-w-0 flex-1 bg-transparent px-1 py-2 text-[16px] font-semibold text-text-primary outline-none placeholder:text-text-muted/35"
                />
                {form.title && (
                  <button
                    onClick={() => setForm({ ...form, title: '' })}
                    className="p-1 text-text-muted/40 hover:text-text-primary transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
                {!isExpanded && (
                  <button
                    onClick={() => setIsExpanded(true)}
                    className="rounded-full border border-border-custom/60 text-text-muted hover:text-text-primary p-2 transition-colors shrink-0"
                  >
                    <Settings2 size={16} />
                  </button>
                )}
                <button
                  onClick={addItem}
                  disabled={busy || !form.title.trim()}
                  className="rounded-full bg-primary p-2 text-white shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-95 disabled:opacity-35 transition-all shrink-0"
                >
                  <Plus size={16} />
                </button>
              </div>

              {(isExpanded || form.title.trim() !== '' || showOptions) && (
                <div className="mt-3 space-y-3 border-t border-border-custom pt-3">
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    placeholder="Opis... (podzadania: - [ ] krok)"
                    className="w-full resize-none rounded-xl border border-border-custom/60 bg-surface-solid/50 px-3 py-2.5 text-[12px] font-medium text-text-primary outline-none placeholder:text-text-muted/30 focus:border-primary/30"
                  />
                  <div className="flex flex-wrap gap-3">
                    {/* Section Selector */}
                    <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
                      <span className="text-[10px] font-semibold text-text-muted">Sekcja</span>
                      <select
                        value={form.section_id || ''}
                        onChange={(e) => setForm({ ...form, section_id: e.target.value })}
                        className="rounded-xl border border-border-custom/60 bg-surface-solid/50 px-2.5 py-2 text-[12px] font-semibold text-text-secondary outline-none focus:border-primary/30 cursor-pointer"
                      >
                        <option value="">📥 Skrzynka (brak sekcji)</option>
                        {sections.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Priority Buttons */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-text-muted">Priorytet</span>
                      <div className="flex gap-1">
                        {['urgent', 'high', 'normal', 'low'].map(p => {
                          const isSelected = (parsedInput.priority || form.priority) === p;
                          const meta = PRIORITY[p];
                          const labelMap: Record<string, string> = { urgent: 'P1', high: 'P2', normal: 'P3', low: 'P4' };
                          return (
                            <button
                              type="button"
                              key={p}
                              onClick={() => setForm(f => ({ ...f, priority: p }))}
                              className={`rounded-xl px-3 py-2 text-[11px] font-bold border transition-all ${
                                isSelected
                                  ? `${meta.chip} border-current ring-1 ring-current`
                                  : 'border-border-custom/60 text-text-muted hover:text-text-primary hover:bg-surface-solid'
                              }`}
                            >
                              {labelMap[p]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Due Date Selector */}
                    <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                      <span className="text-[10px] font-semibold text-text-muted">Termin</span>
                      <div className="flex gap-1 items-center">
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, due_date: today }))}
                          className={`rounded-xl px-2.5 py-2 text-[11px] font-semibold border transition-all ${
                            (parsedInput.due_date || form.due_date) === today
                              ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20'
                              : 'border-border-custom/60 text-text-muted hover:text-text-primary hover:bg-surface-solid'
                          }`}
                        >
                          Dziś
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            const tomorrowStr = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
                            setForm(f => ({ ...f, due_date: tomorrowStr }));
                          }}
                          className={`rounded-xl px-2.5 py-2 text-[11px] font-semibold border transition-all ${
                            (parsedInput.due_date || form.due_date) === (() => {
                              const tomorrow = new Date();
                              tomorrow.setDate(tomorrow.getDate() + 1);
                              return tomorrow.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
                            })()
                              ? 'bg-sky-500/15 text-sky-500 border-sky-500/20'
                              : 'border-border-custom/60 text-text-muted hover:text-text-primary hover:bg-surface-solid'
                          }`}
                        >
                          Jutro
                        </button>
                        <input
                          type="date"
                          value={parsedInput.due_date || form.due_date}
                          onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                          className="min-w-0 flex-1 rounded-xl border border-border-custom/60 bg-surface-solid/50 px-2 py-1.5 text-[11px] font-bold text-text-secondary outline-none focus:border-primary/30 cursor-pointer"
                        />
                        {(parsedInput.due_date || form.due_date) && (
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, due_date: '' })}
                            className="p-1 text-text-muted hover:text-rose-500 transition-colors"
                            title="Wyczyść datę"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Recurrence Selector */}
                    <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
                      <span className="text-[10px] font-semibold text-text-muted">Powtarzanie</span>
                      <select
                        value={form.recurrence || ''}
                        onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
                        className="rounded-xl border border-border-custom/60 bg-surface-solid/50 px-2.5 py-2 text-[12px] font-semibold text-text-secondary outline-none focus:border-primary/30 cursor-pointer"
                      >
                        <option value="">Nigdy</option>
                        <option value="daily">Codziennie</option>
                        <option value="weekly">Co tydzień</option>
                        <option value="monthly">Co miesiąc</option>
                      </select>
                    </div>

                    {/* Tags Input */}
                    <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
                      <span className="text-[10px] font-semibold text-text-muted">Tagi</span>
                      <input
                        value={form.tagsText}
                        onChange={(e) => setForm({ ...form, tagsText: e.target.value })}
                        placeholder="np. zakup, praca"
                        className="min-w-0 rounded-xl border border-border-custom/60 bg-surface-solid/50 px-3 py-2 text-[12px] font-semibold text-text-primary outline-none placeholder:text-text-muted/30 focus:border-primary/30"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border-custom pt-3">
                    <div>
                      {parsedInput.tokens.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {parsedInput.tokens.map((token) => (
                            <span key={`${token.type}-${token.value}`}
                              className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                                token.type === 'priority' ? (PRIORITY[token.value]?.chip ?? 'bg-surface-solid text-text-muted') : 'bg-primary/10 text-primary'
                              }`}
                            >
                              {token.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setIsExpanded(false); }}
                        className="rounded-xl border border-border-custom/60 px-4 py-2 text-[12px] font-semibold text-text-muted hover:text-text-primary transition-colors"
                      >
                        Zwiń
                      </button>
                      <button
                        type="button"
                        onClick={addItem}
                        disabled={busy || !form.title.trim()}
                        className="rounded-xl bg-primary px-5 py-2 text-[12px] font-bold text-white shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-95 disabled:opacity-35 transition-all"
                      >
                        Dodaj
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Main List */}
            <div className="space-y-4">
              {activeFilterSection ? (
                // Active Section View
                (() => {
                  const sec = sections.find(s => s.id === activeFilterSection);
                  if (!sec) return null;
                  const secItems = items.filter(i => i.status === 'open' && i.section_id === sec.id);
                  const sortedItems = [...secItems].sort((a, b) => {
                    const pA = PRIORITY_ORDER.indexOf(a.priority);
                    const pB = PRIORITY_ORDER.indexOf(b.priority);
                    if (pA !== pB) return pB - pA;
                    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
                    if (a.due_date) return -1;
                    if (b.due_date) return 1;
                    return 0;
                  });

                  return (
                    <div key={sec.id} ref={el => { sectionRefs.current[sec.id] = el; }}>
                      <div className="flex items-center gap-2 px-3 py-2">
                        <span className="text-[16px] leading-none">📂</span>
                        <span className="text-[15px] font-bold text-text-primary">{sec.name}</span>
                        <span className="rounded-full bg-text-primary/[0.07] px-2 py-0.5 text-[12px] font-semibold tabular-nums text-text-secondary">
                          {sortedItems.length}
                        </span>
                      </div>
                      <div className="pt-1">
                        {sortedItems.length === 0 ? (
                          <p className="px-3 py-5 text-center text-[11px] font-medium text-text-muted/50">
                            Brak otwartych zadań w tej sekcji.
                          </p>
                        ) : (
                          sortedItems.map((i: any) => renderCard(i))
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                // Overview Dashboard (Grouped sections)
                <>
                  {/* 1. Na dziś / Aktywne */}
                  {(todayItems.length > 0 || dragTarget === 'today') && (
                    <div ref={todayZoneRef} className="rounded-2xl border border-transparent bg-orange-500/3 dark:bg-orange-500/1 p-2">
                      <BucketHeader
                        icon="🔥"
                        title="Na dziś / Aktywne"
                        count={todayItems.length}
                        collapsed={!!collapsedSections['today']}
                        onToggle={() => toggleSectionCollapse('today')}
                        isDropTarget={dragTarget === 'today'}
                      />
                      {!collapsedSections['today'] && (
                        <div className="pt-1">
                          {todayItems.length === 0 ? (
                            <p className="px-3 py-5 text-center text-[11px] font-medium text-orange-500/50">
                              ↓ Upuść tutaj — przeniesie na dziś
                            </p>
                          ) : (
                            todayItems.map((i: any) => renderCard(i, { inToday: true }))
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. Inbox / Skrzynka */}
                  {(inboxItems.length > 0 || dragTarget === 'inbox') && (
                    <div ref={inboxZoneRef} className="p-2">
                      <BucketHeader
                        icon="📥"
                        title="Skrzynka / Inbox"
                        count={inboxItems.length}
                        collapsed={!!collapsedSections['inbox']}
                        onToggle={() => toggleSectionCollapse('inbox')}
                        isDropTarget={dragTarget === 'inbox'}
                      />
                      {!collapsedSections['inbox'] && (
                        <div className="pt-1">
                          {inboxItems.length === 0 ? (
                            <p className="px-3 py-3 text-center text-[11px] text-text-muted/40">
                              ↓ Upuść tutaj
                            </p>
                          ) : (
                            inboxItems.map((i: any) => renderCard(i))
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. Sections */}
                  {sectionsWithItems.map((sec) => {
                    const isCollapsed = !!collapsedSections[sec.id];
                    const hasItems = sec.items.length > 0;
                    if (!hasItems && dragTarget !== sec.id) return null;

                    return (
                      <div key={sec.id} ref={el => { sectionRefs.current[sec.id] = el; }} className="p-2">
                        <BucketHeader
                          icon="📂"
                          title={sec.name}
                          count={sec.items.length}
                          collapsed={isCollapsed}
                          onToggle={() => toggleSectionCollapse(sec.id)}
                          isDropTarget={dragTarget === sec.id}
                        />
                        {!isCollapsed && (
                          <div className="pt-1">
                            {sec.items.length === 0 ? (
                              <p className="px-3 py-3 text-center text-[11px] text-text-muted/40">
                                ↓ Upuść tutaj
                              </p>
                            ) : (
                              sec.items.map((i: any) => renderCard(i))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {/* Done items history */}
              {showDone && doneItems.length > 0 && (
                <div className="border-t border-border-custom/30 pt-2 p-2">
                  <BucketHeader
                    icon="✅"
                    title="Historia"
                    count={doneItems.length}
                    collapsed={false}
                    onToggle={() => setShowDone(false)}
                    isDropTarget={false}
                  />
                  <div className="pt-1">
                    {doneItems.slice(0, 30).map((i: any) => renderCard(i))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 flex border-t border-border-custom bg-background/95 backdrop-blur-xl">
        <button onClick={() => onNavigateTo?.('keep')} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-text-muted active:bg-surface">
          <StickyNote size={22} />
          <span className="text-[11px] font-semibold">Notatki</span>
        </button>
        <button className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-primary">
          <ListTodo size={22} />
          <span className="text-[11px] font-semibold">Zadania</span>
        </button>
        <button onClick={() => onNavigateTo?.('links')} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-text-muted active:bg-surface">
          <BookOpen size={22} />
          <span className="text-[11px] font-semibold">Pocket</span>
        </button>
      </nav>
    </div>
  );
}
