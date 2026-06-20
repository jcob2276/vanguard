import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Bell, BellOff, Check, Repeat2, Link2, Pencil, X, Sparkles, Trash2, GripVertical } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  GOAL_ICON,
  GOAL_COLOR,
  PRIORITY,
  PRIORITY_ORDER,
  splitEmoji,
  relativeDate,
  parseSubtasks,
  RECURRENCE_LABELS
} from './todoUtils';

export interface TodoCardProps {
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
  session: any;
  onAddSubtasksBatch: (texts: string[]) => void;
  onSetReminder: (isoDatetime: string) => void;
  onCancelReminder: () => void;
}

export default function TodoCard({
  item,
  onToggle,
  onDrop,
  onSetPriority,
  expanded,
  onToggleExpand,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
  busy,
  today,
  isLinkedToPlan,
  sections,
  onMoveSection,
  isEditing,
  editingTitle,
  onEditStart,
  onEditChange,
  onEditSave,
  sectionName,
  sectionGoalKey,
  onDragStart,
  isDragging,
  onShowContextMenu,
  onMoveToToday,
  onSetRecurrence,
  dreamTitle,
  session,
  onAddSubtasksBatch,
  onSetReminder,
  onCancelReminder,
}: TodoCardProps) {
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null);
  const [newSubtask, setNewSubtask] = useState('');
  const [completing, setCompleting] = useState(false);
  const [completingOut, setCompletingOut] = useState(false);
  const [expandMounted, setExpandMounted] = useState(false);
  const longPressTimer = useRef<any>(null);
  const gripLongPressTimer = useRef<any>(null);
  const prevSwipeRef = useRef(0);

  useEffect(() => {
    if (expanded) {
      setExpandMounted(true);
    } else {
      const t = setTimeout(() => setExpandMounted(false), 280);
      return () => clearTimeout(t);
    }
  }, [expanded]);

  const [reminderInput, setReminderInput] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantResult, setAssistantResult] = useState<{
    type: 'decompose' | 'first_move' | 'evaluate';
    text: string;
    subtasks?: string[];
  } | null>(null);
  const [assistantError, setAssistantError] = useState<string | null>(null);

  const runAssistant = async (type: 'decompose' | 'first_move' | 'evaluate') => {
    if (!session?.user?.id) return;
    setAssistantLoading(true);
    setAssistantError(null);
    setAssistantResult(null);

    let queryText = '';
    if (type === 'decompose') {
      queryText = `Rozbij to zadanie na 3-5 konkretnych, mierzalnych podzadań (fizycznych kroków).
Zadanie: "${item.title}"
Sekcja: "${sectionName || 'Brak'}"
Powiązane marzenie: "${dreamTitle || 'Brak'}"

Odpowiedź sformatuj dokładnie tak: najpierw napisz krótki komentarz (max 2 zdania) oceniający czy zadanie nie jest unikiem (avoidance) i jak je sprawnie zacząć, a pod spodem wypisz zaproponowane podzadania w formacie listy markdown (np. - [ ] Zrób X).`;
    } else if (type === 'first_move') {
      queryText = `Zidentyfikuj najbliższe, fizyczne działanie trwające maksymalnie 2 minuty, które pozwoli mi przełamać opór i natychmiast wystartować z pracą nad zadaniem. Wyeliminuj wszelkie bariery wejścia.
Zadanie: "${item.title}"
Sekcja: "${sectionName || 'Brak'}"
Powiązane marzenie: "${dreamTitle || 'Brak'}"

Pisz niezwykle krótko, bez owijania w bawełnę, tonem bezpośrednim (maksymalnie 2-3 zdania).`;
    } else if (type === 'evaluate') {
      queryText = `Dokonaj bezlitosnej oceny wartości tego zadania.
Zadanie: "${item.title}"
Sekcja: "${sectionName || 'Brak'}"
Powiązane marzenie: "${dreamTitle || 'Brak'}"

Czy realizacja tego zadania to realny postęp w moich celach i marzeniach, czy ucieczka w bezpieczną zajętość (busywork/avoidance), aby uniknąć napięcia (outreachu, sprzedaży, realnego kontaktu z ludźmi)? Wskaż to wprost, surowym, konkretnym tonem (maksymalnie 3 zdania).`;
    }

    try {
      const { data, error } = await supabase.functions.invoke('vanguard-oracle', {
        body: {
          user_id: session.user.id,
          current_query: queryText,
          mode: 'chat',
          state_vector: {}
        }
      });

      if (error) throw error;
      const answer = data?.answer || data?.text || 'Brak odpowiedzi.';

      let parsedSubtasks: string[] = [];
      if (type === 'decompose') {
        const lines = answer.split('\n');
        const subtaskLines = lines.filter((l: string) => l.trim().startsWith('- [ ]'));
        parsedSubtasks = subtaskLines.map((l: string) => l.replace(/^-\s*\[\s*\]\s*/, '').trim()).filter(Boolean);
      }

      setAssistantResult({
        type,
        text: answer,
        subtasks: parsedSubtasks.length > 0 ? parsedSubtasks : undefined
      });
    } catch (err: any) {
      console.error('[assistant] error:', err);
      setAssistantError(err.message || 'Wystąpił błąd podczas analizy.');
    } finally {
      setAssistantLoading(false);
    }
  };

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
      onShowContextMenu(item, t.clientX, t.clientY);
    }, 600);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    clearTimeout(longPressTimer.current);
    if (isDragging) return;
    const dx = e.targetTouches[0].clientX - touchStartX;
    const dy = Math.abs(e.targetTouches[0].clientY - touchStartY);
    if (dy > 12) return;
    const newOffset = Math.max(-130, Math.min(130, dx));
    prevSwipeRef.current = newOffset;
    setSwipeOffset(newOffset);
    setSwipeDir(dx > 40 ? 'right' : dx < -40 ? 'left' : null);
  };

  const onTouchEnd = () => {
    clearTimeout(longPressTimer.current);
    prevSwipeRef.current = 0;
    if (!isDragging) {
      if (swipeOffset > 100) handleComplete();
      else if (swipeOffset < -100) onDrop();
    }
    setSwipeOffset(0);
    setSwipeDir(null);
  };

  const handleComplete = () => {
    if (isDone) {
      onToggle();
      return;
    }
    setCompleting(true);
    setTimeout(() => setCompletingOut(true), 130);
    setTimeout(() => {
      onToggle();
      setCompleting(false);
      setCompletingOut(false);
    }, 420);
  };

  // ── Grip: long press (mobile) / mousedown (desktop) ──
  const onGripTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    const t = e.touches[0];
    gripLongPressTimer.current = setTimeout(() => {
      onDragStart?.(item, t.clientX, t.clientY);
    }, 350);
  };

  const onGripTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    clearTimeout(gripLongPressTimer.current);
  };

  const onGripTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    clearTimeout(gripLongPressTimer.current);
  };

  const onGripMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    onDragStart?.(item, e.clientX, e.clientY);
  };

  return (
    <div
      className={`group relative ${isDone ? 'opacity-40' : ''}`}
      style={
        completingOut
          ? {
              transform: 'translateX(28px)',
              opacity: 0,
              pointerEvents: 'none',
              transition: 'transform 0.28s cubic-bezier(0.4,0,1,1), opacity 0.22s ease-out'
            }
          : { transition: 'opacity 0.15s' }
      }
    >
      {/* Swipe hint overlays */}
      <div
        className={`absolute inset-0 flex items-center justify-start pl-3 text-emerald-500 pointer-events-none transition-opacity duration-150 ${
          swipeDir === 'right' ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <Check size={15} strokeWidth={3} />
      </div>
      <div
        className={`absolute inset-0 flex items-center justify-end pr-3 text-rose-400 pointer-events-none transition-opacity duration-150 ${
          swipeDir === 'left' ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <X size={15} />
      </div>

      {/* Row */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onContextMenu={e => {
          e.preventDefault();
          onShowContextMenu(item, e.clientX, e.clientY);
        }}
        style={{ transform: `translateX(${swipeOffset}px)` }}
        onClick={e => e.stopPropagation()}
        className="relative border-b border-border-custom/10 px-1 py-3 transition-all duration-150 ease-out hover:bg-surface-solid/20"
      >
        <div className="flex items-start gap-3">
          {/* Drag grip */}
          <div
            onTouchStart={onGripTouchStart}
            onTouchEnd={onGripTouchEnd}
            onTouchMove={onGripTouchMove}
            onMouseDown={onGripMouseDown}
            className="mt-0.5 shrink-0 touch-none cursor-grab text-transparent group-hover:text-text-muted/15 transition-colors select-none"
          >
            <GripVertical size={13} />
          </div>

          {/* Emoji icon OR priority circle checkbox */}
          {icon ? (
            <button
              onClick={e => {
                e.stopPropagation();
                handleComplete();
              }}
              disabled={busy}
              className="shrink-0 mt-0.5"
            >
              <span
                className={`flex h-[20px] w-[20px] items-center justify-center text-[15px] leading-none transition-all ${
                  isDone ? 'grayscale opacity-40' : ''
                }`}
              >
                {icon}
              </span>
            </button>
          ) : (
            <button
              onClick={e => {
                e.stopPropagation();
                handleComplete();
              }}
              disabled={busy}
              className="mt-0.5 shrink-0"
            >
              <div
                className={`h-[15px] w-[15px] rounded-full border-[1.5px] flex items-center justify-center transition-all duration-200 ${
                  completing || isDone
                    ? `bg-emerald-500 border-transparent ${completing && !completingOut ? 'scale-[1.35]' : 'scale-100'}`
                    : `${p.ring} bg-transparent`
                }`}
              >
                {(completing || isDone) && <Check size={7} className="text-white" strokeWidth={3} />}
              </div>
            </button>
          )}

          {/* Content */}
          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onToggleExpand(item.id)}>
            <p
              className={`text-[14px] font-medium leading-snug transition-colors ${
                isDone ? 'line-through text-text-muted/50' : 'text-text-primary'
              }`}
            >
              {label}
            </p>

            {/* Metadata */}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0">
              {dateInfo && !isDone && <span className={`text-[10px] font-medium ${dateInfo.color}`}>{dateInfo.text}</span>}
              {item.recurrence && (
                <span className="flex items-center gap-0.5 text-[10px] text-primary/40">
                  <Repeat2 size={8} /> {RECURRENCE_LABELS[item.recurrence]}
                </span>
              )}
              {subtasks.length > 0 && <span className="text-[10px] text-text-muted/40">{doneCount}/{subtasks.length}</span>}
              {(item.tags || []).map((tag: string) => (
                <span key={tag} className="text-[10px] text-text-muted/35">
                  #{tag}
                </span>
              ))}
              {isLinkedToPlan && (
                <span className="flex items-center gap-0.5 text-[10px] text-primary/50">
                  <Link2 size={7} /> Plan
                </span>
              )}
              {sectionName &&
                (() => {
                  const GoalIcon = sectionGoalKey ? GOAL_ICON[sectionGoalKey] : null;
                  return (
                    <span className="flex items-center gap-1">
                      {GoalIcon && <GoalIcon size={7} className={GOAL_COLOR[sectionGoalKey!]} />}
                      <span className="text-[10px] text-text-muted/25 uppercase tracking-wider">{sectionName}</span>
                      {dreamTitle && (
                        <span className="text-[10px] text-primary/30 truncate max-w-[120px]">· {dreamTitle}</span>
                      )}
                    </span>
                  );
                })()}
            </div>
          </div>

          {/* Quick "→ Dziś" action */}
          {onMoveToToday && !isDone && (
            <button
              onClick={e => {
                e.stopPropagation();
                onMoveToToday();
              }}
              className="shrink-0 text-[11px] font-medium text-text-muted/30 hover:text-orange-500 transition-colors"
              title="Przesuń na dziś"
            >
              →
            </button>
          )}
        </div>

        {/* Expanded */}
        <div
          style={{
            display: 'grid',
            gridTemplateRows: expanded ? '1fr' : '0fr',
            transition: 'grid-template-rows 260ms cubic-bezier(0.4,0,0.2,1)'
          }}
        >
          <div style={{ overflow: 'hidden' }}>
            {expandMounted && (
              <div className="mt-3 space-y-3 border-t border-border-custom/10 pt-3" onClick={e => e.stopPropagation()}>
                {/* Inline title edit */}
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold text-text-muted">Tytuł</p>
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={e => onEditChange(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === 'Escape') onEditSave();
                      }}
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
                  <p className="rounded-xl border border-border-custom/40 bg-surface-solid/50 px-3 py-2.5 text-[11px] leading-relaxed text-text-secondary whitespace-pre-wrap">
                    {description}
                  </p>
                )}

                {/* Priority grid */}
                <div>
                  <p className="mb-1.5 text-[8px] font-black uppercase tracking-widest text-text-muted">Priorytet</p>
                  <div className="grid grid-cols-4 gap-1">
                    {PRIORITY_ORDER.map(pid => {
                      const pr = PRIORITY[pid];
                      const active = item.priority === pid;
                      return (
                        <button
                          key={pid}
                          onClick={() => onSetPriority(pid)}
                          className={`rounded-xl border py-2 text-[8px] font-black uppercase tracking-wide transition-all ${
                            active
                              ? `${pr.chip} border-transparent scale-[1.02]`
                              : 'border-border-custom/50 text-text-muted hover:border-border-custom'
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
                      {(['', 'daily', 'weekly', 'monthly'] as const).map(r => (
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

                {/* Reminder */}
                {!isDone && (
                  <div>
                    <p className="mb-1.5 text-[8px] font-black uppercase tracking-widest text-text-muted">Przypomnienie</p>
                    {item.reminder_at && !item.reminder_sent ? (
                      <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Bell size={11} className="text-primary" />
                          <span className="text-[12px] font-semibold text-primary">
                            {new Date(item.reminder_at).toLocaleString('pl-PL', {
                              timeZone: 'Europe/Warsaw',
                              month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <button
                          onClick={onCancelReminder}
                          className="flex items-center gap-1 text-[10px] font-semibold text-text-muted hover:text-rose-400 transition-colors"
                        >
                          <BellOff size={10} /> Anuluj
                        </button>
                      </div>
                    ) : item.reminder_sent ? (
                      <p className="text-[11px] text-text-muted/50">✓ Wysłano</p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="datetime-local"
                          value={reminderInput}
                          onChange={e => setReminderInput(e.target.value)}
                          className="flex-1 rounded-xl border border-border-custom/50 bg-surface-solid/40 px-3 py-1.5 text-[12px] text-text-primary outline-none focus:border-primary/30 [color-scheme:dark]"
                        />
                        <button
                          onClick={() => {
                            if (!reminderInput) return;
                            onSetReminder(new Date(reminderInput).toISOString());
                            setReminderInput('');
                          }}
                          disabled={!reminderInput}
                          className="shrink-0 flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-1.5 text-[11px] font-black text-primary disabled:opacity-30 hover:bg-primary/20 transition-colors"
                        >
                          <Bell size={10} /> Ustaw
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Section picker */}
                {sections.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold text-text-muted">Sekcja</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sections.map(s => (
                        <button
                          key={s.id}
                          onClick={() => onMoveSection(s.id)}
                          className={`rounded-full border px-2.5 py-1 text-[9px] font-black transition-colors ${
                            item.section_id === s.id
                              ? 'border-primary/20 bg-primary/10 text-primary'
                              : 'border-border-custom bg-surface-solid text-text-muted hover:text-text-primary'
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
                      <div
                        key={idx}
                        className="flex items-center gap-2.5 rounded-xl border border-border-custom/30 bg-surface-solid/40 px-3 py-2"
                      >
                        <button onClick={() => onToggleSubtask(idx)} className="shrink-0">
                          <div
                            className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
                              st.checked ? 'bg-emerald-500 border-emerald-500' : 'border-border-custom'
                            }`}
                          >
                            {st.checked && <Check size={8} className="text-white" strokeWidth={3} />}
                          </div>
                        </button>
                        <span
                          className={`min-w-0 flex-1 text-[11px] font-medium truncate ${
                            st.checked ? 'line-through text-text-muted' : 'text-text-primary'
                          }`}
                        >
                          {st.text}
                        </span>
                        <button
                          onClick={() => onDeleteSubtask(idx)}
                          className="shrink-0 text-text-muted/30 hover:text-rose-400 transition-colors"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-0.5">
                      <input
                        placeholder="Nowe podzadanie..."
                        value={newSubtask}
                        onChange={e => setNewSubtask(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newSubtask.trim()) {
                            onAddSubtask(newSubtask);
                            setNewSubtask('');
                          }
                        }}
                        className="min-w-0 flex-1 rounded-xl border border-border-custom/50 bg-surface-solid/40 px-3 py-2 text-[11px] font-medium text-text-primary outline-none placeholder:text-text-muted/35 focus:border-primary/30"
                      />
                      <button
                        onClick={() => {
                          if (newSubtask.trim()) {
                            onAddSubtask(newSubtask);
                            setNewSubtask('');
                          }
                        }}
                        disabled={!newSubtask.trim()}
                        className="rounded-xl bg-primary/90 px-3 py-2 text-[9px] font-black text-white disabled:opacity-30 hover:bg-primary transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* AI Assistant */}
                <div className="rounded-2xl border border-border-custom bg-surface-solid/25 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={11} className="text-primary" />
                      <span className="text-[9px] font-black uppercase tracking-wider text-text-primary">AI Asystent</span>
                    </div>
                    {assistantResult && (
                      <button
                        onClick={() => setAssistantResult(null)}
                        className="text-[9px] font-bold text-text-muted hover:text-text-primary transition-colors hover:underline"
                      >
                        Wyczyść
                      </button>
                    )}
                  </div>

                  {!assistantResult && !assistantLoading && (
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => runAssistant('decompose')}
                        className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border-custom/50 bg-surface-solid/35 p-2 text-center transition-all hover:bg-surface-solid/70 hover:border-primary/20 active:scale-[0.97] cursor-pointer"
                      >
                        <span className="text-[13px]">🧱</span>
                        <span className="text-[8.5px] font-bold text-text-primary leading-tight">Rozbij na kroki</span>
                      </button>
                      <button
                        onClick={() => runAssistant('first_move')}
                        className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border-custom/50 bg-surface-solid/35 p-2 text-center transition-all hover:bg-surface-solid/70 hover:border-primary/20 active:scale-[0.97] cursor-pointer"
                      >
                        <span className="text-[13px]">🏃</span>
                        <span className="text-[8.5px] font-bold text-text-primary leading-tight">Pierwszy ruch</span>
                      </button>
                      <button
                        onClick={() => runAssistant('evaluate')}
                        className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border-custom/50 bg-surface-solid/35 p-2 text-center transition-all hover:bg-surface-solid/70 hover:border-primary/20 active:scale-[0.97] cursor-pointer"
                      >
                        <span className="text-[13px]">⚖️</span>
                        <span className="text-[8.5px] font-bold text-text-primary leading-tight">Oceń unik</span>
                      </button>
                    </div>
                  )}

                  {assistantLoading && (
                    <div className="flex flex-col items-center justify-center py-3 gap-2 animate-pulse">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span className="text-[10px] font-medium text-text-muted">Analizowanie zadania...</span>
                    </div>
                  )}

                  {assistantError && (
                    <div className="rounded-xl bg-rose-500/5 border border-rose-500/10 p-2.5 text-[10px] font-medium text-rose-400">
                      {assistantError}
                    </div>
                  )}

                  {assistantResult && (
                    <div className="space-y-2.5 animate-fadeIn">
                      <div className="rounded-xl bg-surface-solid/40 p-2.5 text-[10.5px] font-medium text-text-primary leading-relaxed whitespace-pre-wrap">
                        {assistantResult.text}
                      </div>

                      {assistantResult.type === 'decompose' &&
                        assistantResult.subtasks &&
                        assistantResult.subtasks.length > 0 && (
                          <button
                            onClick={() => {
                              if (assistantResult.subtasks) {
                                onAddSubtasksBatch(assistantResult.subtasks);
                                setAssistantResult(null);
                              }
                            }}
                            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-black text-white hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-950/20 cursor-pointer"
                          >
                            <Check size={11} strokeWidth={3} />
                            Dodaj te podzadania ({assistantResult.subtasks.length})
                          </button>
                        )}
                    </div>
                  )}
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
      </div>
    </div>
  );
}
