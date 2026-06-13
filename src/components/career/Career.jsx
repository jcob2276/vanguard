import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Plus, Target, Briefcase, CheckSquare, Square, AlertCircle,
  Trash2, RotateCw, Play, TrendingUp, Calendar,
} from 'lucide-react';
import DataStateNotice from '../core/DataStateNotice';
import {
  listProjects, createProject, updateProject,
  listMoves, createMove, setMoveStatus,
  listEvidence, listDecisions, createDecision,
  deriveNextMove, projectStats, warsawToday,
} from '../../lib/career';

// ── value_type / sense_status visual maps ─────────────────────────────────────
const VT = {
  leverage: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  stability: 'border-white/15 bg-white/[0.06] text-white/70',
  recovery: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
};
const SENSE = {
  worth_it: { label: 'worth it', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25' },
  questionable: { label: 'questionable', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/25' },
  paused: { label: 'paused', cls: 'bg-white/[0.06] text-white/50 border-white/10' },
  cut: { label: 'cut', cls: 'bg-red-500/10 text-red-300 border-red-500/25' },
  completed: { label: 'completed', cls: 'bg-blue-500/10 text-blue-300 border-blue-500/25' },
};
const SENSE_CYCLE = ['worth_it', 'questionable', 'paused', 'cut', 'completed'];
const VALUE_TYPES = ['leverage', 'stability', 'recovery'];
const WORK_MODES = ['deep', 'shallow', 'admin'];
const LEVELS = ['low', 'medium', 'high'];
const DECISION_TYPES = ['start', 'stop', 'continue', 'pause', 'pivot', 'commit', 'cut_scope', 'invest', 'avoid'];

// Polish plural: [1, 2-4, 0/5+]
function plural(n, [one, few, many]) {
  if (n === 1) return one;
  const t = n % 10;
  const h = n % 100;
  if (t >= 2 && t <= 4 && !(h >= 12 && h <= 14)) return few;
  return many;
}

function Eyebrow({ children }) {
  return <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">{children}</p>;
}

function SectionTitle({ icon: Icon, title, action }) {
  return (
    <header className="flex items-end justify-between gap-3">
      <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.22em] text-white/35">
        {Icon && <Icon size={12} className="text-primary" />} {title}
      </p>
      {action}
    </header>
  );
}

// small tappable pill used in all the quick-add forms
function Pill({ active, onClick, children, tone }) {
  const base = 'rounded-md border px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all';
  const on = tone || 'border-primary/40 bg-primary/15 text-white';
  const off = 'border-white/[0.08] bg-black/30 text-white/40';
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

  // ── actions ────────────────────────────────────────────────────────────────
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
      <section className="rounded-lg border border-white/[0.08] bg-neutral-950/80 p-5">
        <DataStateNotice tone="loading" title="Kariera się ładuje" detail="Pobieram projekty, ruchy i dowody." />
      </section>
    );
  }

  return (
    <div className="space-y-7">
      {/* 1 — Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-black uppercase tracking-tight text-white">
            <Briefcase size={16} className="text-primary" /> Kariera
          </h2>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/35">
            {activeCount} {plural(activeCount, ['projekt', 'projekty', 'projektów'])}
            {' · '}
            {openMoves.length} {plural(openMoves.length, ['ruch otwarty', 'ruchy otwarte', 'ruchów otwartych'])}
          </p>
        </div>
        <p className="max-w-[150px] text-right text-[9px] font-semibold leading-tight text-white/25">
          Gdzie idzie 8h pracy i czy pcha karierę
        </p>
      </div>

      {error && <DataStateNotice tone="warning" title="Błąd" detail={error} />}

      {/* 2 — Najważniejszy ruch */}
      <section className="relative overflow-hidden rounded-lg border border-primary/25 bg-[linear-gradient(180deg,rgba(24,24,27,0.9),rgba(10,10,11,0.96))] p-5">
        <Eyebrow>Najważniejszy ruch teraz</Eyebrow>
        {nextMove ? (
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[16px] font-black uppercase tracking-tight text-white">{nextMove.title}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {nextMove.value_type && <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${VT[nextMove.value_type]}`}>{nextMove.value_type}</span>}
                {nextMove.project_id && projectById[nextMove.project_id] && (
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-black uppercase text-white/45">{projectById[nextMove.project_id].name}</span>
                )}
                {nextMove.work_mode && <span className="text-[9px] font-black uppercase tracking-widest text-white/30">{nextMove.work_mode}</span>}
              </div>
            </div>
            <button onClick={() => run(() => setMoveStatus(nextMove, 'done'))} disabled={busy}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary transition-colors hover:bg-primary/25 disabled:opacity-50" title="Zrobione">
              <CheckSquare size={20} />
            </button>
          </div>
        ) : projects.length === 0 ? (
          <p className="mt-2 text-[11px] font-bold leading-relaxed text-white/40">Najpierw dodaj projekt — potem ruch, który go pchnie.</p>
        ) : (
          <button onClick={() => setShowMoveForm(true)} className="mt-2 text-left text-[12px] font-black uppercase leading-snug tracking-tight text-white/70 transition-colors hover:text-primary">
            Wybierz jeden ruch, który dziś pchnie projekt →
          </button>
        )}
      </section>

      {/* 3 + 4 — Projekty kariery */}
      <section className="space-y-3">
        <SectionTitle icon={Briefcase} title="Projekty kariery" action={(
          <button onClick={() => setShowProjectForm((v) => !v)} className="flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-primary">
            <Plus size={12} /> Projekt
          </button>
        )} />

        {showProjectForm && (
          <div className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-4">
            <input autoFocus value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') addProject(); }}
              placeholder="Nazwa projektu — wpisz i Enter" className="w-full rounded-lg border border-white/[0.08] bg-black/45 p-3 text-[13px] font-bold text-white outline-none placeholder:text-white/20 focus:border-primary/70" />
            <input value={projectForm.thesis} onChange={(e) => setProjectForm({ ...projectForm, thesis: e.target.value })}
              placeholder="Teza — po co to istnieje? (opcjonalnie)" className="w-full rounded-lg border border-white/[0.08] bg-black/45 p-3 text-[12px] font-semibold text-white outline-none placeholder:text-white/20 focus:border-primary/70" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[8px] font-black uppercase tracking-widest text-white/30">Dźwignia</span>
              {[1, 2, 3].map((n) => <Pill key={n} active={projectForm.leverage_level === n} onClick={() => setProjectForm({ ...projectForm, leverage_level: n })}>{n}</Pill>)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[8px] font-black uppercase tracking-widest text-white/30">Koszt</span>
              {LEVELS.map((l) => <Pill key={l} active={projectForm.cost_level === l} onClick={() => setProjectForm({ ...projectForm, cost_level: l })}>{l}</Pill>)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[8px] font-black uppercase tracking-widest text-white/30">Ryzyko</span>
              {LEVELS.map((l) => <Pill key={l} active={projectForm.risk_level === l} onClick={() => setProjectForm({ ...projectForm, risk_level: l })}>{l}</Pill>)}
            </div>
            <button onClick={addProject} disabled={busy} className="w-full rounded-lg bg-primary py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50">Dodaj projekt</button>
          </div>
        )}

        {projects.length === 0 && !showProjectForm && (
          <button onClick={() => setShowProjectForm(true)} className="w-full rounded-lg border border-dashed border-white/[0.12] bg-white/[0.02] p-5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5">
            <p className="text-[11px] font-black uppercase tracking-widest text-white/70">Zacznij od projektu</p>
            <p className="mt-1.5 text-[10px] font-semibold leading-relaxed text-white/35">np. „Vanguard", „Klient", „Nauka", „Sprzedaż". Projekt to nośnik sensu, nie lista zadań.</p>
          </button>
        )}

        {projects.map((p) => {
          const st = projectStats(p, moves, evidence);
          const sense = SENSE[p.sense_status] || SENSE.worth_it;
          return (
            <article key={p.id} className="rounded-lg border border-white/[0.07] bg-neutral-950/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="truncate text-[13px] font-black uppercase tracking-tight text-white">{p.name}</h4>
                  {p.thesis && <p className="mt-1 text-[10px] font-semibold leading-snug text-white/40">{p.thesis}</p>}
                </div>
                <button onClick={() => cycleSense(p)} disabled={busy} title="Kliknij, by zmienić sens"
                  className={`shrink-0 rounded-md border px-2 py-1 text-[8px] font-black uppercase tracking-widest ${sense.cls}`}>
                  {sense.label}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[9px] font-black uppercase tracking-widest text-white/40">
                <span className="inline-flex items-center gap-1">
                  dźwignia
                  <span className="ml-0.5 inline-flex gap-0.5">
                    {[1, 2, 3].map((n) => <span key={n} className={`h-1.5 w-1.5 rounded-full ${p.leverage_level >= n ? 'bg-primary' : 'bg-white/15'}`} />)}
                  </span>
                </span>
                {p.cost_level && <span className="text-white/35">koszt {p.cost_level}</span>}
                {p.risk_level && <span className="text-white/35">ryzyko {p.risk_level}</span>}
                <span className="text-emerald-300/80">{st.done} done</span>
                <span className="text-white/50">{st.open} todo</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-3">
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">
                  {st.lastEvidenceAt ? `output ${format(new Date(st.lastEvidenceAt), 'd MMM HH:mm')}` : 'brak outputu'}
                </span>
                <button onClick={() => openMoveFormFor(p.id)} className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-primary/80 hover:text-primary">
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
          <button onClick={() => setShowMoveForm((v) => !v)} className="flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-primary">
            <Plus size={12} /> Ruch
          </button>
        )} />

        {showMoveForm && (
          <div className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-4">
            <input autoFocus value={moveForm.title} onChange={(e) => setMoveForm({ ...moveForm, title: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') addMove(); }}
              placeholder="Co konkretnie robisz? — wpisz i Enter" className="w-full rounded-lg border border-white/[0.08] bg-black/45 p-3 text-[13px] font-bold text-white outline-none placeholder:text-white/20 focus:border-primary/70" />
            <select value={moveForm.project_id} onChange={(e) => setMoveForm({ ...moveForm, project_id: e.target.value })}
              className="w-full rounded-lg border border-white/[0.08] bg-black/45 p-3 text-[12px] font-bold text-white outline-none focus:border-primary/70">
              <option value="">— bez projektu —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="flex flex-wrap gap-2">
              {VALUE_TYPES.map((v) => <Pill key={v} active={moveForm.value_type === v} tone={`border ${VT[v]}`} onClick={() => setMoveForm({ ...moveForm, value_type: v })}>{v}</Pill>)}
            </div>
            <div className="flex flex-wrap gap-2">
              {WORK_MODES.map((w) => <Pill key={w} active={moveForm.work_mode === w} onClick={() => setMoveForm({ ...moveForm, work_mode: w })}>{w}</Pill>)}
            </div>
            <button onClick={addMove} disabled={busy} className="w-full rounded-lg bg-primary py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50">Dodaj ruch (dziś)</button>
          </div>
        )}

        {/* 6 — Lista ruchów */}
        {openMoves.length === 0 && !showMoveForm && (
          <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-white/25">Brak otwartych ruchów.</p>
        )}
        {openMoves.map((m) => (
          <article key={m.id} className="rounded-lg border border-white/[0.07] bg-neutral-950/70 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-black uppercase tracking-tight text-white">{m.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {m.value_type && <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase ${VT[m.value_type]}`}>{m.value_type}</span>}
                  {m.project_id && projectById[m.project_id] && <span className="text-[8px] font-black uppercase tracking-widest text-white/35">{projectById[m.project_id].name}</span>}
                  {m.status === 'blocked' && <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-red-400"><AlertCircle size={10} /> blok</span>}
                  {m.status === 'doing' && <span className="text-[8px] font-black uppercase tracking-widest text-amber-400">w toku</span>}
                </div>
              </div>
              <button onClick={() => run(() => setMoveStatus(m, 'done'))} disabled={busy}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/[0.1] text-white/35 transition-colors hover:border-emerald-500 hover:text-emerald-400" title="Done">
                <Square size={15} />
              </button>
            </div>
            <div className="mt-2.5 flex items-center gap-3 border-t border-white/[0.05] pt-2.5 text-[8px] font-black uppercase tracking-widest">
              {m.status !== 'doing' && <button onClick={() => run(() => setMoveStatus(m, 'doing'))} disabled={busy} className="flex items-center gap-1 text-white/40 hover:text-amber-300"><Play size={10} /> w toku</button>}
              {m.status !== 'blocked' && <button onClick={() => run(() => setMoveStatus(m, 'blocked'))} disabled={busy} className="flex items-center gap-1 text-white/40 hover:text-red-300"><AlertCircle size={10} /> blok</button>}
              <button onClick={() => run(() => setMoveStatus(m, 'dropped'))} disabled={busy} className="ml-auto flex items-center gap-1 text-white/25 hover:text-red-300"><Trash2 size={10} /> odpuść</button>
            </div>
          </article>
        ))}

        {doneMoves.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="px-1 text-[8px] font-black uppercase tracking-widest text-white/25">Ostatnio zrobione</p>
            {doneMoves.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-md border border-white/[0.04] bg-black/30 px-3 py-2">
                <CheckSquare size={13} className="shrink-0 text-emerald-500/70" />
                <span className="truncate text-[11px] font-bold uppercase tracking-tight text-white/35 line-through">{m.title}</span>
                {m.completed_at && <span className="ml-auto shrink-0 text-[8px] font-black uppercase tracking-widest text-emerald-400/40">{format(new Date(m.completed_at), 'HH:mm')}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 7 — Decyzje */}
      <section className="space-y-3">
        <SectionTitle icon={TrendingUp} title="Decyzje kariery" action={(
          <button onClick={() => setShowDecisionForm((v) => !v)} className="flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-primary">
            <Plus size={12} /> Decyzja
          </button>
        )} />

        {showDecisionForm && (
          <div className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-4">
            <input autoFocus value={decisionForm.title} onChange={(e) => setDecisionForm({ ...decisionForm, title: e.target.value })}
              placeholder="Decyzja w jednym zdaniu" className="w-full rounded-lg border border-white/[0.08] bg-black/45 p-3 text-[13px] font-bold text-white outline-none placeholder:text-white/20 focus:border-primary/70" />
            <textarea value={decisionForm.decision} onChange={(e) => setDecisionForm({ ...decisionForm, decision: e.target.value })} rows={2}
              placeholder="Na czym polega / dlaczego (opcjonalnie)" className="w-full resize-none rounded-lg border border-white/[0.08] bg-black/45 p-3 text-[12px] font-semibold text-white outline-none placeholder:text-white/20 focus:border-primary/70" />
            <div className="flex flex-wrap gap-2">
              {DECISION_TYPES.map((t) => <Pill key={t} active={decisionForm.decision_type === t} onClick={() => setDecisionForm({ ...decisionForm, decision_type: t })}>{t.replace('_', ' ')}</Pill>)}
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <select value={decisionForm.project_id} onChange={(e) => setDecisionForm({ ...decisionForm, project_id: e.target.value })}
                className="rounded-lg border border-white/[0.08] bg-black/45 p-3 text-[12px] font-bold text-white outline-none focus:border-primary/70">
                <option value="">— bez projektu —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="date" value={decisionForm.review_date} onChange={(e) => setDecisionForm({ ...decisionForm, review_date: e.target.value })}
                className="rounded-lg border border-white/[0.08] bg-black/45 p-3 text-[11px] font-bold text-white/70 outline-none focus:border-primary/70" title="Data review" />
            </div>
            <button onClick={addDecision} disabled={busy} className="w-full rounded-lg bg-primary py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50">Zapisz decyzję</button>
          </div>
        )}

        {decisions.length === 0 && !showDecisionForm && (
          <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-white/25">Brak decyzji. Zapisz wybór, który zmienia gdzie idzie energia.</p>
        )}

        {decisions.slice(0, 6).map((d) => (
          <article key={d.id} className="rounded-lg border border-white/[0.06] bg-neutral-950/60 p-3.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12px] font-black uppercase tracking-tight text-white">{d.title}</p>
              {d.decision_type && <span className="shrink-0 rounded-md border border-white/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-white/45">{d.decision_type.replace('_', ' ')}</span>}
            </div>
            {d.decision && <p className="mt-1.5 text-[10px] font-semibold leading-snug text-white/40">{d.decision}</p>}
            <div className="mt-2 flex items-center gap-3 text-[8px] font-black uppercase tracking-widest text-white/25">
              <span>{format(new Date(d.decided_at), 'd MMM')}</span>
              {d.project_id && projectById[d.project_id] && <span className="text-white/35">{projectById[d.project_id].name}</span>}
              {d.review_date && <span className="ml-auto inline-flex items-center gap-1 text-amber-400/60"><Calendar size={9} /> review {format(new Date(d.review_date), 'd MMM')}</span>}
            </div>
          </article>
        ))}
      </section>

      {/* 8 — Dowody kariery */}
      <section className="space-y-3">
        <SectionTitle icon={RotateCw} title="Dowody — co faktycznie zaszło" />
        {evidence.length === 0 ? (
          <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-white/25">
            Brak dowodów. Oznacz ruch jako done — pojawi się tu jako dowód.
          </p>
        ) : (
          <div className="rounded-lg border border-white/[0.06] bg-neutral-950/60 px-4">
            {evidence.map((e) => (
              <div key={e.id} className="flex items-start gap-3 border-b border-white/[0.05] py-3 last:border-b-0">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary/60" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold text-white/85">{e.title}</p>
                  <p className="mt-0.5 text-[8px] font-black uppercase tracking-widest text-white/30">
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
