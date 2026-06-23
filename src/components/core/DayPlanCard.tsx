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
} from 'lucide-react';
import { getTodayPlan, upsertDailyPlan, SupportingTask, DailyPlan } from '../../lib/dailyPlan';
import { listTodoItems, listTodoSections, setTodoStatus } from '../../lib/todo';
import { listProjects, listProjectCheckpoints } from '../../lib/projects';
import { getTodayWarsaw } from '../../lib/date';

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
  onSelect: (item: MitPickerSource | null, customText?: string) => void;
  onClose: () => void;
}

function MitPicker({ sources, onSelect, onClose }: MitPickerProps) {
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
    <div className="mt-2 overflow-hidden rounded-[18px] border border-primary/20 bg-surface shadow-xl shadow-black/10 animate-fadeIn">
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
  const phase = getDayPhase();

  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [mitSources, setMitSources] = useState<MitPickerSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showMitPicker, setShowMitPicker] = useState(false);
  const [showShutdown, setShowShutdown] = useState(false);
  const [newSupportingText, setNewSupportingText] = useState('');
  const [showAddSupporting, setShowAddSupporting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load plan and MIT sources
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        const [currentPlan, sections, items, projects, checkpoints] = await Promise.all([
          getTodayPlan(userId),
          listTodoSections(userId),
          listTodoItems(userId),
          listProjects(userId),
          listProjectCheckpoints(userId),
        ]);

        setPlan(currentPlan);

        // Build MIT sources
        const openItems = items.filter(i => i.status === 'open');
        const sectionById: Record<string, any> = Object.fromEntries(sections.map(s => [s.id, s]));
        const projectById: Record<string, any> = Object.fromEntries(projects.map(p => [p.id, p]));

        // Get project name for each section that has project_id
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
      } catch (e) {
        console.error('[DayPlanCard] load error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, today]);

  const save = useCallback(async (patch: Partial<DailyPlan>) => {
    if (!userId) return;
    setBusy(true);
    try {
      const updated = await upsertDailyPlan(userId, patch);
      setPlan(updated);
    } catch (e) {
      console.error('[DayPlanCard] save error', e);
    } finally {
      setBusy(false);
    }
  }, [userId]);

  const handleEnergyChange = (v: number) => save({ energy_level: v });

  const handleSelectMit = (item: MitPickerSource | null, customText?: string) => {
    setShowMitPicker(false);
    if (item) {
      save({ mit_task_id: item.id, mit_custom: null });
    } else if (customText) {
      save({ mit_task_id: null, mit_custom: customText.trim() });
    }
  };

  const handleClearMit = () => save({ mit_task_id: null, mit_custom: null });

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

  if (loading) return null;

  const mit = plan?.mit_custom
    ? plan.mit_custom
    : plan?.mit_task_id
      ? (mitSources.find(s => s.id === plan.mit_task_id)?.title ?? '(zadanie)')
      : null;

  const supporting: SupportingTask[] = plan?.supporting ?? [];
  const doneSupportingCount = supporting.filter(t => t.done).length;
  const hasPlan = Boolean(mit || supporting.length > 0);
  const isShutdownDone = Boolean(plan?.shutdown_at);

  // Phase labels
  const PHASE_META: Record<DayPhase, { label: string; icon: React.ElementType; color: string; eyebrow: string }> = {
    morning: { label: 'Zaplanuj dziś', icon: Flame, color: 'text-amber-500', eyebrow: 'Poranek · Setup' },
    day:     { label: 'Jak idzie?',    icon: Zap,   color: 'text-blue-500',  eyebrow: 'W trakcie · Check-in' },
    evening: { label: 'Zamknij dzień', icon: MessageSquare, color: 'text-indigo-400', eyebrow: 'Wieczór · Shutdown' },
  };

  const pm = PHASE_META[phase];

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
            {mit ? '✓ MIT' : ''}{supporting.length > 0 ? ` · ${doneSupportingCount}/${supporting.length}` : ''}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`shrink-0 text-text-muted transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
        />
      </button>

      {!isCollapsed && (
        <div className="mt-3 space-y-3">

          {/* Energy check-in (only morning / if not set yet) */}
          {(phase === 'morning' || !plan?.energy_level) && !isShutdownDone && (
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
                  {phase === 'morning' ? 'Wybierz jeden główny cel na dziś...' : 'Brak MIT — wybierz teraz'}
                </p>
              </button>
            )}

            {showMitPicker && (
              <MitPicker
                sources={mitSources}
                onSelect={handleSelectMit}
                onClose={() => setShowMitPicker(false)}
              />
            )}
          </div>

          {/* Supporting tasks */}
          {(supporting.length > 0 || showAddSupporting) && (
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
          {supporting.length < 3 && !isShutdownDone && (
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
          {phase === 'day' && !plan?.midday_checked && hasPlan && (
            <button
              onClick={handleMiddayCheck}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-blue-500/25 bg-blue-500/[0.06] py-2.5 text-[12px] font-semibold text-blue-500 hover:bg-blue-500/10 transition-colors disabled:opacity-40"
            >
              <Check size={13} /> MIT gotowy / aktualizuję plan
            </button>
          )}

          {phase === 'day' && plan?.midday_checked && (
            <div className="flex items-center gap-2 rounded-[12px] bg-emerald-500/[0.06] border border-emerald-500/20 px-3 py-2">
              <Check size={12} className="text-emerald-500" />
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Check-in zaliczony</p>
            </div>
          )}

          {phase === 'evening' && !isShutdownDone && (
            <button
              onClick={() => setShowShutdown(true)}
              className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-indigo-500/25 bg-indigo-500/[0.06] py-2.5 text-[12px] font-semibold text-indigo-400 hover:bg-indigo-500/10 transition-colors"
            >
              <MessageSquare size={13} /> Zamknij dzień
            </button>
          )}

          {isShutdownDone && (
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
