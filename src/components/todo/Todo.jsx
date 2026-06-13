import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Calendar,
  CheckSquare,
  ChevronLeft,
  Inbox,
  Plus,
  Settings2,
  Square,
  Trash2,
} from 'lucide-react';
import DataStateNotice from '../core/DataStateNotice';
import {
  archiveTodoSection,
  createTodoItem,
  createTodoSection,
  listTodoItems,
  listTodoSections,
  setTodoStatus,
  updateTodoItem,
} from '../../lib/todo';
import { parseTodoQuickInput } from '../../lib/todoParser';
import { supabase } from '../../lib/supabase';

const PRIORITIES = [
  { id: 'low', label: 'low', dot: 'bg-emerald-500', chip: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/15' },
  { id: 'normal', label: 'normal', dot: 'bg-blue-500', chip: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/15' },
  { id: 'high', label: 'high', dot: 'bg-indigo-500', chip: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/15' },
  { id: 'urgent', label: 'urgent', dot: 'bg-rose-500', chip: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/15' },
];

const FILTERS = [
  { id: 'open', label: 'Otwarte' },
  { id: 'today', label: 'Dzisiaj' },
  { id: 'someday', label: 'Kiedyś' },
  { id: 'done', label: 'Done' },
];

function priorityMeta(priority) {
  return PRIORITIES.find((p) => p.id === priority) || PRIORITIES[1];
}

const getFocusPoints = (priority) => {
  switch (priority) {
    case 'low': return 1; // Quick Win
    case 'normal': return 1; // Shallow Focus
    case 'high': return 3; // Deep Focus
    case 'urgent': return 2; // Urgent / Block
    default: return 1;
  }
};

const parseSubtasks = (notes) => {
  if (!notes) return { description: '', subtasks: [] };
  const lines = notes.split('\n');
  const subtasks = [];
  const descLines = [];
  
  lines.forEach((line, index) => {
    const match = line.match(/^\s*[-*]\s+\[([ xX])\]\s*(.*)$/);
    if (match) {
      subtasks.push({
        id: index,
        checked: match[1].toLowerCase() === 'x',
        text: match[2].trim()
      });
    } else {
      descLines.push(line);
    }
  });
  
  return {
    description: descLines.join('\n').trim(),
    subtasks
  };
};

const serializeSubtasks = (description, subtasks) => {
  const descPart = description.trim();
  const subtasksPart = subtasks
    .map(st => `- [${st.checked ? 'x' : ' '}] ${st.text}`)
    .join('\n');
    
  if (descPart && subtasksPart) {
    return `${descPart}\n\n${subtasksPart}`;
  }
  return descPart || subtasksPart;
};

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-colors ${
        active 
          ? 'bg-text-primary text-background shadow-sm' 
          : 'bg-surface border border-border-custom text-text-secondary hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

function QuickField({ children }) {
  return <div className="rounded-xl border border-border-custom bg-surface p-3">{children}</div>;
}

function TodoCard({ 
  item, 
  onToggle, 
  onCyclePriority, 
  onDrop, 
  expanded, 
  onToggleExpand,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
  busy,
  today
}) {
  const [touchStart, setTouchStart] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipingRight, setSwipingRight] = useState(false);
  const [swipingLeft, setSwipingLeft] = useState(false);
  const [newSubtaskText, setNewSubtaskText] = useState('');

  const { description, subtasks } = useMemo(() => parseSubtasks(item.notes), [item.notes]);
  const completedSubtasks = subtasks.filter(s => s.checked).length;
  const totalSubtasks = subtasks.length;

  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    const currentX = e.targetTouches[0].clientX;
    const diff = currentX - touchStart;
    
    if (diff > 140) {
      setSwipeOffset(140);
    } else if (diff < -140) {
      setSwipeOffset(-140);
    } else {
      setSwipeOffset(diff);
    }

    if (diff > 40) {
      setSwipingRight(true);
      setSwipingLeft(false);
    } else if (diff < -40) {
      setSwipingLeft(true);
      setSwipingRight(false);
    } else {
      setSwipingRight(false);
      setSwipingLeft(false);
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset > 100) {
      onToggle();
    } else if (swipeOffset < -100) {
      onDrop();
    }
    setSwipeOffset(0);
    setSwipingRight(false);
    setSwipingLeft(false);
  };

  let borderLeftColor = 'border-l-blue-500';
  let energyLabel = 'Shallow Focus';
  let energyIcon = '☕️';

  if (item.priority === 'low') {
    borderLeftColor = 'border-l-emerald-500';
    energyLabel = 'Quick Win';
    energyIcon = '🧹';
  } else if (item.priority === 'high') {
    borderLeftColor = 'border-l-indigo-500';
    energyLabel = 'Deep Focus';
    energyIcon = '⚡️';
  } else if (item.priority === 'urgent') {
    borderLeftColor = 'border-l-rose-500';
    energyLabel = 'Urgent / Block';
    energyIcon = '🚨';
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border-custom bg-surface/40 backdrop-blur-md mb-3 shadow-sm transition-colors hover:bg-surface/60">
      <div 
        className={`absolute inset-0 flex items-center justify-start pl-6 bg-emerald-500/20 text-emerald-500 transition-opacity duration-200 ${
          swipingRight ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <span className="font-bold text-[10px] uppercase tracking-wider">Gotowe</span>
      </div>

      <div 
        className={`absolute inset-0 flex items-center justify-end pr-6 bg-rose-500/20 text-rose-500 transition-opacity duration-200 ${
          swipingLeft ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <span className="font-bold text-[10px] uppercase tracking-wider">Odpuść</span>
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${swipeOffset}px)` }}
        className={`relative bg-surface p-4 border-l-4 ${borderLeftColor} transition-transform duration-200 ease-out select-none cursor-pointer`}
      >
        <div className="flex items-start gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            disabled={busy}
            className="mt-0.5 text-text-muted hover:text-emerald-500 transition-colors"
          >
            {item.status === 'done' ? (
              <CheckSquare size={18} className="text-emerald-500" />
            ) : (
              <Square size={18} />
            )}
          </button>

          <div className="min-w-0 flex-1" onClick={() => onToggleExpand(item.id)}>
            <p className={`text-[13px] font-semibold leading-snug ${item.status === 'done' ? 'text-text-muted line-through opacity-70' : 'text-text-primary'}`}>
              {item.title}
            </p>
            
            {description && (
              <p className="mt-1 text-[10.5px] font-medium leading-snug text-text-secondary line-clamp-2">
                {description}
              </p>
            )}

            {totalSubtasks > 0 && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-black text-primary">
                <span>{completedSubtasks}/{totalSubtasks} podzadań</span>
              </div>
            )}

            <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCyclePriority();
                }}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest bg-text-primary/5 text-text-secondary border border-border-custom hover:bg-text-primary/10 transition-colors"
              >
                <span>{energyIcon}</span>
                <span>{energyLabel}</span>
              </button>

              {item.due_date && (
                <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-text-muted">
                  <Calendar size={9} /> {item.due_date === today ? 'Dzisiaj' : format(new Date(item.due_date), 'd MMM')}
                </span>
              )}

              {(item.tags || []).map((tag) => (
                <span key={tag} className="text-[8px] font-black uppercase tracking-widest text-text-muted/80 bg-text-primary/[0.04] px-1.5 py-0.5 rounded-md border border-border-custom">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 border-t border-border-custom pt-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            {description && (
              <div className="text-[11px] font-medium text-text-secondary bg-surface-solid rounded-xl p-3 border border-border-custom whitespace-pre-wrap">
                {description}
              </div>
            )}

            <div className="space-y-2">
              <h5 className="text-[9px] font-black uppercase tracking-widest text-text-muted">Podzadania</h5>
              {subtasks.map((st, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 bg-surface-solid border border-border-custom/40 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button onClick={() => onToggleSubtask(idx)} className="text-text-secondary hover:text-emerald-500 shrink-0">
                      {st.checked ? <CheckSquare size={14} className="text-emerald-500" /> : <Square size={14} />}
                    </button>
                    <span className={`text-[11px] font-semibold truncate ${st.checked ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                      {st.text}
                    </span>
                  </div>
                  <button onClick={() => onDeleteSubtask(idx)} className="text-text-muted hover:text-rose-500 p-1">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Dodaj podzadanie..."
                  value={newSubtaskText}
                  onChange={(e) => setNewSubtaskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onAddSubtask(newSubtaskText);
                      setNewSubtaskText('');
                    }
                  }}
                  className="min-w-0 flex-1 bg-surface-solid border border-border-custom rounded-xl px-3 py-2 text-[11px] font-semibold text-text-primary outline-none"
                />
                <button
                  onClick={() => {
                    onAddSubtask(newSubtaskText);
                    setNewSubtaskText('');
                  }}
                  disabled={!newSubtaskText.trim()}
                  className="rounded-xl bg-primary px-3 py-2 text-[9px] font-black uppercase text-white hover:bg-primary-hover disabled:opacity-40"
                >
                  Dodaj
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TriageTinderDeck({ 
  item, 
  sections, 
  onAssignSection, 
  onSetToday, 
  onSetSomeday, 
  onDrop, 
  onClose 
}) {
  const [showSectionList, setShowSectionList] = useState(false);

  return (
    <div className="flex-1 flex flex-col justify-between py-4 min-h-[350px]">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[8px] font-black uppercase tracking-widest text-text-muted">Szybkie Sortowanie (Tinder Mode)</span>
        <button onClick={onClose} className="text-[8px] font-black uppercase tracking-widest text-rose-500 hover:underline">Zamknij</button>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center p-6 bg-surface-solid border border-border-custom rounded-2xl shadow-inner text-center my-4">
        <h3 className="text-[14px] font-black text-text-primary leading-snug max-w-[280px]">
          {item.title}
        </h3>
        {item.notes && (
          <p className="mt-2 text-[10.5px] font-medium text-text-secondary line-clamp-3 max-w-[260px] whitespace-pre-wrap">
            {item.notes}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {showSectionList ? (
          <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto p-1 border border-border-custom rounded-xl bg-surface/50">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => {
                  onAssignSection(s.id);
                  setShowSectionList(false);
                }}
                className="rounded-lg bg-surface border border-border-custom py-2 px-3 text-[9px] font-black uppercase tracking-wider text-text-primary hover:border-primary/40 active:scale-95 transition-all truncate"
              >
                {s.name}
              </button>
            ))}
            <button
              onClick={() => setShowSectionList(false)}
              className="col-span-2 rounded-lg bg-rose-500/10 border border-rose-500/20 py-2 text-[9px] font-black uppercase tracking-wider text-rose-500 hover:bg-rose-500/20 transition-all"
            >
              Wróć
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={onSetSomeday}
              className="flex flex-col items-center justify-center rounded-xl bg-surface border border-border-custom py-3 text-text-secondary hover:text-text-primary active:scale-95 transition-all"
            >
              <span className="text-lg">☕️</span>
              <span className="text-[8px] font-black uppercase tracking-widest mt-1">Kiedyś</span>
            </button>
            <button
              onClick={onSetToday}
              className="flex flex-col items-center justify-center rounded-xl bg-primary border border-primary/20 py-3 text-white active:scale-95 transition-all"
            >
              <span className="text-lg">⚡️</span>
              <span className="text-[8px] font-black uppercase tracking-widest mt-1">Dziś</span>
            </button>
            <button
              onClick={onDrop}
              className="flex flex-col items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 py-3 text-rose-500 hover:bg-rose-500/20 active:scale-95 transition-all"
            >
              <span className="text-lg">🗑️</span>
              <span className="text-[8px] font-black uppercase tracking-widest mt-1">Odpuść</span>
            </button>
            
            <button
              onClick={() => setShowSectionList(true)}
              className="col-span-3 rounded-xl bg-surface-solid border border-border-custom py-2.5 text-[9px] font-black uppercase tracking-widest text-text-primary hover:bg-surface active:scale-95 transition-all"
            >
              Przypisz Sekcję...
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Todo({ session, onBack }) {
  const userId = session.user.id;
  const [sections, setSections] = useState([]);
  const [items, setItems] = useState([]);
  const [dailyStrain, setDailyStrain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('open');
  const [activeSection, setActiveSection] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [triageOpen, setTriageOpen] = useState(false);
  const [tinderMode, setTinderMode] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    notes: '',
    priority: 'normal',
    tagsText: '',
    due_date: '',
  });

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [s, i, { data: strainData }] = await Promise.all([
        listTodoSections(userId),
        listTodoItems(userId),
        supabase
          .from('daily_strain')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);
      setSections(s || []);
      setItems(i || []);
      setDailyStrain(strainData);
      if (!activeSection && s?.length) setActiveSection(s[0].id);
    } catch (err) {
      console.error('Todo fetch:', err);
      setError(err.message);
    }
  }, [activeSection, userId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchAll();
      setLoading(false);
    })();
  }, [fetchAll]);

  const sectionById = useMemo(() => Object.fromEntries(sections.map((s) => [s.id, s])), [sections]);
  const openItems = useMemo(() => items.filter((i) => i.status === 'open'), [items]);
  const parsedInput = useMemo(() => parseTodoQuickInput(form.title), [form.title]);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

  const budget = useMemo(() => {
    if (dailyStrain?.daily_status === 'green' || dailyStrain?.readiness_level === 'optimal') return 6;
    if (dailyStrain?.daily_status === 'yellow' || dailyStrain?.readiness_level === 'good') return 4;
    if (dailyStrain?.daily_status === 'red' || dailyStrain?.readiness_level === 'pay_attention') return 2;
    return 5;
  }, [dailyStrain]);

  const completedPoints = useMemo(() => {
    return items.reduce((sum, item) => {
      const isDoneToday = item.status === 'done' && item.completed_at && 
        new Date(item.completed_at).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' }) === today;
      if (isDoneToday) {
        return sum + getFocusPoints(item.priority);
      }
      return sum;
    }, 0);
  }, [items, today]);

  const progressPercentage = Math.min(100, Math.round((completedPoints / budget) * 100)) || 0;

  const triageItems = useMemo(() => {
    return items.filter(item => item.section_id === null && item.status === 'open');
  }, [items]);

  const filteredSections = useMemo(() => {
    if (filter === 'done') return sections;
    if (filter === 'someday') return sections.filter((s) => /kiedyś|wizje/i.test(s.name));
    if (filter === 'today') return sections.filter((s) => /teraz|7 dni/i.test(s.name));
    return sections;
  }, [filter, sections]);

  const visibleItems = useCallback((sectionId) => {
    return items.filter((item) => {
      if (item.section_id !== sectionId) return false;
      if (filter === 'done') return item.status === 'done';
      if (filter === 'today') return item.status === 'open' && (item.due_date === today || /teraz|7 dni/i.test(sectionById[item.section_id]?.name || ''));
      if (filter === 'someday') return item.status === 'open' && /kiedyś|wizje/i.test(sectionById[item.section_id]?.name || '');
      return item.status === 'open';
    });
  }, [filter, items, sectionById, today]);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await fetchAll();
    } catch (err) {
      console.error('Todo action:', err);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const addItem = () => {
    const title = parsedInput.title || form.title.trim();
    if (!title) return;
    run(async () => {
      await createTodoItem(userId, {
        ...form,
        title,
        priority: parsedInput.priority || form.priority,
        due_date: parsedInput.due_date || form.due_date,
        section_id: activeSection,
      });
      setForm({ title: '', notes: '', priority: form.priority, tagsText: '', due_date: '' });
      setShowOptions(false);
    });
  };

  const addSection = () => {
    if (!newSectionName.trim()) return;
    run(async () => {
      const created = await createTodoSection(userId, newSectionName, sections.length * 10 + 10);
      setActiveSection(created.id);
      setNewSectionName('');
      setShowSectionForm(false);
    });
  };

  const cyclePriority = (item) => {
    const idx = PRIORITIES.findIndex((p) => p.id === item.priority);
    const next = PRIORITIES[(idx + 1) % PRIORITIES.length].id;
    run(() => updateTodoItem(item.id, { priority: next }));
  };

  const toggleSubtask = async (item, subtaskIndex) => {
    const { description, subtasks } = parseSubtasks(item.notes);
    const updatedSubtasks = subtasks.map((st, idx) => 
      idx === subtaskIndex ? { ...st, checked: !st.checked } : st
    );
    const serialized = serializeSubtasks(description, updatedSubtasks);
    await run(() => updateTodoItem(item.id, { notes: serialized }));
  };

  const addSubtask = async (item, text) => {
    if (!text.trim()) return;
    const { description, subtasks } = parseSubtasks(item.notes);
    const updatedSubtasks = [...subtasks, { checked: false, text: text.trim() }];
    const serialized = serializeSubtasks(description, updatedSubtasks);
    await run(() => updateTodoItem(item.id, { notes: serialized }));
  };

  const deleteSubtask = async (item, subtaskIndex) => {
    const { description, subtasks } = parseSubtasks(item.notes);
    const updatedSubtasks = subtasks.filter((_, idx) => idx !== subtaskIndex);
    const serialized = serializeSubtasks(description, updatedSubtasks);
    await run(() => updateTodoItem(item.id, { notes: serialized }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-5 text-text-primary flex items-center justify-center transition-colors duration-300">
        <DataStateNotice tone="loading" title="To Do się ładuje" detail="Pobieram sekcje i zadania." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-primary transition-colors duration-300">
      <div className="mx-auto flex min-h-screen max-w-md flex-col border-x border-border-custom bg-background/40 backdrop-blur-3xl pb-24 shadow-sm">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-custom bg-background/80 px-5 py-4 backdrop-blur-xl">
          <button 
            onClick={onBack} 
            className="rounded-full border border-border-custom bg-surface/50 p-2 text-text-secondary hover:text-text-primary hover:bg-surface shadow-sm transition-colors" 
            title="Wróć"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-[16px] font-black uppercase tracking-tight text-text-primary font-display">
              <Inbox size={16} className="text-primary" /> To Do
            </h1>
            <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mt-0.5">
              {openItems.length} otwarte · {triageItems.length} w skrzynce
            </p>
          </div>
        </header>

        <main className="space-y-5 p-5">
          {error && <DataStateNotice tone="warning" title="Błąd" detail={error} />}

          <section className="space-y-3">
            <div className="flex items-center gap-4 rounded-2xl border border-border-custom bg-surface/60 backdrop-blur-md p-4 shadow-sm">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
                <svg className="h-full w-full -rotate-90">
                  <circle
                    cx="28"
                    cy="28"
                    r="22"
                    className="stroke-border-custom fill-none"
                    strokeWidth="3.5"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r="22"
                    className="stroke-primary fill-none transition-all duration-500 ease-out"
                    strokeWidth="3.5"
                    strokeDasharray="138.2"
                    strokeDashoffset={138.2 - (progressPercentage / 100) * 138.2}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-[12px] font-black leading-none">{completedPoints}</span>
                  <span className="text-[8px] font-bold text-text-muted leading-none mt-0.5">/{budget}</span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-text-primary">
                  Budżet Skupienia
                </h4>
                <p className="mt-1 text-[11px] font-medium leading-snug text-text-secondary">
                  {dailyStrain?.daily_status === 'green' && '🟢 Mocny dzień! Dobre warunki na: Deep Focus ⚡️.'}
                  {dailyStrain?.daily_status === 'yellow' && '🟡 Zrównoważony dzień. Zrób: Shallow ☕️ lub Quick Wins 🧹.'}
                  {dailyStrain?.daily_status === 'red' && '🔴 Dziś zalecana regeneracja. Skup się na Quick Wins 🧹.'}
                  {!dailyStrain && 'Wczytuję dane biometryczne...'}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border-custom bg-surface backdrop-blur-md p-4.5 shadow-sm">
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
                placeholder="Wrzuć rzecz do zrobienia..."
                className="min-w-0 flex-1 bg-transparent px-2 py-3 text-[15px] font-bold text-text-primary outline-none placeholder:text-text-muted/40"
              />
              <button
                onClick={() => setShowOptions((v) => !v)}
                className={`rounded-full p-2.5 transition-colors border border-border-custom ${showOptions ? 'bg-primary/15 text-primary border-primary/20' : 'bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-solid'}`}
                title="Opcje"
              >
                <Settings2 size={17} />
              </button>
              <button
                onClick={addItem}
                disabled={busy || !form.title.trim()}
                className="rounded-full bg-primary p-2.5 text-white shadow-lg shadow-primary/25 hover:bg-primary-hover active:scale-95 disabled:opacity-35 transition-all cursor-pointer"
                title="Dodaj"
              >
                <Plus size={17} />
              </button>
            </div>

            {(parsedInput.tokens.length > 0 || (parsedInput.title && parsedInput.title !== form.title.trim())) && (
              <div className="mt-2 flex flex-wrap items-center gap-2 px-2 pb-1">
                {parsedInput.tokens.map((token) => {
                  if (token.type === 'priority') {
                    const meta = priorityMeta(token.value);
                    return (
                      <span
                        key={`${token.type}-${token.value}`}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${meta.chip}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                        {token.label}
                      </span>
                    );
                  }
                  return (
                    <span
                      key={`${token.type}-${token.value}`}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-primary"
                    >
                      <Calendar size={10} />
                      {token.label}
                    </span>
                  );
                })}
                {parsedInput.title && parsedInput.title !== form.title.trim() && (
                  <span className="min-w-0 truncate text-[10px] font-bold text-text-muted">
                    zapiszę jako: <span className="text-text-secondary font-bold">{parsedInput.title}</span>
                  </span>
                )}
              </div>
            )}

            {showOptions && (
              <div className="mt-3 space-y-3 border-t border-border-custom pt-3">
                <QuickField>
                  <select
                    value={activeSection}
                    onChange={(e) => setActiveSection(e.target.value)}
                    className="w-full bg-transparent text-[12px] font-black text-text-primary outline-none cursor-pointer"
                  >
                    {sections.map((s) => <option key={s.id} value={s.id} className="bg-surface-solid text-text-primary">{s.name}</option>)}
                  </select>
                </QuickField>
                <QuickField>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    placeholder="Opis, link albo kontekst... (Subzadania pisz jako: - [ ] krok)"
                    className="w-full resize-none bg-transparent text-[12px] font-semibold text-text-primary outline-none placeholder:text-text-muted/40"
                  />
                </QuickField>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <QuickField>
                    <input
                      value={form.tagsText}
                      onChange={(e) => setForm({ ...form, tagsText: e.target.value })}
                      placeholder="tagi: zakup, projekt"
                      className="w-full bg-transparent text-[12px] font-semibold text-text-primary outline-none placeholder:text-text-muted/40"
                    />
                  </QuickField>
                  <QuickField>
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                      className="bg-transparent text-[11px] font-bold text-text-secondary outline-none cursor-pointer"
                    />
                  </QuickField>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRIORITIES.map((p) => (
                    <Chip key={p.id} active={form.priority === p.id} onClick={() => setForm({ ...form, priority: p.id })}>
                      {p.label}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-1 overflow-x-auto pb-1">
                {FILTERS.map((f) => (
                  <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</Chip>
                ))}
              </div>
              <button
                onClick={() => setShowSectionForm((v) => !v)}
                className="shrink-0 rounded-full border border-border-custom bg-surface px-3.5 py-2 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-surface-solid hover:border-primary/20 transition-all cursor-pointer"
              >
                + Sekcja
              </button>
            </div>
            {showSectionForm && (
              <div className="flex gap-2 rounded-2xl border border-border-custom bg-surface backdrop-blur-md p-3">
                <input
                  autoFocus
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addSection(); }}
                  placeholder="Nowa sekcja"
                  className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-text-primary outline-none placeholder:text-text-muted/40"
                />
                <button 
                  onClick={addSection} 
                  disabled={busy || !newSectionName.trim()} 
                  className="rounded-full bg-primary px-4 text-[9px] font-black uppercase tracking-widest text-white hover:bg-primary-hover active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
                >
                  Dodaj
                </button>
              </div>
            )}
          </section>

          <section className="space-y-6">
            {filteredSections.map((section) => {
              const list = visibleItems(section.id);
              const openCount = items.filter((i) => i.section_id === section.id && i.status === 'open').length;
              if (filter !== 'open' && list.length === 0) return null;
              return (
                <article key={section.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <div className="min-w-0">
                      <h3 className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-text-primary font-display">{section.name}</h3>
                      <p className="mt-0.5 text-[8px] font-black uppercase tracking-widest text-text-muted">{openCount} otwarte</p>
                    </div>
                    <button
                      onClick={() => run(() => archiveTodoSection(section.id))}
                      className="text-text-muted/60 transition-colors hover:text-rose-500"
                      title="Archiwizuj sekcję"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {list.length === 0 ? (
                    <p className="px-1 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted">Pusto.</p>
                  ) : (
                    <div className="space-y-1">
                      {list.map((item) => (
                        <TodoCard
                          key={item.id}
                          item={item}
                          busy={busy}
                          expanded={expandedCardId === item.id}
                          onToggleExpand={setExpandedCardId}
                          onToggle={() => run(() => setTodoStatus(item, item.status === 'done' ? 'open' : 'done'))}
                          onCyclePriority={() => cyclePriority(item)}
                          onDrop={() => run(() => setTodoStatus(item, 'dropped'))}
                          onToggleSubtask={(idx) => toggleSubtask(item, idx)}
                          onAddSubtask={(text) => addSubtask(item, text)}
                          onDeleteSubtask={(idx) => deleteSubtask(item, idx)}
                          today={today}
                        />
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        </main>
      </div>

      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40">
        <button 
          onClick={() => setTriageOpen(true)}
          className="relative flex items-center gap-2 rounded-full bg-text-primary px-5 py-3 text-[10px] font-black uppercase tracking-widest text-background shadow-lg hover:scale-105 active:scale-95 transition-all"
        >
          <Inbox size={14} /> Triage ({triageItems.length})
          {triageItems.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white">
              {triageItems.length}
            </span>
          )}
        </button>
      </div>

      {triageOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-background/60 backdrop-blur-sm transition-opacity duration-300">
          <div className="absolute inset-0" onClick={() => setTriageOpen(false)} />
          
          <div className="relative flex max-h-[85vh] w-full max-w-md mx-auto flex-col rounded-t-[32px] border-t border-border-custom bg-background/95 backdrop-blur-2xl shadow-2xl p-6 transition-transform duration-300">
            
            <div className="mx-auto h-1.5 w-12 rounded-full bg-text-muted/30 mb-5 cursor-pointer" onClick={() => setTriageOpen(false)} />
            
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[15px] font-black uppercase tracking-tight text-text-primary flex items-center gap-2">
                  <Inbox size={16} className="text-primary" /> Skrzynka (Triage)
                </h2>
                <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mt-0.5">
                  {triageItems.length} nieprzypisanych myśli
                </p>
              </div>
              
              {triageItems.length > 0 && (
                <button
                  onClick={() => setTinderMode((m) => !m)}
                  className="rounded-full bg-primary/10 border border-primary/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/20 transition-all"
                >
                  {tinderMode ? 'Widok Listy' : 'Triage Tinder 🔥'}
                </button>
              )}
            </div>

            {tinderMode && triageItems.length > 0 ? (
              <TriageTinderDeck 
                item={triageItems[0]} 
                sections={sections}
                onAssignSection={(sectionId) => {
                  run(() => updateTodoItem(triageItems[0].id, { section_id: sectionId }));
                }}
                onSetToday={() => {
                  run(() => updateTodoItem(triageItems[0].id, { due_date: today, section_id: sections[0]?.id || null }));
                }}
                onSetSomeday={() => {
                  const somedaySection = sections.find(s => /kiedyś|wizje/i.test(s.name));
                  run(() => updateTodoItem(triageItems[0].id, { section_id: somedaySection?.id || sections[0]?.id || null }));
                }}
                onDrop={() => {
                  run(() => setTodoStatus(triageItems[0], 'dropped'));
                }}
                onClose={() => setTinderMode(false)}
              />
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pb-8 pr-1">
                {triageItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <span className="text-3xl mb-2">🎉</span>
                    <p className="text-[12px] font-black uppercase tracking-widest text-text-muted">Skrzynka jest pusta!</p>
                    <p className="text-[10px] font-medium text-text-secondary mt-1 max-w-[200px]">Wszystkie myśli zostały sklasyfikowane i uporządkowane.</p>
                  </div>
                ) : (
                  triageItems.map(item => (
                    <TodoCard
                      key={item.id}
                      item={item}
                      busy={busy}
                      expanded={expandedCardId === item.id}
                      onToggleExpand={setExpandedCardId}
                      onToggle={() => run(() => setTodoStatus(item, 'done'))}
                      onCyclePriority={() => cyclePriority(item)}
                      onDrop={() => run(() => setTodoStatus(item, 'dropped'))}
                      onToggleSubtask={(idx) => toggleSubtask(item, idx)}
                      onAddSubtask={(text) => addSubtask(item, text)}
                      onDeleteSubtask={(idx) => deleteSubtask(item, idx)}
                      today={today}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
