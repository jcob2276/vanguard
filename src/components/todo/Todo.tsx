import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  onClose: () => void;
  onComplete: () => void;
  onDrop: () => void;
  onMoveBucket: (b: string) => void;
}

function ContextMenu({ x, y, item, today, onClose, onComplete, onDrop, onMoveBucket }: ContextMenuProps) {
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
  const top = Math.min(y, window.innerHeight - 260);

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
      style={{ position: 'fixed', left, top, zIndex: 10000, minWidth: 210 }}
      className="overflow-hidden rounded-2xl border border-border-custom bg-surface/95 shadow-2xl backdrop-blur-xl"
    >
      <div className="border-b border-border-custom/40 px-4 py-2">
        <p className="truncate text-[10px] font-black uppercase tracking-widest text-text-muted">
          {splitEmoji(item.title).label || item.title}
        </p>
      </div>
      <div className="py-1">
        <MenuItem icon={item.status === 'done' ? '↩️' : '✅'} label={item.status === 'done' ? 'Cofnij ukończenie' : 'Oznacz jako gotowe'} onClick={onComplete} />
        <div className="mx-3 my-1 border-t border-border-custom/30" />
        <MenuItem icon="🔥" label="Przenieś na Dziś" onClick={() => onMoveBucket('today')} />
        <MenuItem icon="📅" label="Przenieś na Wkrótce" onClick={() => onMoveBucket('soon')} />
        <MenuItem icon="🗄️" label="Przenieś w Tło" onClick={() => onMoveBucket('later')} />
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
                  <span className="flex items-center gap-1">
                    {GoalIcon && <GoalIcon size={8} className={GOAL_COLOR[sectionGoalKey!]} />}
                    <span className="text-[10px] font-medium text-text-muted/30 uppercase tracking-wider">{sectionName}</span>
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

export default function Todo({ session, onBack, onNavigateTo }: { session: any; onBack: () => void; onNavigateTo?: (dest: 'links' | 'keep') => void }) {
  const navigate = useNavigate();
  const userId = session?.user?.id;
  const [sections, setSections] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [collapsed, setCollapsed] = useState({ today: false, soon: true, later: true });
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [linkedPlanIds, setLinkedPlanIds] = useState(new Set());
  const [showOptions, setShowOptions] = useState(false);
  const [activeFilterTag, setActiveFilterTag] = useState<string | null>(null);
  const [activeFilterSection, setActiveFilterSection] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [dreams, setDreams] = useState<any[]>([]);

  const goTo = (view: string) => {
    localStorage.setItem('vanguard_view', view);
    window.location.href = '/';
  };
  const [form, setForm] = useState({ title: '', notes: '', priority: 'normal', tagsText: '', due_date: '', recurrence: '' });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: any } | null>(null);

  // Drag state
  const [draggingItem, setDraggingItem] = useState<any | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const dragPosRef = useRef({ x: 0, y: 0 });
  const dragItemRef = useRef<any | null>(null);
  const todayZoneRef = useRef<HTMLDivElement>(null);
  const soonZoneRef = useRef<HTMLDivElement>(null);
  const laterZoneRef = useRef<HTMLDivElement>(null);

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
        supabase.from('dreams').select('id, life_goal').eq('user_id', userId),
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

  // ── Drag tracking ──
  const getBucketAtPoint = useCallback((x: number, y: number) => {
    for (const { ref, bucket } of [
      { ref: todayZoneRef, bucket: 'today' },
      { ref: soonZoneRef, bucket: 'soon' },
      { ref: laterZoneRef, bucket: 'later' },
    ]) {
      if (!ref.current) continue;
      const r = ref.current.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return bucket;
    }
    return null;
  }, []);

  useEffect(() => {
    if (!draggingItem) return;
    const onMove = (e: any) => {
      e.preventDefault();
      const t = e.touches?.[0] ?? e;
      dragPosRef.current = { x: t.clientX, y: t.clientY };
      const b = getBucketAtPoint(t.clientX, t.clientY);
      setDragTarget((prev) => prev !== b ? b : prev);
    };
    const onEnd = (e: any) => {
      const t = e.changedTouches?.[0] ?? e;
      const bucket = getBucketAtPoint(t.clientX, t.clientY);
      const item = dragItemRef.current;
      if (bucket && item) {
        const now = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
        const patch: { ai_bucket: string; ai_classified_at: string; due_date?: string | null } = { ai_bucket: bucket, ai_classified_at: new Date().toISOString() };
        if (bucket === 'today') patch.due_date = now;
        else if (item.due_date) patch.due_date = null;
        setBusy(true);
        updateTodoItem(item.id, patch).then(() => fetchAll()).catch((err) => setError(err.message)).finally(() => setBusy(false));
      }
      dragItemRef.current = null;
      setDraggingItem(null);
      setDragTarget(null);
    };
    // capture: true fires before stopPropagation in grip handlers
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
  }, [draggingItem, getBucketAtPoint, fetchAll]);

  // ── Derived ──
  const sectionById = useMemo(() => Object.fromEntries(sections.map((s) => [s.id, s])), [sections]);

  const sectionGoalMap = useMemo(() => {
    const dreamGoal = Object.fromEntries(dreams.filter((d: any) => d.life_goal).map((d: any) => [d.id, d.life_goal as string]));
    const projectDream = Object.fromEntries(projects.filter((p: any) => p.dream_id).map((p: any) => [p.id, p.dream_id as string]));
    const result: Record<string, string> = {};
    for (const sec of sections as any[]) {
      if (!sec.project_id) continue;
      const dreamId = projectDream[sec.project_id];
      if (!dreamId) continue;
      const goal = dreamGoal[dreamId];
      if (goal) result[sec.id] = goal;
    }
    return result;
  }, [sections, projects, dreams]);
  const parsedInput = useMemo(() => parseTodoQuickInput(form.title), [form.title]);
  const openItems = useMemo(() => items.filter((i) => i.status === 'open'), [items]);
  const doneItems = useMemo(() => items.filter((i) => i.status === 'done'), [items]);

  const allUniqueTags = useMemo(() => Array.from(new Set(openItems.flatMap(i => i.tags || []))).sort(), [openItems]);
  const allUniqueSections = useMemo(() =>
    sections.filter(s => s.project_id || openItems.some(i => i.section_id === s.id)),
    [sections, openItems],
  );

  const projectBySection = useMemo(() =>
    Object.fromEntries(sections.filter(s => s.project_id).map(s => [s.id, projects.find(p => p.id === s.project_id)])),
    [sections, projects],
  );

  const activeProject = useMemo(() => {
    if (!activeFilterSection) return null;
    const project = projectBySection[activeFilterSection];
    if (!project) return null;
    const sectionItems = items.filter(i => i.section_id === activeFilterSection);
    const done  = sectionItems.filter(i => i.status === 'done').length;
    const total = sectionItems.length;
    const progress = total === 0 ? 0 : Math.round((done / total) * 100);
    const daysLeft = project.deadline
      ? Math.round((new Date(project.deadline + 'T00:00:00').getTime() - new Date().getTime()) / 86400000)
      : null;
    return { ...project, done, total, progress, daysLeft };
  }, [activeFilterSection, projectBySection, items]);

  const applyFilter = useCallback((arr: any[]) => arr.filter(i => {
    if (activeFilterTag && !(i.tags || []).includes(activeFilterTag)) return false;
    if (activeFilterSection && i.section_id !== activeFilterSection) return false;
    return true;
  }), [activeFilterTag, activeFilterSection]);

  const { todayItems, soonItems, laterItems } = useMemo(() => {
    const todaySet = new Set(), soonSet = new Set();
    const todayItems = applyFilter(openItems.filter((i: any) => {
      if (i.ai_bucket === 'today' || i.due_date === today) { todaySet.add(i.id); return true; }
      return false;
    }));
    const soonItems = applyFilter(openItems.filter((i: any) => {
      if (todaySet.has(i.id)) return false;
      if (i.ai_bucket === 'soon' || (i.due_date && i.due_date > today && i.due_date <= nextWeek)) { soonSet.add(i.id); return true; }
      return false;
    }));
    const laterItems = applyFilter(openItems.filter((i: any) => !todaySet.has(i.id) && !soonSet.has(i.id)));
    return { todayItems, soonItems, laterItems };
  }, [openItems, today, nextWeek, applyFilter]);

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
      const newItem = await createTodoItem(userId, { ...form, title, priority: parsedInput.priority || form.priority, due_date: parsedInput.due_date || form.due_date, section_id: undefined, recurrence: form.recurrence || undefined });
      setForm({ title: '', notes: '', priority: 'normal', tagsText: '', due_date: '', recurrence: '' });
      setShowOptions(false);
      if (!parsedInput.due_date && !parsedInput.priority) classifyInBackground(newItem);
    });
  };

  const moveBucket = useCallback((item: any, bucket: string) => {
    const now = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    const patch: { ai_bucket: string; ai_classified_at: string; due_date?: string | null } = { ai_bucket: bucket, ai_classified_at: new Date().toISOString() };
    if (bucket === 'today') patch.due_date = now;
    else if (item.due_date) patch.due_date = null;
    run(() => updateTodoItem(item.id, patch));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    setExpandedId(null);
    setContextMenu(null);
  }, []);

  const toggleExpand = useCallback((id: any) => setExpandedId((p) => p === id ? null : id), []);

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
  }, [today, userId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      onDragStart={handleDragStart}
      isDragging={draggingItem !== null}
      onShowContextMenu={showContextMenu}
      onMoveToToday={!inToday ? () => moveBucket(item, 'today') : undefined}
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
          onClose={() => setContextMenu(null)}
          onComplete={() => run(() => setTodoStatus(contextMenu.item, contextMenu.item.status === 'done' ? 'open' : 'done'))}
          onDrop={() => run(() => setTodoStatus(contextMenu.item, 'dropped'))}
          onMoveBucket={(bucket: string) => moveBucket(contextMenu.item, bucket)}
        />
      )}

      {/* Sidebar */}
      <aside className="keep-sidebar">
        <p className="keep-sidebar-section-label">Workspace</p>
        <a href="/keep" className="keep-sidebar-item">
          <StickyNote size={15} />
          <span>Notatki</span>
        </a>
        <button className="keep-sidebar-item active">
          <ListTodo size={15} />
          <span>Zadania</span>
        </button>
        <button className="keep-sidebar-item" onClick={() => goTo('links')}>
          <BookOpen size={15} />
          <span>Pocket</span>
        </button>

        {(allUniqueTags.length > 0 || allUniqueSections.length > 0) && (
          <>
            <div className="keep-sidebar-separator" />
            <p className="keep-sidebar-section-label">Filtruj</p>
            {activeFilterTag || activeFilterSection ? (
              <button
                className="keep-sidebar-item"
                onClick={() => { setActiveFilterTag(null); setActiveFilterSection(null); }}
              >
                <X size={13} />
                <span className="text-rose-500">Wyczyść</span>
              </button>
            ) : null}
            {allUniqueSections.map(s => {
              const proj = projectBySection[s.id];
              const COLOR_DOT: Record<string, string> = { indigo: 'bg-indigo-500', violet: 'bg-violet-500', sky: 'bg-sky-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500' };
              return (
                <button
                  key={s.id}
                  className={`keep-sidebar-item ${activeFilterSection === s.id ? 'active' : ''}`}
                  onClick={() => { setActiveFilterSection(p => p === s.id ? null : s.id); setActiveFilterTag(null); }}
                >
                  {proj
                    ? <span className={`h-2 w-2 shrink-0 rounded-full ${COLOR_DOT[proj.color] ?? 'bg-text-muted'}`} />
                    : <Filter size={13} />}
                  <span>{s.name}</span>
                </button>
              );
            })}
            {allUniqueTags.map(tag => (
              <button
                key={tag}
                className={`keep-sidebar-item ${activeFilterTag === tag ? 'active' : ''}`}
                onClick={() => { setActiveFilterTag(p => p === tag ? null : tag); setActiveFilterSection(null); }}
              >
                <Tag size={13} />
                <span>{tag}</span>
              </button>
            ))}
          </>
        )}
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
            <p className="text-[12px] text-text-muted">
              {openItems.length} otwarte · {todayItems.length} na dziś
            </p>
          </div>
          <button
            onClick={() => setShowDone((v) => !v)}
            className={`rounded-full p-2 transition-colors ${showDone ? 'text-primary bg-primary/10' : 'text-text-muted hover:text-text-primary hover:bg-surface'}`}
            title="Historia"
          >
            <History size={17} />
          </button>
        </header>

        {/* Project context banner */}
        {activeProject && (() => {
          const COLOR: Record<string, { dot: string; bar: string; text: string; bg: string }> = {
            indigo:  { dot: 'bg-indigo-500',  bar: 'bg-indigo-500',  text: 'text-indigo-600 dark:text-indigo-400',  bg: 'bg-indigo-500/8'  },
            violet:  { dot: 'bg-violet-500',  bar: 'bg-violet-500',  text: 'text-violet-600 dark:text-violet-400',  bg: 'bg-violet-500/8'  },
            sky:     { dot: 'bg-sky-500',     bar: 'bg-sky-500',     text: 'text-sky-600 dark:text-sky-400',        bg: 'bg-sky-500/8'     },
            emerald: { dot: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400',bg: 'bg-emerald-500/8' },
            amber:   { dot: 'bg-amber-500',   bar: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400',    bg: 'bg-amber-500/8'   },
            rose:    { dot: 'bg-rose-500',    bar: 'bg-rose-500',    text: 'text-rose-600 dark:text-rose-400',      bg: 'bg-rose-500/8'    },
          };
          const c = COLOR[activeProject.color] ?? COLOR.indigo;
          return (
            <div className={`mx-5 mt-3 rounded-[14px] ${c.bg} px-4 py-3`}>
              <div className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${c.dot}`} />
                  <span className={`text-[13px] font-semibold truncate ${c.text}`}>{activeProject.name}</span>
                  {activeProject.goal && <span className="text-[11px] text-text-muted truncate hidden sm:block">· {activeProject.goal}</span>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-[12px] font-semibold ${c.text}`}>{activeProject.progress}%</span>
                  {activeProject.daysLeft !== null && (
                    <span className={`text-[11px] font-medium ${activeProject.daysLeft < 0 ? 'text-rose-500' : activeProject.daysLeft <= 14 ? 'text-amber-500' : 'text-text-muted'}`}>
                      {activeProject.daysLeft < 0 ? `${Math.abs(activeProject.daysLeft)}d po terminie` : `${activeProject.daysLeft}d`}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-2 h-1 w-full rounded-full bg-black/10 dark:bg-white/10">
                <div className={`h-full rounded-full transition-all ${c.bar}`} style={{ width: `${activeProject.progress}%` }} />
              </div>
            </div>
          );
        })()}

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[600px] mx-auto space-y-4 px-6 py-5 pb-24">
          {error && <DataStateNotice tone="warning" title="Błąd" detail={error} />}

          {/* Quick capture */}
          <div className="rounded-[18px] bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.07),0_2px_14px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_6px_rgba(0,0,0,0.25),0_2px_18px_rgba(0,0,0,0.18)] p-4">
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
                placeholder="Dodaj zadanie... p1 · jutro · 🏃 Bieganie"
                className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-[15px] font-normal text-text-primary outline-none placeholder:text-text-muted/35"
              />
              <button
                title={form.recurrence ? RECURRENCE_LABELS[form.recurrence] : 'Brak powtarzania'}
                onClick={() => {
                  const idx = RECURRENCE_CYCLE.indexOf(form.recurrence as any);
                  const next = RECURRENCE_CYCLE[(idx + 1) % RECURRENCE_CYCLE.length];
                  setForm(f => ({ ...f, recurrence: next }));
                }}
                className={`rounded-full border p-2 transition-colors ${form.recurrence ? 'bg-violet-500/15 text-violet-500 border-violet-500/20' : 'border-border-custom/60 text-text-muted hover:text-text-primary hover:bg-surface-solid'}`}
              >
                <Repeat2 size={16} />
              </button>
              <button
                onClick={() => setShowOptions((v) => !v)}
                className={`rounded-full border p-2 transition-colors ${showOptions ? 'bg-primary/15 text-primary border-primary/20' : 'border-border-custom/60 text-text-muted hover:text-text-primary hover:bg-surface-solid'}`}
              >
                <Settings2 size={16} />
              </button>
              <button
                onClick={addItem}
                disabled={busy || !form.title.trim()}
                className="rounded-full bg-primary p-2 text-white shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-95 disabled:opacity-35 transition-all"
              >
                <Plus size={16} />
              </button>
            </div>

            {form.recurrence && (
              <div className="mt-1.5 px-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-violet-500">
                  <Repeat2 size={9} /> {RECURRENCE_LABELS[form.recurrence]}
                </span>
              </div>
            )}

            {parsedInput.tokens.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 px-1">
                {parsedInput.tokens.map((token) => (
                  <span key={`${token.type}-${token.value}`}
                    className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                      token.type === 'priority' ? (PRIORITY[token.value]?.chip ?? 'bg-surface-solid text-text-muted') : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {token.label}
                  </span>
                ))}
                {parsedInput.title && parsedInput.title !== form.title.trim() && (
                  <span className="text-[9px] font-bold text-text-muted">→ {parsedInput.title}</span>
                )}
              </div>
            )}

            {showOptions && (
              <div className="mt-3 space-y-2 border-t border-border-custom pt-3">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  placeholder="Opis... (podzadania: - [ ] krok)"
                  className="w-full resize-none rounded-xl border border-border-custom/60 bg-surface-solid/50 px-3 py-2.5 text-[12px] font-medium text-text-primary outline-none placeholder:text-text-muted/30 focus:border-primary/30"
                />
                <div className="flex gap-2">
                  <input
                    value={form.tagsText}
                    onChange={(e) => setForm({ ...form, tagsText: e.target.value })}
                    placeholder="tagi: zakup, projekt"
                    className="min-w-0 flex-1 rounded-xl border border-border-custom/60 bg-surface-solid/50 px-3 py-2 text-[11px] font-medium text-text-primary outline-none placeholder:text-text-muted/30 focus:border-primary/30"
                  />
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="rounded-xl border border-border-custom/60 bg-surface-solid/50 px-3 py-2 text-[11px] font-bold text-text-secondary outline-none focus:border-primary/30 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3 buckets */}
          <div className="space-y-2">
            <div ref={todayZoneRef}>
              <BucketHeader icon="🔥" title="Dziś" count={todayItems.length} collapsed={collapsed.today}
                onToggle={() => setCollapsed((p) => ({ ...p, today: !p.today }))} isDropTarget={dragTarget === 'today'} />
              {!collapsed.today && (
                <div className="pt-1">
                  {todayItems.length === 0
                    ? <p className={`px-3 py-5 text-center text-[11px] font-medium ${dragTarget === 'today' ? 'text-primary font-bold' : 'text-text-muted/50'}`}>
                        {dragTarget === 'today' ? '↓ Upuść tutaj — przeniesie na dziś' : 'Nic pilnego. Przeciągnij zadanie z poniższych bucketów.'}
                      </p>
                    : todayItems.map((i: any) => renderCard(i, { inToday: true }))}
                </div>
              )}
            </div>

            <div ref={soonZoneRef}>
              <BucketHeader icon="📅" title="Wkrótce" count={soonItems.length} collapsed={collapsed.soon}
                onToggle={() => setCollapsed((p) => ({ ...p, soon: !p.soon }))} isDropTarget={dragTarget === 'soon'} />
              {!collapsed.soon && (
                <div className="pt-1">
                  {soonItems.length === 0
                    ? <p className={`px-3 py-3 text-[12px] font-medium ${dragTarget === 'soon' ? 'text-primary' : 'text-text-muted/40'}`}>
                        {dragTarget === 'soon' ? '↓ Upuść tutaj' : 'Pusto'}
                      </p>
                    : soonItems.map((item: any) => renderCard(item))}
                </div>
              )}
            </div>

            <div ref={laterZoneRef}>
              <BucketHeader icon="🗄️" title="W tle" count={laterItems.length} collapsed={collapsed.later}
                onToggle={() => setCollapsed((p) => ({ ...p, later: !p.later }))} isDropTarget={dragTarget === 'later'} />
              {!collapsed.later && (
                <div className="pt-1">
                  {laterItems.length === 0
                    ? <p className={`px-3 py-3 text-[12px] font-medium ${dragTarget === 'later' ? 'text-primary' : 'text-text-muted/40'}`}>
                        {dragTarget === 'later' ? '↓ Upuść tutaj' : 'Pusto'}
                      </p>
                    : laterItems.map((item: any) => renderCard(item))}
                </div>
              )}
            </div>

            {showDone && doneItems.length > 0 && (
              <div className="border-t border-border-custom/30 pt-2">
                <BucketHeader icon="✅" title="Historia" count={doneItems.length} collapsed={false}
                  onToggle={() => setShowDone(false)} isDropTarget={false} />
                <div className="pt-1">{doneItems.slice(0, 30).map((item: any) => renderCard(item))}</div>
              </div>
            )}
          </div>
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 flex border-t border-border-custom bg-background/95 backdrop-blur-xl">
        <button onClick={() => onNavigateTo ? onNavigateTo('keep') : navigate('/keep')} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-text-muted active:bg-surface">
          <StickyNote size={22} />
          <span className="text-[11px] font-semibold">Notatki</span>
        </button>
        <button className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-primary">
          <ListTodo size={22} />
          <span className="text-[11px] font-semibold">Zadania</span>
        </button>
        <button onClick={() => onNavigateTo ? onNavigateTo('links') : undefined} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-text-muted active:bg-surface">
          <BookOpen size={22} />
          <span className="text-[11px] font-semibold">Pocket</span>
        </button>
      </nav>
    </div>
  );
}
