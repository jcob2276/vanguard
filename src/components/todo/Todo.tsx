import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  History,
  Link2,
  Pencil,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import DataStateNotice from '../core/DataStateNotice';
import {
  createTodoItem,
  listTodoItems,
  listTodoSections,
  setTodoStatus,
  updateTodoItem,
} from '../../lib/todo';
import { parseTodoQuickInput } from '../../lib/todoParser';
import { supabase } from '../../lib/supabase';
import type { ReactNode } from 'react';

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIORITY_ORDER = ['low', 'normal', 'high', 'urgent'];

const PRIORITY = {
  low:    { ring: 'border-emerald-400', fill: 'bg-emerald-500', chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: 'Quick Win' },
  normal: { ring: 'border-sky-400',     fill: 'bg-sky-500',     chip: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',            label: 'Focus' },
  high:   { ring: 'border-violet-500',  fill: 'bg-violet-500',  chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',   label: 'Deep Work' },
  urgent: { ring: 'border-rose-500',    fill: 'bg-rose-500',    chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',         label: 'Urgent' },
};

const getFocusPoints = (p) => ({ low: 1, normal: 1, high: 3, urgent: 2 }[p] ?? 1);

// Detect leading emoji in task title (e.g. "🏃 Bieganie" → icon="🏃", label="Bieganie")
const EMOJI_RE = /^(\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|️|‍\p{Extended_Pictographic})*)\s*/u;
function splitEmoji(title) {
  const m = title.match(EMOJI_RE);
  return m ? { icon: m[1], label: title.slice(m[0].length) } : { icon: null, label: title };
}

function relativeDate(dateStr, today) {
  if (!dateStr) return null;
  if (dateStr === today) return { text: 'Dziś', color: 'text-emerald-500' };
  const diff = Math.round((new Date(dateStr + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000);
  if (diff < 0) return { text: `${Math.abs(diff)}d po terminie`, color: 'text-rose-500 font-black' };
  if (diff === 1) return { text: 'Jutro', color: 'text-sky-500' };
  if (diff <= 7) return { text: `za ${diff} dni`, color: 'text-text-muted' };
  return { text: format(new Date(dateStr + 'T00:00:00'), 'd MMM'), color: 'text-text-muted' };
}

const parseSubtasks = (notes) => {
  if (!notes) return { description: '', subtasks: [] };
  const subtasks = [];
  const descLines = [];
  notes.split('\n').forEach((line, index) => {
    const m = line.match(/^\s*[-*]\s+\[([ xX])\]\s*(.*)$/);
    if (m) subtasks.push({ id: index, checked: m[1].toLowerCase() === 'x', text: m[2].trim() });
    else descLines.push(line);
  });
  return { description: descLines.join('\n').trim(), subtasks };
};

const serializeSubtasks = (description, subtasks) => {
  const d = description.trim();
  const s = subtasks.map(st => `- [${st.checked ? 'x' : ' '}] ${st.text}`).join('\n');
  if (d && s) return `${d}\n\n${s}`;
  return d || s;
};

// ─── ContextMenu ─────────────────────────────────────────────────────────────

function ContextMenu({ x, y, item, today, onClose, onComplete, onDrop, onMoveBucket }) {
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const closeKey = (e) => { if (e.key === 'Escape') onClose(); };
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

function DragGhost({ item, posRef }) {
  const ref = useRef(null);
  useEffect(() => {
    let raf;
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

function BucketHeader({ icon, title, count, collapsed, onToggle, isDropTarget }) {
  return (
    <button
      onClick={onToggle}
      className={`flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 transition-all duration-200 ${
        isDropTarget ? 'bg-primary/15 ring-2 ring-primary/25 scale-[1.01]' : 'hover:bg-surface-solid/50'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-[14px]">{icon}</span>
        <span className={`font-display text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${isDropTarget ? 'text-primary' : 'text-text-secondary'}`}>
          {title}
        </span>
        {count > 0 && (
          <span className="rounded-full bg-text-primary/[0.06] px-2 py-0.5 text-[9px] font-black tabular-nums text-text-muted">
            {count}
          </span>
        )}
      </div>
      {collapsed
        ? <ChevronRight size={13} className="text-text-muted/50 shrink-0" />
        : <ChevronDown size={13} className="text-text-muted/50 shrink-0" />}
    </button>
  );
}

// ─── TodoCard ────────────────────────────────────────────────────────────────

function TodoCard({
  item, onToggle, onDrop, onSetPriority,
  expanded, onToggleExpand,
  onToggleSubtask, onAddSubtask, onDeleteSubtask,
  busy, today,
  isLinkedToPlan, sections, onMoveSection,
  isEditing, editingTitle, onEditStart, onEditChange, onEditSave,
  sectionName, onDragStart, isDragging,
  onShowContextMenu,
}) {
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeDir, setSwipeDir] = useState(null);
  const [newSubtask, setNewSubtask] = useState('');
  const [completing, setCompleting] = useState(false);
  const longPressTimer = useRef(null);
  const gripLongPressTimer = useRef(null);

  const { description, subtasks } = useMemo(() => parseSubtasks(item.notes), [item.notes]);
  const doneCount = subtasks.filter(s => s.checked).length;
  const p = PRIORITY[item.priority] ?? PRIORITY.normal;
  const isDone = item.status === 'done';
  const { icon, label } = splitEmoji(item.title);
  const dateInfo = relativeDate(item.due_date, today);

  // ── Touch swipe (card body) ──
  const onTouchStart = (e) => {
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
  const onTouchMove = (e) => {
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
  const onGripTouchStart = (e) => {
    e.stopPropagation();
    const t = e.touches[0];
    gripLongPressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(35);
      onDragStart?.(item, t.clientX, t.clientY);
    }, 350);
  };
  const onGripTouchEnd = (e) => { e.stopPropagation(); clearTimeout(gripLongPressTimer.current); };
  const onGripTouchMove = (e) => { e.stopPropagation(); clearTimeout(gripLongPressTimer.current); };
  const onGripMouseDown = (e) => { e.preventDefault(); onDragStart?.(item, e.clientX, e.clientY); };

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl transition-all duration-250 mb-1.5 ${completing ? 'scale-[0.96] opacity-0 duration-300' : ''} ${isDone ? 'opacity-55' : ''}`}
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
        className="relative border border-border-custom/60 rounded-2xl px-3.5 py-3 bg-surface transition-all duration-150 ease-out
          hover:border-border-custom hover:shadow-[0_2px_16px_rgba(0,0,0,0.06)] hover:bg-surface-solid/30 dark:hover:shadow-[0_2px_16px_rgba(255,255,255,0.04)]"
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
            <button onClick={(e) => { e.stopPropagation(); handleComplete(); }} disabled={busy} className="shrink-0 mt-px">
              <span className={`flex h-7 w-7 items-center justify-center rounded-xl text-[18px] leading-none transition-all ${isDone ? 'grayscale opacity-50' : ''}`}>
                {icon}
              </span>
            </button>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); handleComplete(); }} disabled={busy} className="mt-[2px] shrink-0">
              <div className={`h-[18px] w-[18px] rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                isDone ? `${p.fill} border-transparent` : `${p.ring} bg-transparent`
              }`}>
                {isDone && <Check size={10} className="text-white" strokeWidth={3} />}
              </div>
            </button>
          )}

          {/* Content */}
          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onToggleExpand(item.id)}>
            <p className={`text-[13.5px] font-semibold leading-snug transition-colors ${isDone ? 'line-through text-text-muted' : 'text-text-primary'}`}>
              {label}
            </p>

            {/* Metadata */}
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
              {dateInfo && (
                <span className={`flex items-center gap-1 text-[10px] font-bold ${dateInfo.color}`}>
                  <Calendar size={9} />
                  {dateInfo.text}
                </span>
              )}
              {subtasks.length > 0 && (
                <span className="text-[10px] font-bold text-text-muted/70">
                  {doneCount}/{subtasks.length}
                </span>
              )}
              {(item.tags || []).map((tag) => (
                <span key={tag} className="text-[9px] font-bold text-text-muted/50">#{tag}</span>
              ))}
              {isLinkedToPlan && (
                <span className="flex items-center gap-0.5 text-[9px] font-bold text-primary/80">
                  <Link2 size={8} /> Plan
                </span>
              )}
              {item.ai_bucket && !item.due_date && (
                <span className="flex items-center gap-0.5 text-[9px] text-text-muted/25">
                  <Sparkles size={7} />
                </span>
              )}
              {sectionName && (
                <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted/25">{sectionName}</span>
              )}
            </div>
          </div>
        </div>

        {/* Expanded */}
        {expanded && (
          <div className="mt-3.5 space-y-3.5 border-t border-border-custom/40 pt-3.5" onClick={(e) => e.stopPropagation()}>

            {/* Inline title edit */}
            <div>
              <p className="mb-1 text-[8px] font-black uppercase tracking-widest text-text-muted">Tytuł</p>
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

            {/* Section picker */}
            {sections.length > 0 && (
              <div>
                <p className="mb-1.5 text-[8px] font-black uppercase tracking-widest text-text-muted">Sekcja</p>
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
              <p className="mb-1.5 text-[8px] font-black uppercase tracking-widest text-text-muted">Podzadania</p>
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

export default function Todo({ session, onBack }) {
  const userId = session.user.id;
  const [sections, setSections] = useState([]);
  const [items, setItems] = useState([]);
  const [dailyStrain, setDailyStrain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [collapsed, setCollapsed] = useState({ today: false, soon: true, later: true });
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [linkedPlanIds, setLinkedPlanIds] = useState(new Set());
  const [showOptions, setShowOptions] = useState(false);
  const [form, setForm] = useState({ title: '', notes: '', priority: 'normal', tagsText: '', due_date: '' });
  const [contextMenu, setContextMenu] = useState(null); // { x, y, item }

  // Drag state
  const [draggingItem, setDraggingItem] = useState(null);
  const [dragTarget, setDragTarget] = useState(null);
  const dragPosRef = useRef({ x: 0, y: 0 });
  const dragItemRef = useRef(null);
  const todayZoneRef = useRef(null);
  const soonZoneRef = useRef(null);
  const laterZoneRef = useRef(null);

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
  const nextWeek = (() => {
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
  })();

  const fetchAll = useCallback(async () => {
    const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    try {
      const [s, i, { data: strainData }, { data: winData }] = await Promise.all([
        listTodoSections(userId),
        listTodoItems(userId),
        supabase.from('daily_strain').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('daily_wins').select('task_1_todo_id,task_2_todo_id,task_3_todo_id,task_4_todo_id,task_5_todo_id').eq('user_id', userId).eq('date', todayDate).maybeSingle(),
      ]);
      setSections(s || []);
      setItems(i || []);
      setDailyStrain(strainData);
      if (winData) setLinkedPlanIds(new Set([1,2,3,4,5].map((n) => winData[`task_${n}_todo_id`]).filter(Boolean)));
    } catch (err) { setError(err.message); }
  }, [userId]);

  useEffect(() => {
    (async () => { setLoading(true); await fetchAll(); setLoading(false); })();
  }, [fetchAll]);

  // ── Drag tracking ──
  const getBucketAtPoint = useCallback((x, y) => {
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
    const onMove = (e) => {
      e.preventDefault();
      const t = e.touches?.[0] ?? e;
      dragPosRef.current = { x: t.clientX, y: t.clientY };
      const b = getBucketAtPoint(t.clientX, t.clientY);
      setDragTarget((prev) => prev !== b ? b : prev);
    };
    const onEnd = (e) => {
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
  const parsedInput = useMemo(() => parseTodoQuickInput(form.title), [form.title]);
  const openItems = useMemo(() => items.filter((i) => i.status === 'open'), [items]);
  const doneItems = useMemo(() => items.filter((i) => i.status === 'done'), [items]);

  const { todayItems, soonItems, laterItems } = useMemo(() => {
    const todaySet = new Set(), soonSet = new Set();
    const todayItems = openItems.filter((i) => {
      if (i.ai_bucket === 'today' || i.due_date === today) { todaySet.add(i.id); return true; }
      return false;
    });
    const soonItems = openItems.filter((i) => {
      if (todaySet.has(i.id)) return false;
      if (i.ai_bucket === 'soon' || (i.due_date && i.due_date > today && i.due_date <= nextWeek)) { soonSet.add(i.id); return true; }
      return false;
    });
    const laterItems = openItems.filter((i) => !todaySet.has(i.id) && !soonSet.has(i.id));
    return { todayItems, soonItems, laterItems };
  }, [openItems, today, nextWeek]);

  const budget = dailyStrain?.daily_status === 'green' ? 6 : dailyStrain?.daily_status === 'yellow' ? 4 : dailyStrain?.daily_status === 'red' ? 2 : 5;
  const completedPoints = useMemo(() => items.reduce((sum, i) => {
    const doneToday = i.status === 'done' && i.completed_at &&
      new Date(i.completed_at).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' }) === today;
    return doneToday ? sum + getFocusPoints(i.priority) : sum;
  }, 0), [items, today]);
  const progress = Math.min(100, Math.round((completedPoints / budget) * 100)) || 0;

  // ── Actions ──
  const run = async (fn) => {
    setBusy(true);
    try { await fn(); await fetchAll(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const classifyInBackground = useCallback((item) => {
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
      const newItem = await createTodoItem(userId, { ...form, title, priority: parsedInput.priority || form.priority, due_date: parsedInput.due_date || form.due_date, section_id: null });
      setForm({ title: '', notes: '', priority: 'normal', tagsText: '', due_date: '' });
      setShowOptions(false);
      if (!parsedInput.due_date && !parsedInput.priority) classifyInBackground(newItem);
    });
  };

  const moveBucket = useCallback((item, bucket) => {
    const now = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    const patch: { ai_bucket: string; ai_classified_at: string; due_date?: string | null } = { ai_bucket: bucket, ai_classified_at: new Date().toISOString() };
    if (bucket === 'today') patch.due_date = now;
    else if (item.due_date) patch.due_date = null;
    run(() => updateTodoItem(item.id, patch));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSubtask = (item, idx) => {
    const { description, subtasks } = parseSubtasks(item.notes);
    run(() => updateTodoItem(item.id, { notes: serializeSubtasks(description, subtasks.map((st, i) => i === idx ? { ...st, checked: !st.checked } : st)) }));
  };
  const addSubtask = (item, text) => {
    if (!text.trim()) return;
    const { description, subtasks } = parseSubtasks(item.notes);
    run(() => updateTodoItem(item.id, { notes: serializeSubtasks(description, [...subtasks, { checked: false, text: text.trim() }]) }));
  };
  const deleteSubtask = (item, idx) => {
    const { description, subtasks } = parseSubtasks(item.notes);
    run(() => updateTodoItem(item.id, { notes: serializeSubtasks(description, subtasks.filter((_, i) => i !== idx)) }));
  };
  const saveEditTitle = (item) => {
    const title = editingTitle.trim();
    if (title && title !== item.title) run(() => updateTodoItem(item.id, { title }));
    setEditingId(null); setEditingTitle('');
  };

  const handleDragStart = useCallback((item, x, y) => {
    dragItemRef.current = item;
    dragPosRef.current = { x, y };
    setDraggingItem(item);
    setExpandedId(null);
    setContextMenu(null);
  }, []);

  const toggleExpand = useCallback((id) => setExpandedId((p) => p === id ? null : id), []);

  const showContextMenu = useCallback((item, x, y) => {
    setContextMenu({ x, y, item });
    setExpandedId(null);
  }, []);

  const renderCard = (item) => (
    <TodoCard
      key={item.id}
      item={item}
      busy={busy}
      today={today}
      expanded={expandedId === item.id}
      onToggleExpand={toggleExpand}
      onToggle={() => run(() => setTodoStatus(item, item.status === 'done' ? 'open' : 'done'))}
      onSetPriority={(pid) => { if (pid !== item.priority) run(() => updateTodoItem(item.id, { priority: pid })); }}
      onDrop={() => run(() => setTodoStatus(item, 'dropped'))}
      onToggleSubtask={(idx) => toggleSubtask(item, idx)}
      onAddSubtask={(text) => addSubtask(item, text)}
      onDeleteSubtask={(idx) => deleteSubtask(item, idx)}
      isLinkedToPlan={linkedPlanIds.has(item.id)}
      sections={sections}
      onMoveSection={(sId) => { if (sId !== item.section_id) run(() => updateTodoItem(item.id, { section_id: sId })); }}
      isEditing={editingId === item.id}
      editingTitle={editingTitle}
      onEditStart={(t) => { setEditingId(item.id); setEditingTitle(t); }}
      onEditChange={setEditingTitle}
      onEditSave={() => saveEditTitle(item)}
      sectionName={item.section_id ? sectionById[item.section_id]?.name : null}
      onDragStart={handleDragStart}
      isDragging={draggingItem !== null}
      onShowContextMenu={showContextMenu}
    />
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <DataStateNotice tone="loading" title="To Do się ładuje" detail="Pobieram zadania." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-primary">
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
          onMoveBucket={(bucket) => moveBucket(contextMenu.item, bucket)}
        />
      )}

      <div className="mx-auto flex min-h-screen max-w-md flex-col border-x border-border-custom bg-background/40 backdrop-blur-3xl pb-28">

        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-custom bg-background/85 px-5 py-4 backdrop-blur-xl">
          <button onClick={onBack} className="rounded-full border border-border-custom bg-surface/50 p-2 text-text-secondary hover:text-text-primary hover:bg-surface transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[16px] font-black uppercase tracking-tight text-text-primary">To Do</h1>
            <p className="mt-0.5 text-[9px] font-black uppercase tracking-widest text-text-muted">
              {openItems.length} otwarte · {todayItems.length} na dziś
            </p>
          </div>
          <button
            onClick={() => setShowDone((v) => !v)}
            className={`rounded-full border p-2 transition-colors ${showDone ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border-custom text-text-muted hover:bg-surface'}`}
            title="Historia"
          >
            <History size={15} />
          </button>
        </header>

        <main className="space-y-4 p-5">
          {error && <DataStateNotice tone="warning" title="Błąd" detail={error} />}

          {/* Focus Budget */}
          <div className="flex items-center gap-4 rounded-2xl border border-border-custom bg-surface/50 p-4">
            <div className="relative h-12 w-12 shrink-0">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="16" className="stroke-border-custom fill-none" strokeWidth="3" />
                <circle cx="20" cy="20" r="16" className="stroke-primary fill-none transition-all duration-500" strokeWidth="3"
                  strokeDasharray="100.5" strokeDashoffset={100.5 - (progress / 100) * 100.5} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[11px] font-black leading-none">{completedPoints}</span>
                <span className="text-[7px] font-bold text-text-muted">/{budget}</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Budżet skupienia</h4>
              <p className="mt-0.5 text-[11px] font-medium text-text-secondary leading-snug">
                {dailyStrain?.daily_status === 'green' && '🟢 Mocny dzień — Deep Work'}
                {dailyStrain?.daily_status === 'yellow' && '🟡 Zrównoważony dzień'}
                {dailyStrain?.daily_status === 'red' && '🔴 Dzień ładowania baterii / Regeneracja'}
                {!dailyStrain && 'Brak danych biometrycznych'}
              </p>
            </div>
          </div>

          {/* Quick capture */}
          <div className="rounded-2xl border border-border-custom bg-surface p-4">
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
                placeholder="Wrzuć cokolwiek... p1 · jutro · 🏃 Bieganie"
                className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-[14px] font-semibold text-text-primary outline-none placeholder:text-text-muted/30 placeholder:font-normal"
              />
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
          <div className="space-y-1">
            <div ref={todayZoneRef}>
              <BucketHeader icon="🔥" title="Dziś" count={todayItems.length} collapsed={collapsed.today}
                onToggle={() => setCollapsed((p) => ({ ...p, today: !p.today }))} isDropTarget={dragTarget === 'today'} />
              {!collapsed.today && (
                <div className="pt-1">
                  {todayItems.length === 0
                    ? <p className={`px-3 py-5 text-center text-[11px] font-medium ${dragTarget === 'today' ? 'text-primary font-bold' : 'text-text-muted/50'}`}>
                        {dragTarget === 'today' ? '↓ Upuść tutaj — przeniesie na dziś' : 'Nic pilnego. Przeciągnij zadanie z poniższych bucketów.'}
                      </p>
                    : todayItems.map(renderCard)}
                </div>
              )}
            </div>

            <div ref={soonZoneRef}>
              <BucketHeader icon="📅" title="Wkrótce" count={soonItems.length} collapsed={collapsed.soon}
                onToggle={() => setCollapsed((p) => ({ ...p, soon: !p.soon }))} isDropTarget={dragTarget === 'soon'} />
              {!collapsed.soon && (
                <div className="pt-1">
                  {soonItems.length === 0
                    ? <p className={`px-3 py-3 text-[10px] font-bold uppercase tracking-widest ${dragTarget === 'soon' ? 'text-primary' : 'text-text-muted/35'}`}>
                        {dragTarget === 'soon' ? '↓ Upuść tutaj' : 'Pusto.'}
                      </p>
                    : soonItems.map(renderCard)}
                </div>
              )}
            </div>

            <div ref={laterZoneRef}>
              <BucketHeader icon="🗄️" title="W tle" count={laterItems.length} collapsed={collapsed.later}
                onToggle={() => setCollapsed((p) => ({ ...p, later: !p.later }))} isDropTarget={dragTarget === 'later'} />
              {!collapsed.later && (
                <div className="pt-1">
                  {laterItems.length === 0
                    ? <p className={`px-3 py-3 text-[10px] font-bold uppercase tracking-widest ${dragTarget === 'later' ? 'text-primary' : 'text-text-muted/35'}`}>
                        {dragTarget === 'later' ? '↓ Upuść tutaj' : 'Pusto.'}
                      </p>
                    : laterItems.map(renderCard)}
                </div>
              )}
            </div>

            {showDone && doneItems.length > 0 && (
              <div className="border-t border-border-custom/30 pt-2">
                <BucketHeader icon="✅" title="Historia" count={doneItems.length} collapsed={false}
                  onToggle={() => setShowDone(false)} isDropTarget={false} />
                <div className="pt-1">{doneItems.slice(0, 30).map(renderCard)}</div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
