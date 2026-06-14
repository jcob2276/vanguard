import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Briefcase, Calendar, CheckSquare, Play, Plus, RotateCw, Square, Target, Trash2, TrendingUp, Shield, Zap, Volume2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import DataStateNotice from '../core/DataStateNotice';
import {
  createDecision,
  createMove,
  createProject,
  listDecisions,
  listEvidence,
  listMoves,
  listProjects,
  setMoveStatus,
  updateProject,
  deriveNextMove,
  projectStats,
  createEvidence,
} from '../../lib/career';

const LEVELS = ['low', 'mid', 'high'];
const VALUE_TYPES = ['leverage', 'system', 'revenue', 'opti'];
const WORK_MODES = ['deep', 'shallow'];
const SENSE_CYCLE = ['worth_it', 'speculative', 'waste'];

const SENSE = {
  worth_it: { label: 'worth it', cls: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400' },
  speculative: { label: 'speculative', cls: 'border-amber-500/20 bg-amber-500/8 text-amber-600 dark:text-amber-400' },
  waste: { label: 'waste', cls: 'border-rose-500/20 bg-rose-500/8 text-rose-600 dark:text-rose-400' },
};

const VT = {
  leverage: 'border-indigo-500/20 bg-indigo-500/8 text-indigo-600 dark:text-indigo-400',
  system: 'border-cyan-500/20 bg-cyan-500/8 text-cyan-600 dark:text-cyan-400',
  revenue: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400',
  opti: 'border-purple-500/20 bg-purple-500/8 text-purple-600 dark:text-purple-400',
};

const DECISION_TYPES = ['commit', 'pivot', 'freeze'];

function plural(n, [one, few, many]) {
  const v = Math.abs(n) % 100;
  const v10 = v % 10;
  if (v > 10 && v < 20) return many;
  if (v10 > 1 && v10 < 5) return few;
  if (n === 1) return one;
  return many;
}

function warsawToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
}

function SectionTitle({ icon: Icon, title, action = null }: any) {
  return (
    <header className="flex items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.22em] text-text-muted">
        {Icon && <Icon size={12} className="text-primary" />} {title}
      </p>
      {action}
    </header>
  );
}

function Eyebrow({ children }: any) {
  return (
    <p className="text-[8px] font-black uppercase tracking-[0.22em] text-primary">
      {children}
    </p>
  );
}

function Pill({ active, onClick, children, tone = null }: any) {
  const base = 'rounded-md border px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all';
  const on = tone || 'border-primary/40 bg-primary/15 text-primary';
  const off = 'border-border-custom bg-surface text-text-muted';
  return (
    <button type="button" onClick={onClick} className={`${base} ${active ? on : off}`}>
      {children}
    </button>
  );
}

export default function Career({ session }) {
  const userId = session.user.id;
  const [projects, setProjects] = useState([]);
  const [moves, setMoves] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showMoveForm, setShowMoveForm] = useState(false);
  const [showDecisionForm, setShowDecisionForm] = useState(false);
  const [projectForm, setProjectForm] = useState({ name: '', thesis: '', leverage_level: null, cost_level: null, risk_level: null });
  const [moveForm, setMoveForm] = useState({ title: '', project_id: '', value_type: 'leverage', work_mode: 'deep' });
  const [decisionForm, setDecisionForm] = useState({ title: '', decision: '', decision_type: 'commit', project_id: '', review_date: '' });

  // Sales Lab state
  const [showSalesTips, setShowSalesTips] = useState(false);
  const [outreach, setOutreach] = useState(() => Number(localStorage.getItem('sales_outreach') || 0));
  const [connected, setConnected] = useState(() => Number(localStorage.getItem('sales_connected') || 0));
  const [disqualified, setDisqualified] = useState(() => Number(localStorage.getItem('sales_disqualified') || 0));
  const [booked, setBooked] = useState(() => Number(localStorage.getItem('sales_booked') || 0));
  const [fillers, setFillers] = useState(() => Number(localStorage.getItem('sales_fillers') || 0));

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('sales_outreach', String(outreach));
    localStorage.setItem('sales_connected', String(connected));
    localStorage.setItem('sales_disqualified', String(disqualified));
    localStorage.setItem('sales_booked', String(booked));
    localStorage.setItem('sales_fillers', String(fillers));
  }, [outreach, connected, disqualified, booked, fillers]);

  const saveSalesMetrics = async () => {
    const summary = `Sales Lab: ${outreach} outreach, ${connected} connected, ${disqualified} odrzuconych (No-Fit), ${booked} booked, filery: ${fillers}`;
    run(async () => {
      await createEvidence(userId, {
        project_id: null,
        type: 'manual',
        title: summary,
        occurred_at: new Date().toISOString(),
      });
      setOutreach(0);
      setConnected(0);
      setDisqualified(0);
      setBooked(0);
      setFillers(0);
    });
  };

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [p, m, e, d] = await Promise.all([
        listProjects(userId), listMoves(userId), listEvidence(userId), listDecisions(userId),
      ]);
      setProjects(p || []); setMoves(m || []); setEvidence(e || []); setDecisions(d || []);
    } catch (err) {
      console.error('Career fetch:', err);
      setError(err.message);
    }
  }, [userId]);

  useEffect(() => {
    (async () => { setLoading(true); await fetchAll(); setLoading(false); })();
  }, [fetchAll]);

  const projectById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const nextMove = useMemo(() => deriveNextMove(moves), [moves]);
  const openMoves = useMemo(() => moves.filter((m) => ['todo', 'doing', 'blocked'].includes(m.status)), [moves]);
  const doneMoves = useMemo(() => moves.filter((m) => m.status === 'done').slice(0, 6), [moves]);
  const activeCount = projects.filter((p) => p.status === 'active').length;

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); await fetchAll(); }
    catch (err) { console.error('Career action:', err); setError(err.message); }
    finally { setBusy(false); }
  };

  const addProject = () => {
    if (!projectForm.name.trim()) return;
    run(async () => {
      await createProject(userId, {
        name: projectForm.name.trim(),
        thesis: projectForm.thesis.trim() || null,
        leverage_level: projectForm.leverage_level,
        cost_level: projectForm.cost_level,
        risk_level: projectForm.risk_level,
      });
      setProjectForm({ name: '', thesis: '', leverage_level: null, cost_level: null, risk_level: null });
      setShowProjectForm(false);
    });
  };

  const addMove = () => {
    if (!moveForm.title.trim()) return;
    run(async () => {
      await createMove(userId, {
        title: moveForm.title.trim(),
        project_id: moveForm.project_id || null,
        value_type: moveForm.value_type,
        work_mode: moveForm.work_mode,
        planned_for: warsawToday(),
      });
      setMoveForm({ title: '', project_id: moveForm.project_id, value_type: 'leverage', work_mode: 'deep' });
      setShowMoveForm(false);
    });
  };

  const addDecision = () => {
    if (!decisionForm.title.trim()) return;
    run(async () => {
      await createDecision(userId, {
        title: decisionForm.title.trim(),
        decision: decisionForm.decision.trim() || null,
        decision_type: decisionForm.decision_type,
        project_id: decisionForm.project_id || null,
        review_date: decisionForm.review_date || null,
      });
      setDecisionForm({ title: '', decision: '', decision_type: 'commit', project_id: '', review_date: '' });
      setShowDecisionForm(false);
    });
  };

  const cycleSense = (project) => {
    const next = SENSE_CYCLE[(SENSE_CYCLE.indexOf(project.sense_status) + 1) % SENSE_CYCLE.length];
    run(() => updateProject(project.id, { sense_status: next }));
  };

  const openMoveFormFor = (projectId) => {
    setMoveForm((f) => ({ ...f, project_id: projectId }));
    setShowMoveForm(true);
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-border-custom bg-surface/50 p-5 shadow-sm animate-pulse">
        <DataStateNotice tone="loading" title="Kariera się ładuje" detail="Pobieram projekty, ruchy i dowody." />
      </section>
    );
  }

  return (
    <div className="space-y-7">
      {/* 1 — Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-black uppercase tracking-tight text-text-primary font-display">
            <Briefcase size={16} className="text-primary" /> Kariera
          </h2>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            {activeCount} {plural(activeCount, ['projekt', 'projekty', 'projektów'])}
            {' · '}
            {openMoves.length} {plural(openMoves.length, ['ruch otwarty', 'ruchy otwarte', 'ruchów otwartych'])}
          </p>
        </div>
        <p className="max-w-[150px] text-right text-[9px] font-semibold leading-tight text-text-muted">
          Gdzie idzie 8h pracy i czy pcha karierę
        </p>
      </div>

      {error && <DataStateNotice tone="warning" title="Błąd" detail={error} />}

      {/* 2 — Najważniejszy ruch */}
      <section className="relative overflow-hidden rounded-[24px] border border-primary/20 bg-gradient-to-br from-primary/[0.04] to-rose-500/[0.02] p-5 shadow-sm">
        <Eyebrow>Najważniejszy ruch teraz</Eyebrow>
        {nextMove ? (
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[16px] font-black uppercase tracking-tight text-text-primary font-display">{nextMove.title}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {nextMove.value_type && <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${VT[nextMove.value_type]}`}>{nextMove.value_type}</span>}
                {nextMove.project_id && projectById[nextMove.project_id] && (
                  <span className="rounded-full border border-border-custom bg-surface px-2 py-0.5 text-[9px] font-black uppercase text-text-secondary shadow-sm">{projectById[nextMove.project_id].name}</span>
                )}
                {nextMove.work_mode && <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">{nextMove.work_mode}</span>}
              </div>
            </div>
            <button onClick={() => run(() => setMoveStatus(nextMove, 'done'))} disabled={busy}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors hover:bg-primary/20 disabled:opacity-50 cursor-pointer" title="Zrobione">
              <CheckSquare size={20} />
            </button>
          </div>
        ) : projects.length === 0 ? (
          <p className="mt-2 text-[11px] font-bold leading-relaxed text-text-secondary">Najpierw dodaj projekt — potem ruch, który go pchnie.</p>
        ) : (
          <button onClick={() => setShowMoveForm(true)} className="mt-2 text-left text-[12px] font-black uppercase leading-snug tracking-tight text-text-secondary transition-colors hover:text-primary cursor-pointer">
            Wybierz jeden ruch, który dziś pchnie projekt →
          </button>
        )}
      </section>

      {/* 2.5 — Sales Lab Widget */}
      <section className="relative overflow-hidden rounded-[24px] border border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.04] to-primary/[0.02] p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Eyebrow>Sales Lab: Setting & Closing</Eyebrow>
            <h3 className="text-[14px] font-black uppercase tracking-tight text-text-primary font-display mt-0.5 font-display">Trening i Statystyki</h3>
          </div>
          <button
            type="button"
            onClick={() => setShowSalesTips(!showSalesTips)}
            className="flex items-center gap-1 border border-indigo-500/25 bg-indigo-550/8 px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-indigo-550 dark:text-indigo-400 rounded-lg hover:bg-indigo-500/15 transition-all cursor-pointer"
          >
            {showSalesTips ? 'Ukryj wskazówki' : 'Zasady Rozmowy'}
          </button>
        </div>

        {/* Expandable Coaching Guidelines */}
        {showSalesTips && (
          <div className="rounded-xl border border-indigo-500/15 bg-surface/60 p-3.5 space-y-3.5 text-[11px] font-semibold text-text-secondary leading-relaxed animate-in fade-in-50 duration-200">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-wider text-indigo-550 dark:text-indigo-400 flex items-center gap-1 font-display">
                <Shield size={11} /> Rama Eksperta (Brak Needy)
              </p>
              <p className="pl-3.5 border-l border-indigo-500/20">
                To Ty masz kontrolę. Klient przychodzi z problemem i to on musi udowodnić, że nadaje się do rozwiązania. Szukaj powodów do dyskwalifikacji (Red Flags).
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-wider text-emerald-500 flex items-center gap-1 font-display">
                <Volume2 size={11} /> Pauza i Kontrola Ciszy
              </p>
              <p className="pl-3.5 border-l border-emerald-500/20">
                Zadaj pytanie i zamknij usta. Brak komfortu z ciszą rozbija napięcie. Cisza buduje pewność siebie i autorytet.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-wider text-amber-505 dark:text-amber-400 flex items-center gap-1 font-display">
                <Zap size={11} /> Zasada 3 Sekund
              </p>
              <p className="pl-3.5 border-l border-amber-500/20">
                Odbij każde pytanie klienta (np. o cenę) i natychmiast przekieruj rozmowę zadając swoje pytanie. Zawsze miej ostatnie słowo.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-wider text-rose-500 flex items-center gap-1 font-display">
                <Target size={11} /> Aktywne Słuchanie
              </p>
              <p className="pl-3.5 border-l border-rose-500/20">
                Słuchaj odpowiedzi, zamiast czekać na swoją kolej na zadanie kolejnego pytania. Szczegóły budują zaufanie (nie popełnij błędu z Neuronikiem).
              </p>
            </div>
          </div>
        )}

        {/* Daily Scorecard Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          {[
            { label: 'Wiadomości / Dials', value: outreach, set: setOutreach, color: 'text-text-primary' },
            { label: 'Połączeni (Rozmowa)', value: connected, set: setConnected, color: 'text-indigo-400 font-display' },
            { label: 'Odrzuceni (No-Fit) [Tarcza]', value: disqualified, set: setDisqualified, color: 'text-rose-500 font-bold font-display' },
            { label: 'Zarezerwowani (Booked)', value: booked, set: setBooked, color: 'text-emerald-500 font-display' },
            { label: 'Filery (Zapychacze)', value: fillers, set: setFillers, color: 'text-amber-500 font-display' }
          ].map((item, idx) => (
            <div key={idx} className="bg-surface border border-border-custom rounded-xl p-3 flex flex-col items-center justify-between shadow-sm">
              <span className="text-[8px] font-black uppercase tracking-wider text-text-muted text-center leading-tight mb-1">
                {item.label}
              </span>
              <span className={`text-lg font-black py-1 ${item.color}`}>
                {item.value}
              </span>
              <div className="flex gap-1.5 w-full mt-1.5">
                <button
                  type="button"
                  onClick={() => item.set(Math.max(0, item.value - 1))}
                  className="flex-1 py-1 rounded-md border border-border-custom bg-surface hover:bg-surface-solid text-[10px] font-bold text-text-secondary cursor-pointer transition-all"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => item.set(item.value + 1)}
                  className="flex-1 py-1 rounded-md border border-indigo-500/20 bg-indigo-550/10 hover:bg-indigo-550/20 text-[10px] font-bold text-indigo-400 cursor-pointer transition-all"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 pt-2 border-t border-border-custom/50">
          <button
            type="button"
            onClick={saveSalesMetrics}
            disabled={busy || (outreach === 0 && connected === 0 && disqualified === 0 && booked === 0 && fillers === 0)}
            className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 py-2.5 text-[9px] font-black uppercase tracking-widest text-white shadow-sm shadow-indigo-600/10 transition-all cursor-pointer disabled:opacity-45"
          >
            {busy ? 'Zapisywanie...' : 'Zapisz raport jako dowód'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm('Zresetować dzisiejsze statystyki?')) {
                setOutreach(0);
                setConnected(0);
                setDisqualified(0);
                setBooked(0);
                setFillers(0);
              }
            }}
            className="px-4 py-2.5 rounded-xl border border-border-custom bg-surface hover:bg-surface-solid text-[9px] font-black uppercase tracking-widest text-text-secondary cursor-pointer transition-all"
          >
            Reset
          </button>
        </div>
      </section>

      {/* 3 + 4 — Projekty kariery */}
      <section className="space-y-3">
        <SectionTitle icon={Briefcase} title="Projekty kariery" action={(
          <button onClick={() => setShowProjectForm((v) => !v)} className="flex items-center gap-1 border border-primary/20 bg-primary/8 px-3.5 py-2 text-[9px] font-black uppercase tracking-widest text-primary rounded-xl hover:bg-primary/15 transition-all cursor-pointer">
            <Plus size={12} /> Projekt
          </button>
        )} />

        {showProjectForm && (
          <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 animate-in slide-in-from-top-2">
            <input autoFocus value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') addProject(); }}
              placeholder="Nazwa projektu — wpisz i Enter" className="w-full rounded-xl border border-border-custom bg-surface p-3 text-[13px] font-bold text-text-primary outline-none placeholder:text-text-muted/45 focus:border-primary/50 focus:bg-surface-solid focus:shadow-[0_0_0_3px_rgba(79,70,229,0.08)]" />
            <input value={projectForm.thesis} onChange={(e) => setProjectForm({ ...projectForm, thesis: e.target.value })}
              placeholder="Teza — po co to istnieje? (opcjonalnie)" className="w-full rounded-xl border border-border-custom bg-surface p-3 text-[12px] font-semibold text-text-primary outline-none placeholder:text-text-muted/45 focus:border-primary/50 focus:bg-surface-solid focus:shadow-[0_0_0_3px_rgba(79,70,229,0.08)]" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[8px] font-black uppercase tracking-widest text-text-muted">Dźwignia</span>
              {[1, 2, 3].map((n) => <Pill key={n} active={projectForm.leverage_level === n} onClick={() => setProjectForm({ ...projectForm, leverage_level: n })}>{n}</Pill>)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[8px] font-black uppercase tracking-widest text-text-muted">Koszt</span>
              {LEVELS.map((l) => <Pill key={l} active={projectForm.cost_level === l} onClick={() => setProjectForm({ ...projectForm, cost_level: l })}>{l}</Pill>)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[8px] font-black uppercase tracking-widest text-text-muted">Ryzyko</span>
              {LEVELS.map((l) => <Pill key={l} active={projectForm.risk_level === l} onClick={() => setProjectForm({ ...projectForm, risk_level: l })}>{l}</Pill>)}
            </div>
            <button onClick={addProject} disabled={busy} className="w-full rounded-xl bg-primary hover:bg-primary-hover py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-md shadow-primary/20 transition-all cursor-pointer">Dodaj projekt</button>
          </div>
        )}

        {projects.length === 0 && !showProjectForm && (
          <button onClick={() => setShowProjectForm(true)} className="w-full rounded-2xl border border-dashed border-border-custom bg-surface/30 p-5 text-left transition-all hover:border-primary/40 hover:bg-primary/5 shadow-sm cursor-pointer">
            <p className="text-[11px] font-black uppercase tracking-widest text-text-primary">Zacznij od projektu</p>
            <p className="mt-1.5 text-[10px] font-semibold leading-relaxed text-text-secondary">np. „Vanguard", „Klient", „Nauka", „Sprzedaż". Projekt to nośnik sensu, nie lista zadań.</p>
          </button>
        )}

        {projects.map((p) => {
          const st = projectStats(p, moves, evidence);
          const sense = SENSE[p.sense_status] || SENSE.worth_it;
          return (
            <article key={p.id} className="rounded-[20px] border border-border-custom bg-surface backdrop-blur-md p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="truncate text-[13px] font-black uppercase tracking-tight text-text-primary font-display">{p.name}</h4>
                  {p.thesis && <p className="mt-1 text-[10px] font-semibold leading-snug text-text-secondary">{p.thesis}</p>}
                </div>
                <button onClick={() => cycleSense(p)} disabled={busy} title="Kliknij, by zmienić sens"
                  className={`shrink-0 rounded-md border px-2 py-1 text-[8px] font-black uppercase tracking-widest cursor-pointer ${sense.cls}`}>
                  {sense.label}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[9px] font-black uppercase tracking-widest text-text-secondary">
                <span className="inline-flex items-center gap-1">
                  dźwignia
                  <span className="ml-0.5 inline-flex gap-0.5">
                    {[1, 2, 3].map((n) => <span key={n} className={`h-1.5 w-1.5 rounded-full ${p.leverage_level >= n ? 'bg-primary' : 'bg-text-primary/10'}`} />)}
                  </span>
                </span>
                {p.cost_level && <span className="text-text-secondary">koszt {p.cost_level}</span>}
                {p.risk_level && <span className="text-text-secondary">ryzyko {p.risk_level}</span>}
                <span className="text-emerald-500 font-bold">{st.done} done</span>
                <span className="text-text-muted font-bold">{st.open} todo</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border-custom pt-3">
                <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted">
                  {st.lastEvidenceAt ? `output ${format(new Date(st.lastEvidenceAt), 'd MMM HH:mm')}` : 'brak outputu'}
                </span>
                <button onClick={() => openMoveFormFor(p.id)} className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-primary/80 hover:text-primary cursor-pointer">
                  <Plus size={11} /> ruch
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {/* 5 — Szybkie dodanie ruchu */}
      <section className="space-y-3">
        <SectionTitle icon={Target} title="Ruchy" action={(
          <button onClick={() => setShowMoveForm((v) => !v)} className="flex items-center gap-1 border border-primary/20 bg-primary/8 px-3.5 py-2 text-[9px] font-black uppercase tracking-widest text-primary rounded-xl hover:bg-primary/15 transition-all cursor-pointer">
            <Plus size={12} /> Ruch
          </button>
        )} />

        {showMoveForm && (
          <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 animate-in slide-in-from-top-2">
            <input autoFocus value={moveForm.title} onChange={(e) => setMoveForm({ ...moveForm, title: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') addMove(); }}
              placeholder="Co konkretnie robisz? — wpisz i Enter" className="w-full rounded-xl border border-border-custom bg-surface p-3 text-[13px] font-bold text-text-primary outline-none placeholder:text-text-muted/45 focus:border-primary/50 focus:bg-surface-solid focus:shadow-[0_0_0_3px_rgba(79,70,229,0.08)]" />
            <select value={moveForm.project_id} onChange={(e) => setMoveForm({ ...moveForm, project_id: e.target.value })}
              className="w-full rounded-xl border border-border-custom bg-surface p-3 text-[12px] font-bold text-text-primary outline-none focus:border-primary/50 focus:bg-surface-solid focus:shadow-[0_0_0_3px_rgba(79,70,229,0.08)]">
              <option value="">— bez projektu —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="flex flex-wrap gap-2">
              {VALUE_TYPES.map((v) => <Pill key={v} active={moveForm.value_type === v} tone={`border ${VT[v]}`} onClick={() => setMoveForm({ ...moveForm, value_type: v })}>{v}</Pill>)}
            </div>
            <div className="flex flex-wrap gap-2">
              {WORK_MODES.map((w) => <Pill key={w} active={moveForm.work_mode === w} onClick={() => setMoveForm({ ...moveForm, work_mode: w })}>{w}</Pill>)}
            </div>
            <button onClick={addMove} disabled={busy} className="w-full rounded-xl bg-primary hover:bg-primary-hover py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-md shadow-primary/20 transition-all cursor-pointer">Dodaj ruch (dziś)</button>
          </div>
        )}

        {/* 6 — Lista ruchów */}
        {openMoves.length === 0 && !showMoveForm && (
          <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-text-muted">Brak otwartych ruchów.</p>
        )}
        {openMoves.map((m) => (
          <article key={m.id} className="rounded-[20px] border border-border-custom bg-surface backdrop-blur-md p-4.5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-black uppercase tracking-tight text-text-primary font-display">{m.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {m.value_type && <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase ${VT[m.value_type]}`}>{m.value_type}</span>}
                  {m.project_id && projectById[m.project_id] && <span className="text-[8px] font-black uppercase tracking-widest text-text-secondary">{projectById[m.project_id].name}</span>}
                  {m.status === 'blocked' && <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-rose-500"><AlertCircle size={10} /> blok</span>}
                  {m.status === 'doing' && <span className="text-[8px] font-black uppercase tracking-widest text-amber-500">w toku</span>}
                </div>
              </div>
              <button onClick={() => run(() => setMoveStatus(m, 'done'))} disabled={busy}
                className="flex h-8 w-8 shrink-0 items-center justify-center border border-border-custom bg-surface text-text-secondary hover:border-emerald-500 hover:text-emerald-500 hover:bg-surface-solid rounded-lg transition-all cursor-pointer" title="Done">
                <Square size={15} />
              </button>
            </div>
            <div className="mt-2.5 flex items-center gap-3 border-t border-border-custom pt-2.5 text-[8px] font-black uppercase tracking-widest">
              {m.status !== 'doing' && <button onClick={() => run(() => setMoveStatus(m, 'doing'))} disabled={busy} className="flex items-center gap-1 text-text-secondary hover:text-amber-500 transition-colors cursor-pointer"><Play size={10} /> w toku</button>}
              {m.status !== 'blocked' && <button onClick={() => run(() => setMoveStatus(m, 'blocked'))} disabled={busy} className="flex items-center gap-1 text-text-secondary hover:text-rose-500 transition-colors cursor-pointer"><AlertCircle size={10} /> blok</button>}
              <button onClick={() => run(() => setMoveStatus(m, 'dropped'))} disabled={busy} className="ml-auto flex items-center gap-1 text-text-muted hover:text-rose-500 transition-colors cursor-pointer"><Trash2 size={10} /> odpuść</button>
            </div>
          </article>
        ))}

        {doneMoves.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="px-1 text-[8px] font-black uppercase tracking-widest text-text-muted">Ostatnio zrobione</p>
            {doneMoves.map((m) => (
              <div key={m.id} className="flex items-center gap-2 border border-border-custom bg-surface px-3 py-2 rounded-xl">
                <CheckSquare size={13} className="shrink-0 text-emerald-550/80 dark:text-emerald-500/70" />
                <span className="truncate text-[11px] font-bold uppercase tracking-tight text-text-muted line-through opacity-75">{m.title}</span>
                {m.completed_at && <span className="ml-auto shrink-0 text-[8px] font-black uppercase tracking-widest text-emerald-500/50">{format(new Date(m.completed_at), 'HH:mm')}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 7 — Decyzje */}
      <section className="space-y-3">
        <SectionTitle icon={TrendingUp} title="Decyzje kariery" action={(
          <button onClick={() => setShowDecisionForm((v) => !v)} className="flex items-center gap-1 border border-primary/20 bg-primary/8 px-3.5 py-2 text-[9px] font-black uppercase tracking-widest text-primary rounded-xl hover:bg-primary/15 transition-all cursor-pointer">
            <Plus size={12} /> Decyzja
          </button>
        )} />

        {showDecisionForm && (
          <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 animate-in slide-in-from-top-2">
            <input autoFocus value={decisionForm.title} onChange={(e) => setDecisionForm({ ...decisionForm, title: e.target.value })}
              placeholder="Decyzja w jednym zdaniu" className="w-full rounded-xl border border-border-custom bg-surface p-3 text-[13px] font-bold text-text-primary outline-none placeholder:text-text-muted/45 focus:border-primary/50 focus:bg-surface-solid focus:shadow-[0_0_0_3px_rgba(79,70,229,0.08)]" />
            <textarea value={decisionForm.decision} onChange={(e) => setDecisionForm({ ...decisionForm, decision: e.target.value })} rows={2}
              placeholder="Na czym polega / dlaczego (opcjonalnie)" className="w-full resize-none rounded-xl border border-border-custom bg-surface p-3 text-[12px] font-semibold text-text-primary outline-none placeholder:text-text-muted/45 focus:border-primary/50 focus:bg-surface-solid focus:shadow-[0_0_0_3px_rgba(79,70,229,0.08)]" />
            <div className="flex flex-wrap gap-2">
              {DECISION_TYPES.map((t) => <Pill key={t} active={decisionForm.decision_type === t} onClick={() => setDecisionForm({ ...decisionForm, decision_type: t })}>{t.replace('_', ' ')}</Pill>)}
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <select value={decisionForm.project_id} onChange={(e) => setDecisionForm({ ...decisionForm, project_id: e.target.value })}
                className="rounded-xl border border-border-custom bg-surface p-3 text-[12px] font-bold text-text-primary outline-none focus:border-primary/50 focus:bg-surface-solid focus:shadow-[0_0_0_3px_rgba(79,70,229,0.08)]">
                <option value="">— bez projektu —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="date" value={decisionForm.review_date} onChange={(e) => setDecisionForm({ ...decisionForm, review_date: e.target.value })}
                className="rounded-xl border border-border-custom bg-surface p-3 text-[11px] font-bold text-text-secondary outline-none focus:border-primary/50 focus:bg-surface-solid focus:shadow-[0_0_0_3px_rgba(79,70,229,0.08)] cursor-pointer" title="Data review" />
            </div>
            <button onClick={addDecision} disabled={busy} className="w-full rounded-xl bg-primary hover:bg-primary-hover py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-md shadow-primary/20 transition-all cursor-pointer">Zapisz decyzję</button>
          </div>
        )}

        {decisions.length === 0 && !showDecisionForm && (
          <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-text-muted">Brak decyzji. Zapisz wybór, który zmienia gdzie idzie energia.</p>
        )}

        {decisions.slice(0, 6).map((d) => (
          <article key={d.id} className="rounded-[20px] border border-border-custom bg-surface backdrop-blur-md p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12px] font-black uppercase tracking-tight text-text-primary font-display">{d.title}</p>
              {d.decision_type && <span className="shrink-0 rounded-md border border-border-custom bg-surface px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-text-secondary">{d.decision_type.replace('_', ' ')}</span>}
            </div>
            {d.decision && <p className="mt-1.5 text-[10px] font-semibold leading-snug text-text-secondary">{d.decision}</p>}
            <div className="mt-2 flex items-center gap-3 text-[8px] font-black uppercase tracking-widest text-text-muted">
              <span>{format(new Date(d.decided_at), 'd MMM')}</span>
              {d.project_id && projectById[d.project_id] && <span className="text-text-secondary">{projectById[d.project_id].name}</span>}
              {d.review_date && <span className="ml-auto inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold"><Calendar size={9} /> review {format(new Date(d.review_date), 'd MMM')}</span>}
            </div>
          </article>
        ))}
      </section>

      {/* 8 — Dowody kariery */}
      <section className="space-y-3">
        <SectionTitle icon={RotateCw} title="Dowody — co faktycznie zaszło" />
        {evidence.length === 0 ? (
          <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Brak dowodów. Oznacz ruch jako done — pojawi się tu jako dowód.
          </p>
        ) : (
          <div className="rounded-2xl border border-border-custom bg-surface px-4 shadow-sm">
            {evidence.map((e) => (
              <div key={e.id} className="flex items-start gap-3 border-b border-border-custom py-3.5 last:border-b-0">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold text-text-primary">{e.title}</p>
                  <p className="mt-0.5 text-[8px] font-black uppercase tracking-widest text-text-muted">
                    {e.type}
                    {e.project_id && projectById[e.project_id] ? ` · ${projectById[e.project_id].name}` : ''}
                    {' · '}{format(new Date(e.occurred_at), 'd MMM HH:mm')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
