import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Circle,
  Edit3,
  Flame,
  MessageSquare,
  Plus,
  Search,
  Send,
  Sparkles,
  Target,
  X,
  Zap,
  CalendarDays,
  ShieldAlert,
  Compass,
} from 'lucide-react';
import { getPlanForDate, upsertPlanForDate, checkReEntryMode, SupportingTask, DailyPlan } from '../../lib/dailyPlan';
import { listTodoItems, listTodoSections } from '../../lib/todo';
import { listProjects, listProjectCheckpoints } from '../../lib/projects';
import { getTodayWarsaw, getTomorrowWarsaw } from '../../lib/date';
import { supabase } from '../../lib/supabase';

// ── Energy bar ──────────────────────────────────────────────────────────────
const ENERGY_META = [
  { score: 1, label: 'Bardzo nisko', color: 'bg-rose-500' },
  { score: 2, label: 'Nisko',        color: 'bg-amber-500' },
  { score: 3, label: 'Normalnie',    color: 'bg-yellow-400' },
  { score: 4, label: 'Dobrze',       color: 'bg-emerald-400' },
  { score: 5, label: 'Świetnie!',    color: 'bg-emerald-500' },
];

function EnergyPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-black uppercase tracking-widest text-text-muted mr-1">Energia</span>
      {ENERGY_META.map(e => (
        <button
          key={e.score}
          onClick={() => onChange(e.score)}
          title={e.label}
          className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-black transition-all ${
            value === e.score
              ? `${e.color} text-white scale-110 shadow-md`
              : 'bg-surface-solid text-text-muted hover:scale-105'
          }`}
        >
          {e.score}
        </button>
      ))}
    </div>
  );
}

// ── Confidence gate ──────────────────────────────────────────────────────────
function ConfidencePicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <span className="text-[9px] font-black uppercase tracking-widest text-text-muted mr-1">Pewność</span>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`h-4 w-4 rounded-full text-[8px] font-black transition-all flex items-center justify-center ${
              value === n
                ? n < 8 ? 'bg-amber-500 text-white scale-110' : 'bg-emerald-500 text-white scale-110'
                : 'bg-surface-solid text-text-muted/60 hover:scale-105'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {value != null && value < 8 && (
        <p className="text-[11px] font-medium text-amber-500 leading-snug">
          Niska pewność — rozbij MIT na mniejszy, konkretniejszy krok albo wybierz inny.
        </p>
      )}
    </div>
  );
}

// ── MIT Picker (modal) ──────────────────────────────────────────────────────
interface MitPickerSource {
  id: string;
  title: string;
  type: 'todo' | 'checkpoint' | 'project-task';
  projectName?: string;
  priority?: string;
}

interface MitPickerProps {
  sources: MitPickerSource[];
  weekFocus: string | null;
  onSelect: (item: MitPickerSource | null, customText?: string) => void;
  onClose: () => void;
}

function MitPicker({ sources, weekFocus, onSelect, onClose }: MitPickerProps) {
  const [search, setSearch] = useState('');
  const [custom, setCustom] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = search
    ? sources.filter(s => s.title.toLowerCase().includes(search.toLowerCase()))
    : sources;

  const PRIORITY_DOT: Record<string, string> = {
    urgent: 'bg-rose-500', high: 'bg-indigo-500', normal: 'bg-blue-500', low: 'bg-emerald-500',
  };

  return (
    <div className="mt-2 overflow-hidden rounded-[18px] border border-primary/20 bg-surface shadow-xl shadow-black/10 animate-fadeIn z-10 relative">
      {/* Weekly Cascade */}
      {weekFocus && (
        <div className="bg-primary/[0.08] border-b border-primary/10 px-3 py-2 flex items-center gap-2">
          <Target size={12} className="text-primary/70 shrink-0" />
          <p className="text-[11px] font-medium text-primary/80 line-clamp-1">
            <strong className="font-black uppercase tracking-wider text-[9px] mr-1.5 opacity-80">Cel tyg:</strong>
            {weekFocus}
          </p>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 border-b border-border-custom px-3 py-2.5">
        <Search size={12} className="shrink-0 text-text-muted" />
        <input
          ref={inputRef}
          value={search}
          onChange={e => { setSearch(e.target.value); setCustom(''); }}
          onKeyDown={e => {
            if (e.key === 'Escape') onClose();
          }}
          placeholder="Szukaj zadania lub wpisz własny MIT..."
          className="flex-1 bg-transparent text-[12px] text-text-primary outline-none placeholder:text-text-muted/50"
        />
        <button onClick={onClose} className="text-text-muted hover:text-text-secondary">
          <X size={13} />
        </button>
      </div>

      {/* Custom MIT option at top if search has text and no match */}
      {search && (
        <button
          onClick={() => onSelect(null, search)}
          className="flex w-full items-center gap-2.5 border-b border-border-custom/30 px-3 py-2.5 hover:bg-primary/5 transition-colors text-left"
        >
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <Edit3 size={10} className="text-primary" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-primary/60">Własny MIT</p>
            <p className="text-[12px] font-semibold text-text-primary">{search}</p>
          </div>
        </button>
      )}

      {/* List */}
      <div className="max-h-64 overflow-y-auto">
        {filtered.length === 0 && !search && (
          <p className="py-6 text-center text-[12px] text-text-muted/50">Brak otwartych zadań</p>
        )}
        {filtered.map(item => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 hover:bg-surface-solid/80 transition-colors text-left"
          >
            <div className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[item.priority ?? 'normal'] ?? 'bg-blue-500'}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-text-primary">{item.title}</p>
              {item.projectName && (
                <p className="text-[10px] text-text-muted truncate">{item.projectName}</p>
              )}
            </div>
            <span className={`shrink-0 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
              item.type === 'checkpoint' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-surface-solid text-text-muted'
            }`}>
              {item.type === 'checkpoint' ? 'checkpoint' : 'task'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Shutdown Modal ──────────────────────────────────────────────────────────
function ShutdownModal({
  onSubmit,
  onClose,
  busy,
}: {
  onSubmit: (note: string) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const [note, setNote] = useState('');

  return (
    <div className="mt-3 animate-fadeIn rounded-[18px] border border-border-custom/60 bg-surface-solid/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare size={12} className="text-indigo-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Zamknięcie dnia</p>
      </div>
      <p className="text-[12px] text-text-secondary leading-relaxed">
        Co się udało? Co przeniesiesz na jutro? Jak czujesz zakończenie dnia?
      </p>
      <textarea
        autoFocus
        value={note}
        onChange={e => setNote(e.target.value)}
        rows={3}
        placeholder="Np: Napisałem 800 słów, meetingiem był czas stracony. Jutro: rano skupiam się na X..."
        className="w-full resize-none rounded-[12px] border border-border-custom/50 bg-background/60 px-3 py-2.5 text-[12px] text-text-primary leading-relaxed outline-none focus:border-primary/30 placeholder:text-text-muted/40"
      />
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={onClose}
          className="rounded-full bg-surface-solid px-3 py-1.5 text-[11px] font-semibold text-text-muted hover:text-text-secondary"
        >
          Anuluj
        </button>
        <button
          onClick={() => onSubmit(note)}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full bg-indigo-500 px-4 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
        >
          <Send size={11} /> Zamknij dzień
        </button>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
interface DayPlanCardProps {
  session: any;
}

type DayPhase = 'morning' | 'day' | 'evening';

function getDayPhase(): DayPhase {
  const hour = parseInt(
    new Date().toLocaleTimeString('en-CA', { timeZone: 'Europe/Warsaw', hour: 'numeric', hour12: false }),
    10,
  );
  if (hour < 12) return 'morning';
  if (hour < 17) return 'day';
  return 'evening';
}

export default function DayPlanCard({ session }: DayPlanCardProps) {
  const userId = session?.user?.id;
  const today = getTodayWarsaw();
  const tomorrow = getTomorrowWarsaw();
  const phase = getDayPhase();

  // Mode state: 'today' or 'tomorrow'
  const [targetDate, setTargetDate] = useState<string>(today);

  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [mitSources, setMitSources] = useState<MitPickerSource[]>([]);
  const [weekFocus, setWeekFocus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showMitPicker, setShowMitPicker] = useState(false);
  const [showShutdown, setShowShutdown] = useState(false);
  const [newSupportingText, setNewSupportingText] = useState('');
  const [showAddSupporting, setShowAddSupporting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [avoidedInput, setAvoidedInput] = useState('');

  // Re-entry mode detection
  const [isReEntry, setIsReEntry] = useState(false);

  // Load plan and MIT sources
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        const [currentPlan, sections, items, projects, checkpoints, wReview, reEntry] = await Promise.all([
          getPlanForDate(userId, targetDate),
          listTodoSections(userId),
          listTodoItems(userId),
          listProjects(userId),
          listProjectCheckpoints(userId),
          supabase.from('weekly_reviews').select('week_focus').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          checkReEntryMode(userId),
        ]);

        setPlan(currentPlan);
        
        // If it's today's plan and re-entry is detected (or it's already saved as a re-entry plan)
        const activeReEntry = (targetDate === today && reEntry) || currentPlan?.re_entry_mode;
        setIsReEntry(Boolean(activeReEntry));
        
        if (wReview.data?.week_focus) {
          setWeekFocus(wReview.data.week_focus);
        }

        // Build MIT sources
        const openItems = items.filter(i => i.status === 'open');
        const sectionById: Record<string, any> = Object.fromEntries(sections.map(s => [s.id, s]));
        const projectById: Record<string, any> = Object.fromEntries(projects.map(p => [p.id, p]));

        const sectionToProject: Record<string, string> = {};
        sections.forEach(s => {
          if (s.project_id && projectById[s.project_id]) {
            sectionToProject[s.id] = projectById[s.project_id].name;
          }
        });

        const todoSources: MitPickerSource[] = openItems
          .sort((a, b) => {
            const order: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
            return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
          })
          .slice(0, 30)
          .map(i => ({
            id: i.id,
            title: i.title,
            type: 'todo' as const,
            priority: i.priority,
            projectName: i.section_id ? sectionToProject[i.section_id] : undefined,
          }));

        const cpSources: MitPickerSource[] = checkpoints
          .filter(cp => cp.status === 'open')
          .slice(0, 15)
          .map(cp => {
            const proj = projects.find(p => p.id === cp.project_id);
            return {
              id: cp.id,
              title: cp.title,
              type: 'checkpoint' as const,
              projectName: proj?.name,
            };
          });

        setMitSources([...todoSources, ...cpSources]);
        setAvoidedInput(currentPlan?.avoided_task ?? '');
      } catch (e) {
        console.error('[DayPlanCard] load error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, targetDate, today]);

  const save = useCallback(async (patch: Partial<DailyPlan>) => {
    if (!userId) return;
    setBusy(true);
    try {
      const payload = { ...patch };
      if (isReEntry && !plan?.re_entry_mode) {
        payload.re_entry_mode = true;
      }
      const updated = await upsertPlanForDate(userId, targetDate, payload);
      setPlan(updated);
    } catch (e) {
      console.error('[DayPlanCard] save error', e);
    } finally {
      setBusy(false);
    }
  }, [userId, targetDate, isReEntry, plan]);

  const handleEnergyChange = (v: number) => save({ energy_level: v });

  const handleSelectMit = (item: MitPickerSource | null, customText?: string) => {
    setShowMitPicker(false);
    if (item) {
      save({ mit_task_id: item.id, mit_custom: null, mit_confidence: null });
    } else if (customText) {
      save({ mit_task_id: null, mit_custom: customText.trim(), mit_confidence: null });
    }
  };

  const handleClearMit = () => save({ mit_task_id: null, mit_custom: null, mit_confidence: null });

  const handleConfidenceChange = (v: number) => save({ mit_confidence: v });

  const saveAvoidedTask = () => {
    const trimmed = avoidedInput.trim();
    if (trimmed === (plan?.avoided_task ?? '')) return;
    save({ avoided_task: trimmed || null });
  };

  const handlePromoteAvoided = () => {
    const text = avoidedInput.trim();
    if (!text) return;
    save({ mit_task_id: null, mit_custom: text, mit_confidence: null, avoided_task: null });
    setAvoidedInput('');
  };

  const handleToggleSupporting = (idx: number) => {
    const supporting = [...(plan?.supporting ?? [])];
    supporting[idx] = { ...supporting[idx], done: !supporting[idx].done };
    save({ supporting });
  };

  const handleRemoveSupporting = (idx: number) => {
    const supporting = (plan?.supporting ?? []).filter((_, i) => i !== idx);
    save({ supporting });
  };

  const handleAddSupporting = () => {
    if (!newSupportingText.trim()) return;
    const supporting = [...(plan?.supporting ?? []), { title: newSupportingText.trim(), done: false }];
    save({ supporting });
    setNewSupportingText('');
    setShowAddSupporting(false);
  };

  const handleMiddayCheck = () => save({ midday_checked: true });

  const handleShutdown = async (note: string) => {
    await save({ shutdown_note: note || null, shutdown_at: new Date().toISOString() });
    setShowShutdown(false);
  };

  if (loading && !plan) return null;

  const mit = plan?.mit_custom
    ? plan.mit_custom
    : plan?.mit_task_id
      ? (mitSources.find(s => s.id === plan.mit_task_id)?.title ?? '(zadanie)')
      : null;

  const supporting: SupportingTask[] = plan?.supporting ?? [];
  const doneSupportingCount = supporting.filter(t => t.done).length;
  const hasPlan = Boolean(mit || supporting.length > 0);
  const isShutdownDone = Boolean(plan?.shutdown_at);
  const isPlanningTomorrow = targetDate === tomorrow;

  // Phase labels
  const PHASE_META: Record<DayPhase, { label: string; icon: React.ElementType; color: string; eyebrow: string }> = {
    morning: { label: 'Zaplanuj dziś', icon: Flame, color: 'text-amber-500', eyebrow: 'Poranek · Setup' },
    day:     { label: 'Jak idzie?',    icon: Zap,   color: 'text-blue-500',  eyebrow: 'W trakcie · Check-in' },
    evening: { label: 'Zamknij dzień', icon: MessageSquare, color: 'text-indigo-400', eyebrow: 'Wieczór · Shutdown' },
  };

  let pm = PHASE_META[phase];
  if (isPlanningTomorrow) {
    pm = { label: 'Plan na jutro', icon: CalendarDays, color: 'text-indigo-400', eyebrow: 'Wieczór · Setup' };
  } else if (isReEntry) {
    pm = { label: 'Odbudowa nawyku', icon: ShieldAlert, color: 'text-rose-500', eyebrow: 'Tryb Re-entry' };
  }

  return (
    <section className="animate-fadeIn rounded-[24px] border border-border-custom bg-surface p-4 shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(c => !c)}
        className="flex w-full items-center gap-2 text-left"
      >
        <pm.icon size={13} className={pm.color} />
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-text-muted">{pm.eyebrow}</p>
          <p className="text-[14px] font-bold text-text-primary leading-tight">{pm.label}</p>
        </div>
        {hasPlan && (
          <span className="shrink-0 text-[10px] font-bold text-text-muted">
            {mit ? '✓ MIT' : ''}{supporting.length > 0 && !isReEntry ? ` · ${doneSupportingCount}/${supporting.length}` : ''}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`shrink-0 text-text-muted transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
        />
      </button>

      {/* Evening toggle: Today shutdown vs Tomorrow plan */}
      {!isCollapsed && phase === 'evening' && !isReEntry && (
        <div className="mt-4 mb-2 flex rounded-lg bg-surface-solid p-1 gap-1">
          <button
            onClick={() => setTargetDate(today)}
            className={`flex-1 rounded-md py-1.5 text-[11px] font-semibold transition-all ${
              !isPlanningTomorrow ? 'bg-surface shadow-sm text-text-primary' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Dzisiaj
          </button>
          <button
            onClick={() => setTargetDate(tomorrow)}
            className={`flex-1 rounded-md py-1.5 text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
              isPlanningTomorrow ? 'bg-indigo-500 text-white shadow-sm' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <CalendarDays size={12} />
            Plan na Jutro
          </button>
        </div>
      )}

      {!isCollapsed && (
        <div className="mt-3 space-y-3">
        
          {/* Re-entry warning */}
          {isReEntry && !isPlanningTomorrow && (
            <div className="rounded-[12px] border border-rose-500/20 bg-rose-500/[0.04] p-3">
              <p className="text-[11px] font-medium text-rose-400">
                Wykryto dłuższą przerwę. Wybierz tylko **JEDNO zadanie** (MIT) na dziś, aby odzyskać momentum. Zadania poboczne zostały zablokowane.
              </p>
            </div>
          )}

          {/* Energy check-in (only morning / if not set yet, and not planning tomorrow) */}
          {((phase === 'morning' || !plan?.energy_level) && !isShutdownDone && !isPlanningTomorrow && !isReEntry) && (
            <EnergyPicker value={plan?.energy_level ?? null} onChange={handleEnergyChange} />
          )}

          {/* MIT */}
          <div className="rounded-[16px] border border-primary/15 bg-primary/[0.03] p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <Target size={11} className="text-primary/70" />
              <p className="text-[9px] font-black uppercase tracking-widest text-primary/70">MIT — Highlight dnia</p>
              {mit && (
                <button onClick={handleClearMit} className="ml-auto text-text-muted/40 hover:text-rose-400">
                  <X size={11} />
                </button>
              )}
            </div>

            {mit ? (
              <button
                onClick={() => setShowMitPicker(true)}
                className="flex w-full items-center gap-2.5 text-left"
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <Sparkles size={10} className="text-primary" />
                </div>
                <p className="text-[14px] font-bold leading-snug text-text-primary">{mit}</p>
              </button>
            ) : (
              <button
                onClick={() => setShowMitPicker(true)}
                className="flex w-full items-center gap-2 rounded-[12px] border border-dashed border-primary/25 px-3 py-2.5 text-left hover:bg-primary/5 transition-colors"
              >
                <Plus size={13} className="text-primary/60" />
                <p className="text-[12px] font-semibold text-text-muted">
                  {phase === 'morning' || isPlanningTomorrow ? 'Wybierz jeden główny cel...' : 'Brak MIT — wybierz teraz'}
                </p>
              </button>
            )}

            {showMitPicker && (
              <MitPicker
                sources={mitSources}
                weekFocus={weekFocus}
                onSelect={handleSelectMit}
                onClose={() => setShowMitPicker(false)}
              />
            )}

            {mit && !isPlanningTomorrow && !isShutdownDone && (
              <ConfidencePicker value={plan?.mit_confidence ?? null} onChange={handleConfidenceChange} />
            )}
          </div>

          {/* The Compass: what are you avoiding? */}
          {!isReEntry && !isPlanningTomorrow && !isShutdownDone && (
            <div className="rounded-[16px] border border-rose-500/15 bg-rose-500/[0.03] p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Compass size={11} className="text-rose-400/70" />
                <p className="text-[9px] font-black uppercase tracking-widest text-rose-400/70">Co dziś odkładasz?</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={avoidedInput}
                  onChange={e => setAvoidedInput(e.target.value)}
                  onBlur={saveAvoidedTask}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  placeholder="Zadanie, które unikasz — nazwij je..."
                  className="flex-1 bg-transparent text-[12.5px] text-text-primary outline-none placeholder:text-text-muted/40"
                />
                {avoidedInput.trim() && (
                  <button
                    onClick={handlePromoteAvoided}
                    className="shrink-0 rounded-full bg-rose-500/15 px-2.5 py-1 text-[10px] font-bold text-rose-500 hover:bg-rose-500/25 transition-colors"
                  >
                    Zrób to teraz
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Supporting tasks (hidden in Re-entry mode) */}
          {!isReEntry && (supporting.length > 0 || showAddSupporting) && (
            <div className="space-y-1.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-text-muted px-0.5">Poboczne (maks 3)</p>
              {supporting.map((t, idx) => (
                <div key={idx} className="flex items-center gap-2.5 group">
                  <button
                    onClick={() => handleToggleSupporting(idx)}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                      t.done ? 'border-emerald-500 bg-emerald-500' : 'border-border-custom'
                    }`}
                  >
                    {t.done && <Check size={9} className="text-white" strokeWidth={3} />}
                  </button>
                  <span className={`flex-1 truncate text-[13px] ${t.done ? 'line-through text-text-muted/50' : 'text-text-primary'}`}>
                    {t.title}
                  </span>
                  <button
                    onClick={() => handleRemoveSupporting(idx)}
                    className="opacity-0 group-hover:opacity-100 text-text-muted/40 hover:text-rose-400 transition-all"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add supporting */}
          {!isReEntry && supporting.length < 3 && !isShutdownDone && (
            showAddSupporting ? (
              <div className="flex items-center gap-2">
                <Circle size={14} className="shrink-0 text-text-muted/30" />
                <input
                  autoFocus
                  value={newSupportingText}
                  onChange={e => setNewSupportingText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); handleAddSupporting(); }
                    if (e.key === 'Escape') { setShowAddSupporting(false); setNewSupportingText(''); }
                  }}
                  placeholder="Poboczne zadanie..."
                  className="flex-1 bg-transparent text-[13px] text-text-primary outline-none placeholder:text-text-muted/40"
                />
                <button onClick={() => { setShowAddSupporting(false); setNewSupportingText(''); }} className="text-text-muted">
                  <X size={12} />
                </button>
                <button
                  onClick={handleAddSupporting}
                  disabled={!newSupportingText.trim()}
                  className="rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary disabled:opacity-30"
                >
                  Dodaj
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddSupporting(true)}
                className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted hover:text-text-secondary transition-colors"
              >
                <Plus size={11} /> dodaj poboczne zadanie
              </button>
            )
          )}

          {/* Phase-specific actions */}
          {!isPlanningTomorrow && phase === 'day' && !plan?.midday_checked && hasPlan && (
            <button
              onClick={handleMiddayCheck}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-blue-500/25 bg-blue-500/[0.06] py-2.5 text-[12px] font-semibold text-blue-500 hover:bg-blue-500/10 transition-colors disabled:opacity-40"
            >
              <Check size={13} /> MIT gotowy / aktualizuję plan
            </button>
          )}

          {!isPlanningTomorrow && phase === 'day' && plan?.midday_checked && (
            <div className="flex items-center gap-2 rounded-[12px] bg-emerald-500/[0.06] border border-emerald-500/20 px-3 py-2">
              <Check size={12} className="text-emerald-500" />
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Check-in zaliczony</p>
            </div>
          )}

          {!isPlanningTomorrow && phase === 'evening' && !isShutdownDone && (
            <button
              onClick={() => setShowShutdown(true)}
              className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-indigo-500/25 bg-indigo-500/[0.06] py-2.5 text-[12px] font-semibold text-indigo-400 hover:bg-indigo-500/10 transition-colors"
            >
              <MessageSquare size={13} /> Zamknij dzień
            </button>
          )}

          {!isPlanningTomorrow && isShutdownDone && (
            <div className="rounded-[14px] border border-indigo-500/15 bg-indigo-500/[0.04] px-3 py-2.5 space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Dzień zamknięty ✓</p>
              {plan?.shutdown_note && (
                <p className="text-[12px] text-text-secondary leading-relaxed italic">"{plan.shutdown_note}"</p>
              )}
            </div>
          )}

          {showShutdown && (
            <ShutdownModal
              onSubmit={handleShutdown}
              onClose={() => setShowShutdown(false)}
              busy={busy}
            />
          )}
        </div>
      )}
    </section>
  );
}
